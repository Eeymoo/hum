import crypto from 'crypto'
import type { AuthToken, SyncSource, SyncOptions, SyncResult, SyncError, ConfigField } from '../types'

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

/**
 * 发送健康 API GET 请求
 * 源码: FitnessApiService — @aib=@GET, @zkj=@Query
 * 参数通过 data=<URL-encoded JSON> 传递
 */
async function healthApiGet(
  token: MiApiToken,
  endpoint: string,
  params?: Record<string, any>,
): Promise<any> {
  const url = new URL(`/app/v1/${endpoint}`, HEALTH_BASE)
  if (params) {
    url.searchParams.set('data', JSON.stringify(params))
  }

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
  return parseMiResponse(text)
}

// ── 认证流程 ──────────────────────────────────────────────

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

  const sign = body.sign || ''
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
  const nonce = bodyA.nonce || 0
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
    console.error('[QR] 扫码响应异常, raw:', text.slice(0, 500))
    throw new Error(`扫码结果异常: code=${data.code} desc=${data.desc || data.message || '?'}`)
  }

  const ssecurity = data.ssecurity || ''
  const userId = data.userId || ''
  const passToken = data.passToken || ''
  const cUserId = data.cUserId || ''
  const location = data.location || ''
  const nonce = data.nonce || 0

  console.log('[QR] 扫码成功, userId:', userId, 'nonce:', nonce, 'location:', location ? '有' : '无', 'ssecurity:', ssecurity ? '有' : '无')

  if (!location || location === 'null') {
    console.error('[QR] 扫码响应完整数据:', JSON.stringify(data).slice(0, 1000))
    throw new Error('扫码响应缺少 location 字段')
  }
  if (!ssecurity) {
    console.error('[QR] 扫码响应完整数据:', JSON.stringify(data).slice(0, 1000))
    throw new Error('扫码响应缺少 ssecurity')
  }

  // Step 2b: 用 clientSign 跟随 location 获取 serviceToken
  const clientSign = computeClientSign(nonce, ssecurity)
  const stsUrl = new URL(location)
  stsUrl.searchParams.set('clientSign', clientSign)
  stsUrl.searchParams.set('_userIdNeedEncrypt', 'true')

  console.log('[QR] STS 请求:', stsUrl.toString().slice(0, 200))

  const respSts = await fetch(stsUrl.toString(), {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  // 调试：打印所有响应头
  const respHeaders: Record<string, string> = {}
  respSts.headers.forEach((v, k) => { respHeaders[k] = v })
  console.log('[QR] STS 响应 status:', respSts.status, 'headers:', JSON.stringify(respHeaders))

  let serviceToken = (respSts.headers.get(`${SID}_serviceToken`) || '').trim()
  if (!serviceToken) {
    serviceToken = (respSts.headers.get('serviceToken') || '').trim()
  }
  if (!serviceToken) {
    // 尝试从响应体中获取
    const stsBody = await respSts.text()
    console.error('[QR] STS 响应体:', stsBody.slice(0, 500))
    throw new Error('STS 响应 Header 缺少 serviceToken')
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
   * - 步数 → exercise 表
   * - 心率 → exercise 表（额外数据）
   * - 睡眠 → sleep 表
   * - 体重 → weight 表
   *
   * API 端点:
   * - GET /app/v1/data/get_project_data_by_time?data=<JSON>
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

    // 计算时间范围：默认最近 7 天
    const endDate = options.endDate || new Date()
    const startDate = options.startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    const startTime = startDate.getTime()
    const endTime = endDate.getTime()

    const { default: prisma } = await import('@/lib/prisma')

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
          return fn()
        }
        throw e
      }
    }

    // --- 同步步数数据 ---
    try {
      const stepsResp = await withRetry(() =>
        healthApiGet(miToken, 'data/get_project_data_by_time', {
          startTime,
          endTime,
          dataTypes: ['STEPS'],
        }),
      )

      const stepsData = stepsResp?.data
      if (stepsData?.STEPS?.items) {
        for (const item of stepsData.STEPS.items) {
          try {
            const date = new Date(item.startTime || item.time)
            const dateStr = date.toISOString().split('T')[0]
            const sourceId = `miapi_steps_${dateStr}`

            await prisma.exercise.upsert({
              where: { date_sourceId: { date: new Date(dateStr), sourceId } },
              create: {
                userId,
                type: 'steps',
                duration: 0,
                caloriesBurned: item.calories ? Math.round(item.calories) : null,
                activities: JSON.stringify({
                  steps: item.steps || item.value || 0,
                  distance: item.distance || 0,
                  goal: item.goal || 0,
                }),
                date: new Date(dateStr),
                sourceId,
                extraData: JSON.stringify({ raw: item }),
              },
              update: {
                caloriesBurned: item.calories ? Math.round(item.calories) : null,
                activities: JSON.stringify({
                  steps: item.steps || item.value || 0,
                  distance: item.distance || 0,
                  goal: item.goal || 0,
                }),
                extraData: JSON.stringify({ raw: item }),
              },
            })
            syncedRecords.exercise++
          } catch (e: any) {
            errors.push({ type: 'exercise', message: e.message })
          }
        }
      }
    } catch (e: any) {
      errors.push({ type: 'exercise', message: `步数同步失败: ${e.message}` })
    }

    // --- 同步心率数据 ---
    try {
      const hrResp = await withRetry(() =>
        healthApiGet(miToken, 'data/get_project_data_by_time', {
          startTime,
          endTime,
          dataTypes: ['HEART_RATE'],
        }),
      )

      const hrData = hrResp?.data
      if (hrData?.HEART_RATE?.items) {
        for (const item of hrData.HEART_RATE.items) {
          try {
            const date = new Date(item.startTime || item.time)
            const dateStr = date.toISOString().split('T')[0]
            const sourceId = `miapi_hr_${dateStr}`

            await prisma.exercise.upsert({
              where: { date_sourceId: { date: new Date(dateStr), sourceId } },
              create: {
                userId,
                type: 'heart_rate',
                duration: 0,
                caloriesBurned: null,
                activities: JSON.stringify({
                  avg: item.avgHr || item.heartRate || 0,
                  max: item.maxHr || 0,
                  min: item.minHr || 0,
                  resting: item.restingHr || null,
                }),
                date: new Date(dateStr),
                sourceId,
                extraData: JSON.stringify({ raw: item }),
              },
              update: {
                activities: JSON.stringify({
                  avg: item.avgHr || item.heartRate || 0,
                  max: item.maxHr || 0,
                  min: item.minHr || 0,
                  resting: item.restingHr || null,
                }),
                extraData: JSON.stringify({ raw: item }),
              },
            })
            syncedRecords.exercise++
          } catch (e: any) {
            errors.push({ type: 'exercise', message: e.message })
          }
        }
      }
    } catch (e: any) {
      errors.push({ type: 'exercise', message: `心率同步失败: ${e.message}` })
    }

    // --- 同步睡眠数据 ---
    try {
      const sleepResp = await withRetry(() =>
        healthApiGet(miToken, 'data/get_project_data_by_time', {
          startTime,
          endTime,
          dataTypes: ['SLEEP'],
        }),
      )

      const sleepData = sleepResp?.data
      if (sleepData?.SLEEP?.items) {
        for (const item of sleepData.SLEEP.items) {
          try {
            const date = new Date(item.startTime || item.time)
            const dateStr = date.toISOString().split('T')[0]
            const sourceId = `miapi_sleep_${dateStr}`

            const segments = item.segment_details || item.segments || []
            const firstBedtime = segments.length > 0 ? segments[0].bedtime : (item.startTime || item.time)
            const lastWakeTime = segments.length > 0
              ? segments[segments.length - 1].wake_up_time || segments[segments.length - 1].wakeTime
              : (item.endTime || item.time + (item.total_duration || 0) * 60)

            await prisma.sleep.upsert({
              where: { date_sourceId: { date: new Date(dateStr), sourceId } },
              create: {
                userId,
                duration: (item.total_duration || item.duration || 0) / 60,
                bedTime: new Date((typeof firstBedtime === 'number' ? firstBedtime * 1000 : firstBedtime)).toISOString(),
                wakeTime: new Date((typeof lastWakeTime === 'number' ? lastWakeTime * 1000 : lastWakeTime)).toISOString(),
                quality: item.sleep_score || item.score || 50,
                deepSleep: item.deep_duration ? item.deep_duration / 60 : (item.sleep_deep_duration ? item.sleep_deep_duration / 60 : null),
                remSleep: item.rem_duration ? item.rem_duration / 60 : (item.sleep_rem_duration ? item.sleep_rem_duration / 60 : null),
                awakenings: item.awake_duration ? Math.round(item.awake_duration) : null,
                date: new Date(dateStr),
                sourceId,
                extraData: JSON.stringify({
                  sleepScore: item.sleep_score || item.score,
                  raw: item,
                }),
              },
              update: {
                duration: (item.total_duration || item.duration || 0) / 60,
                quality: item.sleep_score || item.score || 50,
                deepSleep: item.deep_duration ? item.deep_duration / 60 : (item.sleep_deep_duration ? item.sleep_deep_duration / 60 : null),
                remSleep: item.rem_duration ? item.rem_duration / 60 : (item.sleep_rem_duration ? item.sleep_rem_duration / 60 : null),
              },
            })
            syncedRecords.sleep++
          } catch (e: any) {
            errors.push({ type: 'sleep', message: e.message })
          }
        }
      }
    } catch (e: any) {
      errors.push({ type: 'sleep', message: `睡眠同步失败: ${e.message}` })
    }

    // --- 同步体重数据 ---
    try {
      const weightResp = await withRetry(() =>
        healthApiGet(miToken, 'data/get_project_data_by_time', {
          startTime,
          endTime,
          dataTypes: ['WEIGHT'],
        }),
      )

      const weightData = weightResp?.data
      if (weightData?.WEIGHT?.items) {
        for (const item of weightData.WEIGHT.items) {
          try {
            const date = new Date(item.startTime || item.time)
            const dateStr = date.toISOString().split('T')[0]
            const sourceId = `miapi_weight_${dateStr}`

            await prisma.weight.upsert({
              where: { date_sourceId: { date: new Date(dateStr), sourceId } },
              create: {
                userId,
                weight: item.weight || item.value || 0,
                bmi: item.bmi || null,
                date: new Date(dateStr),
                sourceId,
                extraData: JSON.stringify({ raw: item }),
              },
              update: {
                weight: item.weight || item.value || 0,
                bmi: item.bmi || null,
              },
            })
            syncedRecords.weight++
          } catch (e: any) {
            errors.push({ type: 'weight', message: e.message })
          }
        }
      }
    } catch (e: any) {
      errors.push({ type: 'weight', message: `体重同步失败: ${e.message}` })
    }

    return {
      success: errors.length === 0,
      syncedRecords,
      errors,
    }
  }
}
