import crypto from 'crypto'
import type { AuthToken, SyncSource, SyncOptions, SyncResult, SyncError, ConfigField } from '../types'
import { buildEncryptedParams, decryptResponse } from '../mi-crypto'

// ============================================================
// MiApiSource - 小米运动健康 API 数据源（密码登录 + 二维码登录 + 直接 API）
//
// 基于 miband-bot-api-analysis.md：直接调用小米健康 API
// 支持三种登录方式：密码登录、二维码扫码登录、手动导入 Token
// - Base URL：https://hlth.io.mi.com （国内）
// ============================================================

const ACCOUNT_BASE = 'https://account.xiaomi.com'
const HEALTH_BASE = 'https://hlth.io.mi.com'
const USER_AGENT = 'PassportSDK/5.3.0.release.79 XiaomiAccountSSO/5.3.0.release.79'
const SID = 'miothealth'
const TIMEOUT_MS = 15_000

// 调试日志开关：默认静默，SYNC_DEBUG=true 时输出截断的请求/响应用于联调
const SYNC_DEBUG = process.env.SYNC_DEBUG === 'true'
function syncDebug(...args: unknown[]): void {
  if (SYNC_DEBUG) console.log('[MiApi]', ...args)
}
function syncDebugError(...args: unknown[]): void {
  if (SYNC_DEBUG) console.error('[MiApi]', ...args)
}

/** 小米 API 认证 Token 结构 */
interface MiApiToken {
  user_id: string
  c_user_id: string
  service_token: string
  ssecurity: string
  pass_token: string
  device_id: string
}

/**
 * 去除小米响应的 "&&&START&&&" 前缀并解析 JSON
 */
function parseMiResponse(raw: string): any {
  let str = typeof raw === 'string' ? raw : String(raw)
  if (str.startsWith('&&&START&&&')) {
    str = str.slice('&&&START&&&'.length)
  }
  str = str.trim()
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}
export { parseMiResponse }

/**
 * 生成设备指纹
 * 源码: HashedDeviceIdUtil → SHA1(UUID) → Base64 URL_SAFE → [:16]
 */
function generateDeviceId(): string {
  const secret = crypto.randomUUID()
  const sha1 = crypto.createHash('sha1').update(secret).digest()
  return sha1.toString('base64url').slice(0, 16)
}

/**
 * 密码哈希: MD5(明文).toUpperCase()
 * 源码: XMPassport.java:2731 — getMd5DigestUpperCase
 */
function hashPassword(password: string): string {
  return crypto.createHash('md5').update(password).digest('hex').toUpperCase()
}

/**
 * 计算 clientSign
 * 源码: Coder.generateSignature → SHA1("nonce={nonce}&{ssecurity}") → Base64
 */
function computeClientSign(nonce: number | string, ssecurity: string): string {
  const msg = `nonce=${nonce}&${ssecurity}`
  return crypto.createHash('sha1').update(msg, 'utf-8').digest('base64')
}
export { hashPassword, computeClientSign }

/**
 * 发送健康 API GET 请求（RC4 加密签名版）
 *
 * 小米健康数据 API 要求所有请求参数经 RC4 加密 + SHA1 签名，
 * 响应体同样 RC4 加密需解密。明文调用会返回 401 auth err。
 *
 * 流程：
 * 1. buildEncryptedParams 生成加密参数（含 signature/_nonce/rc4_hash__）
 * 2. 通过 Cookie (cUserId + serviceToken) 发送
 * 3. 响应经 decryptResponse 解密为 JSON
 */
async function encryptedHealthGet(
  token: MiApiToken,
  endpoint: string,
  params?: Record<string, any>,
): Promise<any> {
  if (!token.ssecurity) {
    throw new Error('凭证缺少 ssecurity，无法生成加密签名（请重新登录）')
  }

  const urlPath = `/app/v1/${endpoint}`
  const enc = buildEncryptedParams('GET', urlPath, token.ssecurity, params)

  const url = new URL(urlPath, HEALTH_BASE)
  // 加密参数作为 query string
  for (const [k, v] of Object.entries(enc)) {
    url.searchParams.set(k, v)
  }

  syncDebug('加密请求', endpoint, 'nonce?', !!enc._nonce, 'signature?', !!enc.signature)

  const resp = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Cookie': `cUserId=${token.c_user_id}; serviceToken=${token.service_token}; locale=zh_CN`,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (resp.status === 401) {
    throw new Error('Health API 返回 401 — serviceToken 已失效，需重新登录')
  }

  const text = await resp.text()
  // 响应解密（可能带 &&&START&&& 前缀，decryptResponse 内部处理）
  try {
    const decrypted = decryptResponse(token.ssecurity, enc._nonce, text)
    return decrypted
  } catch (e) {
    // 解密失败时 fallback 尝试明文 JSON（个别端点可能不加密）
    syncDebug('响应解密失败，尝试明文解析:', (e as Error).message)
    const plain = parseMiResponse(text)
    // 检查是否是明文错误响应
    if (plain && typeof plain === 'object' && 'code' in plain) {
      return plain
    }
    throw new Error(`响应解密失败: ${(e as Error).message}`)
  }
}

/**
 * 从小米响应原始文本提取 nonce 的字符串原值
 * 关键：nonce 是大整数（>2^53），JSON.parse 会丢精度导致 clientSign 算错
 * 必须用正则从原始文本提取字符串原值
 */
export function extractNonce(rawText: string): string {
  const m = rawText.match(/"nonce"\s*:\s*(\d+)/)
  return m ? m[1] : ''
}

// ── 认证流程 ──────────────────────────────────────────────

/**
 * 按天聚合数据查询（小米健康真实数据接口）
 *
 * 端点: /app/v1/data/get_aggregated_fitness_data_by_time
 * 参数: relative_uid(0=自己), key(小写: steps/sleep/heart_rate/weight/...), tag=daily_report, start_time/end_time(秒), limit
 * 返回: result.data_list[{sid,tag,key,time,value(JSON字符串),...}]
 */
async function getAggregatedData(
  token: MiApiToken,
  key: string,
  startTimeSec: number,
  endTimeSec: number,
  limit = 2000,
): Promise<Array<{ time: number; value: string; [k: string]: unknown }>> {
  const resp = await encryptedHealthGet(token, 'data/get_aggregated_fitness_data_by_time', {
    relative_uid: 0,
    key,
    tag: 'daily_report',
    start_time: startTimeSec,
    end_time: endTimeSec,
    limit,
  })
  const list = resp?.result?.data_list
  return Array.isArray(list) ? list : []
}

/** 解析聚合数据的 value 字段（JSON 字符串） */
export function parseAggValue(value: unknown): Record<string, any> {
  if (typeof value !== 'string') return {}
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

/**
 * Unix 秒时间戳 → 东八区日期字符串 YYYY-MM-DD
 * 小米返回的 entry.time 是 UTC 当天 0 点，需转成用户时区（中国 = Asia/Shanghai）
 */
function toLocalDateStr(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
}

/**
 * Unix 秒时间戳 → 东八区可读时间字符串（用于 bedTime/wakeTime 等 String 字段）
 * 格式: YYYY-MM-DD HH:mm:ss
 */
function toLocalTimeStr(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('en-CA', { timeZone: 'Asia/Shanghai', hour12: false }).replace(',', '')
}

/**
 * 原始测量数据查询（单次测量记录，如体重/血压）
 *
 * 端点: /app/v1/data/get_fitness_data_by_time
 * 参数: relative_uid(0=自己), key(weight/blood_pressure), start_time/end_time(秒), limit
 * 返回: result.data_list[{sid,key,time,value(JSON字符串),zone_offset,...}]
 */
async function getFitnessData(
  token: MiApiToken,
  key: string,
  startTimeSec: number,
  endTimeSec: number,
  limit = 2000,
): Promise<Array<{ time: number; value: string; [k: string]: unknown }>> {
  const resp = await encryptedHealthGet(token, 'data/get_fitness_data_by_time', {
    relative_uid: 0,
    key,
    start_time: startTimeSec,
    end_time: endTimeSec,
    limit,
  })
  const list = resp?.result?.data_list
  return Array.isArray(list) ? list : []
}


/**
 * Step 1: 预登录 — 获取 MetaLoginData (sign/qs/callback)
 */
async function step1PreLogin(deviceId: string): Promise<{ sign: string; qs: string; callback: string }> {
  const url = new URL('/pass/serviceLogin', ACCOUNT_BASE)
  url.searchParams.set('_json', 'true')
  url.searchParams.set('sid', SID)
  url.searchParams.set('_locale', 'zh_CN')

  const resp = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Cookie': `deviceId=${deviceId}`,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const text = await resp.text()
  const body = parseMiResponse(text)

  // 小米 _json 模式下字段名带下划线前缀（_sign），兼容两种形态
  const sign = body.sign || body._sign || ''
  if (!sign) {
    throw new Error('Step 1: 未返回 sign 字段，可能被风控拦截或账号状态异常')
  }

  return {
    sign,
    qs: body.qs || '',
    callback: body.callback || '',
  }
}

/**
 * Step 2: 密码认证 → 获取 passToken (在 HTTP Response Header)
 * 源码: XMPassport.loginByPassword() → parseLoginResult()
 */
async function step2LoginByPassword(
  user: string,
  password: string,
  meta: { sign: string; qs: string; callback: string },
  deviceId: string,
): Promise<{ userId: string; passToken: string; cUserId: string }> {
  const form = new URLSearchParams({
    user,
    hash: hashPassword(password),
    sid: SID,
    _json: 'true',
    _sign: meta.sign,
    qs: meta.qs,
    callback: meta.callback,
  })

  const resp = await fetch(`${ACCOUNT_BASE}/pass/serviceLoginAuth2`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': `deviceId=${deviceId}`,
    },
    body: form.toString(),
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  // passToken/userId 在 Response Headers 中
  const userId = (resp.headers.get('userId') || '').trim()
  const passToken = (resp.headers.get('passToken') || '').trim()
  const cUserId = (resp.headers.get('cUserId') || '').trim()

  if (passToken) {
    return { userId, passToken, cUserId }
  }

  // 解析错误
  const text = await resp.text()
  const body = parseMiResponse(text)

  if (body.notificationUrl) {
    throw new Error('需要通知确认，请前往小米账号页面处理')
  }
  if (body.securityStatus && body.securityStatus !== 0) {
    throw new Error('需要二次验证')
  }
  throw new Error(`登录失败: code=${body.code} desc=${body.desc || '?'}`)
}

/**
 * Step 3: passToken → serviceToken（两次 HTTP 请求）
 * Step 3a: 获取 STS URL + ssecurity + nonce
 * Step 3b: STS 签名请求 → serviceToken
 */
async function step3GetServiceToken(
  userId: string,
  passToken: string,
  deviceId: string,
): Promise<MiApiToken> {
  // Step 3a: 获取 STS URL
  const url3a = new URL('/pass/serviceLogin', ACCOUNT_BASE)
  url3a.searchParams.set('_json', 'true')
  url3a.searchParams.set('sid', SID)

  const respA = await fetch(url3a.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Cookie': `userId=${userId}; passToken=${passToken}; deviceId=${deviceId}`,
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const textA = await respA.text()
  const bodyA = parseMiResponse(textA)

  const location = bodyA.location || ''
  // nonce 大整数需从原始文本提取字符串，避免 JSON 精度丢失
  const nonce = extractNonce(textA) || String(bodyA.nonce || 0)
  const ssecurity = bodyA.ssecurity || ''
  const cUserId = (respA.headers.get('cUserId') || bodyA.cUserId || '').trim()

  if (!location || location === 'null') {
    throw new Error('Step 3a: 响应缺少 STS URL (location 字段)')
  }
  if (!ssecurity) {
    throw new Error('Step 3a: 响应缺少 ssecurity')
  }

  // Step 3b: STS 签名请求
  const clientSign = computeClientSign(nonce, ssecurity)
  const stsUrl = new URL(location)
  stsUrl.searchParams.set('clientSign', clientSign)
  stsUrl.searchParams.set('_userIdNeedEncrypt', 'true')

  const respB = await fetch(stsUrl.toString(), {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  // serviceToken 在 Header: "{sid}_serviceToken" 或 fallback "serviceToken"
  let serviceToken = (respB.headers.get(`${SID}_serviceToken`) || '').trim()
  if (!serviceToken) {
    serviceToken = (respB.headers.get('serviceToken') || '').trim()
  }
  if (!serviceToken) {
    throw new Error('Step 3b: 响应 Header 缺少 serviceToken')
  }

  return {
    user_id: userId,
    c_user_id: cUserId,
    service_token: serviceToken,
    ssecurity,
    pass_token: passToken,
    device_id: deviceId,
  }
}

/**
 * 完整的密码登录流程
 */
async function loginByPassword(username: string, password: string): Promise<MiApiToken> {
  const deviceId = generateDeviceId()

  // Step 1: 预登录
  const meta = await step1PreLogin(deviceId)

  // Step 2: 密码认证
  const login = await step2LoginByPassword(username, password, meta, deviceId)

  // Step 3: 获取 serviceToken
  return step3GetServiceToken(login.userId, login.passToken, deviceId)
}

// ── 二维码扫码登录流程 ─────────────────────────────────────

/**
 * QR Step 1: 获取二维码信息
 * 源码: auth/qr.py — loginQr()
 *
 * GET https://account.xiaomi.com/longPolling/loginUrl
 * 返回: { qr: 二维码图片URL, loginUrl: 登录链接, lp: 长轮询URL }
 */
export async function getQrCode(): Promise<{ qrImageUrl: string; loginUrl: string; longPollingUrl: string }> {
  const params = new URLSearchParams({
    _qrsize: '480',
    qs: '%3Fsid%3Dmiothealth%26_json%3Dtrue',
    callback: 'https://sts-hlth.io.mi.com/healthapp/sts',
    _hasLogo: 'false',
    sid: SID,
    serviceParam: '',
    _locale: 'zh_CN',
    _dc: String(Date.now()),
  })

  const resp = await fetch(`${ACCOUNT_BASE}/longPolling/loginUrl?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const text = await resp.text()
  const data = parseMiResponse(text)

  if (!data.qr || !data.lp) {
    throw new Error(`获取二维码失败: qr=${!!data.qr} lp=${!!data.lp}`)
  }

  return {
    qrImageUrl: data.qr,
    loginUrl: data.loginUrl,
    longPollingUrl: data.lp,
  }
}

/**
 * QR Step 2: 长轮询等待扫码 + 提取凭证 + 获取 serviceToken
 * 源码: auth/qr.py — loginQr() + extractCredentials()
 *
 * 流程:
 * 1. 长轮询等待扫码（最长 180 秒）
 * 2. 从响应中提取 {ssecurity, userId, passToken, cUserId, location, nonce}
 * 3. 用 clientSign 跟随 location 获取 serviceToken
 */
export async function waitForQrScan(longPollingUrl: string): Promise<MiApiToken> {
  // Step 2a: 长轮询等待扫码
  const resp = await fetch(longPollingUrl, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(180_000), // 3 分钟超时
  })

  const text = await resp.text()
  const data = parseMiResponse(text)

  if (data.code !== 0 && data.result !== 0) {
    syncDebugError('扫码响应异常, raw:', text.slice(0, 500))
    throw new Error(`扫码结果异常: code=${data.code} desc=${data.desc || data.message || '?'}`)
  }

  const ssecurity = data.ssecurity || ''
  const userId = data.userId || ''
  const passToken = data.passToken || ''
  const cUserId = data.cUserId || ''
  const location = data.location || ''
  // ⚠ nonce 是大整数（>2^53），JSON.parse 会丢精度 → clientSign 算错 → STS 400
  // 必须从原始文本提取 nonce 的字符串原值
  const nonce = extractNonce(text) || String(data.nonce || 0)

  syncDebug('扫码成功, userId:', userId, 'nonce:', nonce, 'location:', location ? '有' : '无', 'ssecurity:', ssecurity ? '有' : '无')

  if (!location || location === 'null') {
    syncDebugError('扫码响应完整数据:', JSON.stringify(data).slice(0, 1000))
    throw new Error('扫码响应缺少 location 字段')
  }
  if (!ssecurity) {
    syncDebugError('扫码响应完整数据:', JSON.stringify(data).slice(0, 1000))
    throw new Error('扫码响应缺少 ssecurity')
  }

  // Step 2b: 用 clientSign 跟随 location 获取 serviceToken
  const clientSign = computeClientSign(nonce, ssecurity)
  const stsUrl = new URL(location)
  stsUrl.searchParams.set('clientSign', clientSign)
  stsUrl.searchParams.set('_userIdNeedEncrypt', 'true')

  syncDebug('STS 请求:', stsUrl.toString().slice(0, 200))

  // 跟随重定向（文档：跟随 location 重定向获取 serviceToken）
  const respSts = await fetch(stsUrl.toString(), {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  // serviceToken 可能在 header 或 set-cookie 中
  let serviceToken = (respSts.headers.get(`${SID}_serviceToken`) || '').trim()
  if (!serviceToken) {
    serviceToken = (respSts.headers.get('serviceToken') || '').trim()
  }
  if (!serviceToken) {
    // 尝试从 set-cookie 提取
    const setCookie = respSts.headers.get('set-cookie') || ''
    const m = setCookie.match(/serviceToken=([^;]+)/)
    if (m) serviceToken = m[1]
  }
  if (!serviceToken) {
    const respHeaders: Record<string, string> = {}
    respSts.headers.forEach((v, k) => { respHeaders[k] = v })
    const stsBody = await respSts.text()
    syncDebugError('STS 响应体:', stsBody.slice(0, 500), 'headers:', JSON.stringify(respHeaders))
    throw new Error('STS 响应缺少 serviceToken')
  }

  return {
    user_id: userId,
    c_user_id: cUserId,
    service_token: serviceToken,
    ssecurity,
    pass_token: passToken,
    device_id: generateDeviceId(),
  }
}

/**
 * 使用 passToken 刷新 serviceToken（Token 过期后调用）
 * 源码: VerifyToken → mTokenManager.getServiceToken(sid, true, loginPolicy)
 */
async function refreshServiceToken(token: MiApiToken): Promise<MiApiToken> {
  return step3GetServiceToken(token.user_id, token.pass_token, token.device_id)
}

// ── 数据源实现 ────────────────────────────────────────────

/**
 * MiApiSource - 小米运动健康 API 数据源
 *
 * 基于 miband-bot-api-analysis.md 方案 B：直接调用小米健康 API
 *
 * 支持功能：
 * - 密码登录（三步认证流程）
 * - 二维码扫码登录（通过 /api/v1/sync/login/qr 端点）
 * - 同步步数、心率、睡眠、体重数据
 * - 按 date + sourceId 唯一约束去重，保证幂等性
 * - Token 过期自动刷新（passToken → serviceToken）
 */
export class MiApiSource implements SyncSource {
  id = 'miapi'
  name = '小米健康 API'
  description = '通过小米健康 API 同步步数、心率、睡眠、体重等健康数据（支持二维码/密码登录）'

  configSchema: ConfigField[] = [
    {
      key: 'username',
      label: '小米账号',
      type: 'text',
      placeholder: '手机号/邮箱/小米 ID',
      required: true,
    },
    {
      key: 'password',
      label: '密码',
      type: 'password',
      placeholder: '小米账号密码',
      required: true,
    },
    {
      key: 'cron',
      label: '同步频率 (cron)',
      type: 'cron',
      defaultValue: '0 9 * * *',
      required: false,
    },
  ]

  /**
   * 认证
   *
   * credentials 参数支持三种模式：
   * 1. { username, password } → 密码登录（完整流程）
   * 2. { service_token, c_user_id, user_id? } → 手动导入 Token（跳过登录）
   * 3. { refresh: true, ...token } → 刷新已过期的 serviceToken
   */
  async authenticate(credentials: Record<string, unknown>): Promise<AuthToken> {
    // 刷新模式
    if (credentials.refresh) {
      const token = await refreshServiceToken(credentials as unknown as MiApiToken)
      return {
        ...token,
        accessToken: token.service_token,
      }
    }

    // 手动导入 Token 模式（兜底方案）
    // 必填: service_token, c_user_id
    // 可选: pass_token, user_id, device_id（有 pass_token 时支持自动刷新）
    const serviceToken = String(credentials.service_token || '')
    const cUserId = String(credentials.c_user_id || '')
    if (serviceToken && cUserId) {
      return {
        user_id: String(credentials.user_id || ''),
        c_user_id: cUserId,
        service_token: serviceToken,
        ssecurity: '',
        pass_token: String(credentials.pass_token || ''),
        device_id: String(credentials.device_id || generateDeviceId()),
        accessToken: serviceToken,
      }
    }

    // 密码登录模式
    const username = String(credentials.username || '')
    const password = String(credentials.password || '')

    if (!username || !password) {
      throw new Error('请提供小米账号和密码，或手动导入 serviceToken/cUserId')
    }

    const token = await loginByPassword(username, password)

    return {
      ...token,
      accessToken: token.service_token,
    }
  }

  /**
   * 同步健康数据
   *
   * 同步的数据类型：
   * - 步数 steps → exercise 表（聚合接口）
   * - 心率 heart_rate → exercise 表（聚合接口）
   * - 睡眠 sleep → sleep 表（聚合接口）
   * - 卡路里 calories → exercise 表（聚合接口）
   * - 血氧 spo2 → exercise 表（聚合接口）
   * - 有效站立 valid_stand → exercise 表（聚合接口）
   * - 中高强度 intensity → exercise 表（聚合接口）
   * - 压力 stress → exercise 表（聚合接口）
   * - 体重 weight → weight 表（原始测量接口，含体脂/肌肉/骨量/水分/内脏脂肪）
   *
   * 两个数据接口（均 RC4 加密签名）：
   * - 聚合（按天）: GET /app/v1/data/get_aggregated_fitness_data_by_time
   *   参数: relative_uid=0, key(小写), tag=daily_report, start_time/end_time(秒), limit
   * - 原始测量: GET /app/v1/data/get_fitness_data_by_time
   *   参数: relative_uid=0, key(weight/blood_pressure), start_time/end_time(秒), limit
   *
   * 使用 Prisma @@unique([date, sourceId]) 约束 + upsert 保证幂等性
   */
  async sync(options: SyncOptions): Promise<SyncResult> {
    const { userId, config, token } = options

    const miToken: MiApiToken = {
      user_id: String(token.user_id || ''),
      c_user_id: String(token.c_user_id || ''),
      service_token: String(token.service_token || token.accessToken || ''),
      ssecurity: String(token.ssecurity || ''),
      pass_token: String(token.pass_token || ''),
      device_id: String(token.device_id || generateDeviceId()),
    }

    if (!miToken.service_token || !miToken.c_user_id) {
      return {
        success: false,
        syncedRecords: { exercise: 0, sleep: 0, weight: 0, diet: 0 },
        errors: [{ type: 'auth', message: '认证凭证无效，请重新登录' }],
      }
    }

    const errors: SyncError[] = []
    const syncedRecords = { exercise: 0, sleep: 0, weight: 0, diet: 0 }

    // 计算时间范围：默认最近 7 天（聚合接口用秒级时间戳）
    const endDate = options.endDate || new Date()
    const startDate = options.startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    const startTimeSec = Math.floor(startDate.getTime() / 1000)
    const endTimeSec = Math.floor(endDate.getTime() / 1000)

    const { default: prisma } = await import('@/lib/prisma')
    const { encryptToken, isSyncEncryptionAvailable } = await import('@/lib/sync/crypto')

    // 尝试刷新 token 的辅助函数
    let tokenRefreshed = false
    const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn()
      } catch (e: any) {
        if (e.message?.includes('401') && !tokenRefreshed && miToken.pass_token) {
          tokenRefreshed = true
          const newToken = await refreshServiceToken(miToken)
          miToken.service_token = newToken.service_token
          miToken.c_user_id = newToken.c_user_id
          // 刷新后的 token 持久化到数据库，避免下次同步仍用过期 token
          try {
            const plain = JSON.stringify(miToken)
            await prisma.syncSourceConfig.updateMany({
              where: { userId: options.userId, sourceId: 'miapi' },
              data: { token: isSyncEncryptionAvailable() ? encryptToken(plain) : plain },
            })
          } catch {
            // 持久化失败不阻断本次同步（内存 token 仍可用）
          }
          return fn()
        }
        throw e
      }
    }

    // --- 同步步数数据（get_aggregated_fitness_data_by_time, key=steps）---
    try {
      const stepsList = await withRetry(() =>
        getAggregatedData(miToken, 'steps', startTimeSec, endTimeSec),
      )

      for (const entry of stepsList) {
        try {
          const value = parseAggValue(entry.value)
          const date = new Date((entry.time as number) * 1000)
          const dateStr = toLocalDateStr(entry.time as number)
          const sourceId = `miapi_steps_${dateStr}`

          await prisma.exercise.upsert({
            where: { date_sourceId: { date: new Date(dateStr), sourceId } },
            create: {
              userId,
              type: 'steps',
              duration: 0,
              caloriesBurned: value.calories ? Math.round(value.calories) : null,
              activities: JSON.stringify({
                steps: value.steps || 0,
                distance: value.distance || 0,
                goal: value.goal || 0,
              }),
              date: new Date(dateStr),
              sourceId,
              extraData: JSON.stringify({ raw: value }),
            },
            update: {
              caloriesBurned: value.calories ? Math.round(value.calories) : null,
              activities: JSON.stringify({
                steps: value.steps || 0,
                distance: value.distance || 0,
                goal: value.goal || 0,
              }),
              extraData: JSON.stringify({ raw: value }),
            },
          })
          syncedRecords.exercise++
        } catch (e: any) {
          errors.push({ type: 'exercise', message: e.message })
        }
      }
    } catch (e: any) {
      errors.push({ type: 'exercise', message: `步数同步失败: ${e.message}` })
    }

    // --- 同步心率数据（key=heart_rate）---
    try {
      const hrList = await withRetry(() =>
        getAggregatedData(miToken, 'heart_rate', startTimeSec, endTimeSec),
      )

      for (const entry of hrList) {
        try {
          const value = parseAggValue(entry.value)
          const dateStr = toLocalDateStr(entry.time as number)
          const sourceId = `miapi_hr_${dateStr}`

          await prisma.exercise.upsert({
            where: { date_sourceId: { date: new Date(dateStr), sourceId } },
            create: {
              userId,
              type: 'heart_rate',
              duration: 0,
              caloriesBurned: null,
              activities: JSON.stringify({
                avg: value.avg_hr || 0,
                max: value.max_hr || 0,
                min: value.min_hr || 0,
                resting: value.avg_rhr || null,
              }),
              date: new Date(dateStr),
              sourceId,
              extraData: JSON.stringify({ raw: value }),
            },
            update: {
              activities: JSON.stringify({
                avg: value.avg_hr || 0,
                max: value.max_hr || 0,
                min: value.min_hr || 0,
                resting: value.avg_rhr || null,
              }),
              extraData: JSON.stringify({ raw: value }),
            },
          })
          syncedRecords.exercise++
        } catch (e: any) {
          errors.push({ type: 'exercise', message: e.message })
        }
      }
    } catch (e: any) {
      errors.push({ type: 'exercise', message: `心率同步失败: ${e.message}` })
    }

    // --- 同步睡眠数据（key=sleep，segment_details 含 bedtime/wake_up_time/sleep_deep_duration）---
    try {
      const sleepList = await withRetry(() =>
        getAggregatedData(miToken, 'sleep', startTimeSec, endTimeSec),
      )

      for (const entry of sleepList) {
        try {
          const value = parseAggValue(entry.value)
          const dateStr = toLocalDateStr(entry.time as number)
          const sourceId = `miapi_sleep_${dateStr}`

          // 取主睡眠段（通常是最长的那段）
          const segments: any[] = value.segment_details || []
          const mainSeg = segments.length > 0
            ? segments.reduce((a, b) => ((b.duration || 0) > (a.duration || 0) ? b : a))
            : null

          const bedtimeSec = mainSeg?.bedtime || (entry.time as number)
          const wakeSec = mainSeg?.wake_up_time || (bedtimeSec + (mainSeg?.duration || 0) * 60)
          const durationMin = mainSeg?.duration || 0
          const deepMin = mainSeg?.sleep_deep_duration || 0
          const remMin = mainSeg?.sleep_rem_duration || 0
          const awakeCount = mainSeg?.awake_count || 0

          await prisma.sleep.upsert({
            where: { date_sourceId: { date: new Date(dateStr), sourceId } },
            create: {
              userId,
              duration: durationMin / 60,
              bedTime: toLocalTimeStr(bedtimeSec),
              wakeTime: toLocalTimeStr(wakeSec),
              quality: value.sleep_score || 50,
              deepSleep: deepMin > 0 ? deepMin / 60 : null,
              remSleep: remMin > 0 ? remMin / 60 : null,
              awakenings: awakeCount,
              date: new Date(dateStr),
              sourceId,
              extraData: JSON.stringify({ sleepScore: value.sleep_score, raw: value }),
            },
            update: {
              duration: durationMin / 60,
              bedTime: toLocalTimeStr(bedtimeSec),
              wakeTime: toLocalTimeStr(wakeSec),
              quality: value.sleep_score || 50,
              deepSleep: deepMin > 0 ? deepMin / 60 : null,
              remSleep: remMin > 0 ? remMin / 60 : null,
              awakenings: awakeCount,
            },
          })
          syncedRecords.sleep++
        } catch (e: any) {
          errors.push({ type: 'sleep', message: e.message })
        }
      }
    } catch (e: any) {
      errors.push({ type: 'sleep', message: `睡眠同步失败: ${e.message}` })
    }

    // --- 同步体重数据（get_fitness_data_by_time 原始测量记录，key=weight）---
    try {
      const weightList = await withRetry(() =>
        getFitnessData(miToken, 'weight', startTimeSec, endTimeSec),
      )

      for (const entry of weightList) {
        try {
          const value = parseAggValue(entry.value)
          // 体重原始记录含丰富字段：weight/bmi/body_fat_rate/muscle_mass/bone_mass/visceral_fat/water 等
          const weightKg = value.weight
          if (weightKg == null || weightKg <= 0) continue

          const date = new Date((entry.time as number) * 1000)
          // 同一天多次测量，sourceId 用精确时间戳区分
          const sourceId = `miapi_weight_${entry.time}`

          await prisma.weight.upsert({
            where: { date_sourceId: { date, sourceId } },
            create: {
              userId,
              weight: weightKg,
              bmi: value.bmi > 0 ? value.bmi : null,
              bodyFat: value.body_fat_rate > 0 ? value.body_fat_rate : null,
              muscleMass: value.muscle_mass > 0 ? value.muscle_mass : null,
              boneMass: value.bone_mass > 0 ? value.bone_mass : null,
              water: value.body_moisture_mass > 0 ? value.body_moisture_mass : null,
              visceralFat: value.visceral_fat > 0 ? Math.round(value.visceral_fat) : null,
              date,
              sourceId,
              extraData: JSON.stringify({ raw: value }),
            },
            update: {
              weight: weightKg,
              bmi: value.bmi > 0 ? value.bmi : null,
              bodyFat: value.body_fat_rate > 0 ? value.body_fat_rate : null,
              muscleMass: value.muscle_mass > 0 ? value.muscle_mass : null,
              boneMass: value.bone_mass > 0 ? value.bone_mass : null,
              water: value.body_moisture_mass > 0 ? value.body_moisture_mass : null,
              visceralFat: value.visceral_fat > 0 ? Math.round(value.visceral_fat) : null,
            },
          })
          syncedRecords.weight++
        } catch (e: any) {
          errors.push({ type: 'weight', message: e.message })
        }
      }
    } catch (e: any) {
      errors.push({ type: 'weight', message: `体重同步失败: ${e.message}` })
    }

    // --- 同步其他聚合类型（calories/spo2/valid_stand/intensity/stress → exercise 表）---
    const otherAggTypes: Array<{ key: string; sourcePrefix: string; mapType: string }> = [
      { key: 'calories', sourcePrefix: 'miapi_cal', mapType: 'calories' },
      { key: 'spo2', sourcePrefix: 'miapi_spo2', mapType: 'spo2' },
      { key: 'valid_stand', sourcePrefix: 'miapi_stand', mapType: 'valid_stand' },
      { key: 'intensity', sourcePrefix: 'miapi_intensity', mapType: 'intensity' },
      { key: 'stress', sourcePrefix: 'miapi_stress', mapType: 'stress' },
    ]
    for (const { key, sourcePrefix, mapType } of otherAggTypes) {
      try {
        const list = await withRetry(() =>
          getAggregatedData(miToken, key, startTimeSec, endTimeSec),
        )
        for (const entry of list) {
          try {
            const value = parseAggValue(entry.value)
            const dateStr = toLocalDateStr(entry.time as number)
            const sourceId = `${sourcePrefix}_${dateStr}`

            await prisma.exercise.upsert({
              where: { date_sourceId: { date: new Date(dateStr), sourceId } },
              create: {
                userId,
                type: mapType,
                duration: value.duration || 0,
                caloriesBurned: value.calories ? Math.round(value.calories) : null,
                activities: JSON.stringify(value),
                date: new Date(dateStr),
                sourceId,
                extraData: JSON.stringify({ raw: value }),
              },
              update: {
                duration: value.duration || 0,
                caloriesBurned: value.calories ? Math.round(value.calories) : null,
                activities: JSON.stringify(value),
                extraData: JSON.stringify({ raw: value }),
              },
            })
            syncedRecords.exercise++
          } catch (e: any) {
            errors.push({ type: 'exercise', message: e.message })
          }
        }
      } catch (e: any) {
        errors.push({ type: 'exercise', message: `${mapType} 同步失败: ${e.message}` })
      }
    }

    return {
      success: errors.length === 0,
      syncedRecords,
      errors,
    }
  }
}
