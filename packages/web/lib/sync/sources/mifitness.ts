import crypto from 'crypto'
import type { AuthToken, SyncSource, SyncOptions, SyncResult, SyncError, ConfigField } from '../types'
import { MiCrypto } from './mifitness-crypto'

// ============================================================
// MiFitnessSource - 小米运动健康数据源实现
//
// 扩展说明：新增数据源时，只需实现 SyncSource 接口，
// 并在 registry.ts 的 registerBuiltinSources() 中注册即可。
// 无需修改 SyncEngine、cron 调度器或前端配置页面。
// ============================================================

/** 小米 API 认证 Token 结构 */
interface MiAuthToken {
  user_id: string
  c_user_id: string
  service_token: string
  ssecurity: string
  pass_token: string
  device_id: string
}

/** 聚合数据项 */
interface AggregatedDataItem {
  sid: string
  tag: string
  key: string
  time: number
  value: string
  update_time: number
  watermark: string
  source_sid_list: string[]
}

const DEFAULT_BASE_URL = 'https://ru.hlth.io.mi.com'
const USER_AGENT = 'Android-12-3.53.1-vivo-V2284A'
const REGION_TAG = 'ru'

/** 数据类型常量 */
const DATA_TYPES = {
  HEART_RATE: 'heart_rate',
  SLEEP: 'sleep',
  STEPS: 'steps',
  CALORIES: 'calories',
  WEIGHT: 'weight',
} as const

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
 * 从长轮询响应中提取凭证
 */
function extractCredentials(data: any): MiAuthToken {
  return {
    user_id: String(data.userId || data.user_id || ''),
    c_user_id: String(data.cUserId || data.c_user_id || ''),
    service_token: String(data.serviceToken || data.service_token || ''),
    ssecurity: String(data.ssecurity || ''),
    pass_token: String(data.passToken || data.pass_token || ''),
    device_id: `an_${crypto.randomBytes(16).toString('hex')}`,
  }
}

/**
 * 发送加密 API 请求
 */
async function encryptedRequest(
  miCrypto: MiCrypto,
  token: MiAuthToken,
  method: string,
  path: string,
  baseUrl: string,
  params?: Record<string, any>,
): Promise<any> {
  if (!token.service_token || !token.ssecurity) {
    throw new Error('未登录：缺少 serviceToken 或 ssecurity')
  }

  const signingPath = path === '/healthapp/service/gen_download_url'
    ? '/service/gen_download_url'
    : path

  const { params: encParams, signature, _nonce } = miCrypto.buildEncryptedParams(
    method.toUpperCase(),
    signingPath,
    params,
  )

  const url = baseUrl.replace(/\/$/, '') + path
  const cookieStr = `cUserId=${token.c_user_id}; serviceToken=${token.service_token}`

  const fetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: {
      'User-Agent': USER_AGENT,
      'Cookie': cookieStr,
      'region_tag': REGION_TAG,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }

  if (method.toUpperCase() === 'GET') {
    const qs = new URLSearchParams({ ...encParams, signature }).toString()
    const resp = await fetch(`${url}?${qs}`, fetchOptions)
    const text = await resp.text()
    return miCrypto.decryptResponse(_nonce, text)
  } else {
    const body = new URLSearchParams({ ...encParams, signature }).toString()
    const resp = await fetch(url, { ...fetchOptions, body })
    const text = await resp.text()
    return miCrypto.decryptResponse(_nonce, text)
  }
}

/**
 * MiFitnessSource - 小米运动健康数据源
 *
 * 支持功能：
 * - 二维码扫码登录（分步异步流程）
 * - 同步步数、睡眠、体重数据
 * - 按 date + sourceId 唯一约束去重，保证幂等性
 * - 支持 baseUrl 覆盖
 */
export class MiFitnessSource implements SyncSource {
  id = 'mifitness'
  name = '小米运动健康'
  description = '从小米运动健康（MiFitness）同步步数、睡眠、体重等健康数据'

  configSchema: ConfigField[] = [
    {
      key: 'baseUrl',
      label: 'API 基础 URL',
      type: 'text',
      placeholder: DEFAULT_BASE_URL,
      defaultValue: DEFAULT_BASE_URL,
      required: false,
    },
    {
      key: 'targetUid',
      label: '亲友 UID',
      type: 'text',
      placeholder: '从小米运动健康 App 添加亲友后获取',
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
   * 二维码扫码登录
   *
   * credentials 参数支持两种模式：
   * 1. 无参数 → 获取二维码（返回 { qrUrl, longPollingUrl } 存入 token）
   * 2. { longPollingUrl, ... } → 长轮询等待扫码结果
   *
   * 注意：此方法由 API Route 分步调用，避免 5 分钟超时问题。
   */
  async authenticate(credentials: Record<string, unknown>): Promise<AuthToken> {
    const longPollingUrl = credentials.longPollingUrl as string | undefined

    // Step 2: 已有 longPollingUrl，执行长轮询等待扫码
    if (longPollingUrl) {
      return this.pollForCredentials(longPollingUrl)
    }

    // Step 1: 获取二维码
    return this.getQrCode()
  }

  /**
   * 获取二维码 URL
   */
  private async getQrCode(): Promise<AuthToken> {
    const qrParams = new URLSearchParams({
      _qrsize: '480',
      qs: '%3Fsid%3Dmiothealth%26_json%3Dtrue',
      callback: 'https://sts-hlth.io.mi.com/healthapp/sts',
      _hasLogo: 'false',
      sid: 'miothealth',
      serviceParam: '',
      _locale: 'zh_CN',
      _dc: String(Date.now()),
    })

    const qrResp = await fetch(
      `https://account.xiaomi.com/longPolling/loginUrl?${qrParams.toString()}`,
    )
    const qrText = await qrResp.text()
    const qrData = parseMiResponse(qrText)

    const qrImageUrl = qrData.qr as string
    const lpUrl = qrData.lp as string

    if (!qrImageUrl || !lpUrl) {
      throw new Error('获取二维码失败')
    }

    // 返回二维码信息（不是最终 token），前端拿到后展示二维码并轮询
    return {
      qrUrl: qrImageUrl,
      longPollingUrl: lpUrl,
    }
  }

  /**
   * 长轮询等待用户扫码并提取凭证
   */
  private async pollForCredentials(longPollingUrl: string): Promise<AuthToken> {
    const pollResp = await fetch(longPollingUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5 * 60 * 1000),
    })
    const pollText = await pollResp.text()
    const pollData = parseMiResponse(pollText)

    if (!pollData.ssecurity) {
      throw new Error('登录失败：未获取到凭证，请重试')
    }

    // 提取凭证
    const miToken = extractCredentials(pollData)

    // 跟随 location 重定向获取 serviceToken
    if (pollData.location && miToken.ssecurity) {
      try {
        const signText = `nonce=${pollData.nonce}&${miToken.ssecurity}`
        const sha1Digest = crypto.createHash('sha1').update(signText).digest()
        const clientSign = encodeURIComponent(sha1Digest.toString('base64'))
        const fullUrl = `${pollData.location}&clientSign=${clientSign}`

        const redirResp = await fetch(fullUrl, {
          redirect: 'manual',
          headers: { 'User-Agent': USER_AGENT },
        })
        const setCookie = redirResp.headers.get('set-cookie') || ''
        const stMatch = setCookie.match(/serviceToken=([^;]+)/)
        if (stMatch) {
          miToken.service_token = stMatch[1]
        }
      } catch {
        // 重定向失败，使用已有值
      }
    }

    return {
      ...miToken,
      accessToken: miToken.service_token,
    }
  }

  /**
   * 同步健康数据
   *
   * 支持同步的数据类型：
   * - 步数/卡路里 → exercise 表
   * - 睡眠 → sleep 表
   * - 体重 → weight 表
   *
   * 使用 Prisma @@unique([date, sourceId]) 约束 + upsert 保证幂等性：
   * - 首次同步：创建新记录
   * - 重复同步：更新已有记录（如数据源修正了数据）
   */
  async sync(options: SyncOptions): Promise<SyncResult> {
    const { userId, config, token } = options
    const baseUrl = (config.baseUrl as string) || DEFAULT_BASE_URL
    const targetUid = parseInt(String(config.targetUid), 10)

    if (!targetUid) {
      return {
        success: false,
        syncedRecords: { exercise: 0, sleep: 0, weight: 0, diet: 0 },
        errors: [{ type: 'config', message: '缺少 targetUid 配置' }],
      }
    }

    const miToken: MiAuthToken = {
      user_id: String(token.user_id || ''),
      c_user_id: String(token.c_user_id || ''),
      service_token: String(token.service_token || token.accessToken || ''),
      ssecurity: String(token.ssecurity || ''),
      pass_token: String(token.pass_token || ''),
      device_id: String(token.device_id || `an_${crypto.randomBytes(16).toString('hex')}`),
    }

    if (!miToken.ssecurity || !miToken.service_token) {
      return {
        success: false,
        syncedRecords: { exercise: 0, sleep: 0, weight: 0, diet: 0 },
        errors: [{ type: 'auth', message: '认证凭证无效，请重新登录' }],
      }
    }

    const miCrypto = new MiCrypto(miToken.ssecurity)
    const errors: SyncError[] = []
    const syncedRecords = { exercise: 0, sleep: 0, weight: 0, diet: 0 }

    // 计算时间范围：默认最近 7 天
    const endDate = options.endDate || new Date()
    const startDate = options.startDate || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    const startTime = Math.floor(startDate.getTime() / 1000)
    const endTime = Math.floor(endDate.getTime() / 1000)

    const { default: prisma } = await import('@/lib/prisma')

    // --- 同步步数/运动数据 ---
    try {
      const stepsResp = await encryptedRequest(
        miCrypto, miToken, 'GET',
        '/app/v1/data/get_aggregated_fitness_data_by_time',
        baseUrl,
        {
          relative_uid: targetUid,
          key: DATA_TYPES.STEPS,
          tag: 'daily_report',
          start_time: startTime,
          end_time: endTime,
          limit: 30,
        },
      )

      const stepsItems: AggregatedDataItem[] = stepsResp?.result?.data?.items ||
        stepsResp?.result?.items || []

      for (const item of stepsItems) {
        try {
          const stepData = typeof item.value === 'string' ? JSON.parse(item.value) : item.value
          const date = new Date(item.time * 1000)
          const dateStr = date.toISOString().split('T')[0]
          const sourceId = `mifitness_steps_${item.time}`

          await prisma.exercise.upsert({
            where: { date_sourceId: { date: new Date(dateStr), sourceId } },
            create: {
              userId,
              type: 'steps',
              duration: 0,
              caloriesBurned: stepData.calories ? Math.round(stepData.calories) : null,
              activities: JSON.stringify({
                steps: stepData.steps || 0,
                distance: stepData.distance || 0,
                goal: stepData.goal || 0,
              }),
              date: new Date(dateStr),
              sourceId,
              extraData: JSON.stringify({ raw: stepData }),
            },
            update: {
              caloriesBurned: stepData.calories ? Math.round(stepData.calories) : null,
              activities: JSON.stringify({
                steps: stepData.steps || 0,
                distance: stepData.distance || 0,
                goal: stepData.goal || 0,
              }),
              extraData: JSON.stringify({ raw: stepData }),
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

    // --- 同步睡眠数据 ---
    try {
      const sleepResp = await encryptedRequest(
        miCrypto, miToken, 'GET',
        '/app/v1/data/get_aggregated_fitness_data_by_time',
        baseUrl,
        {
          relative_uid: targetUid,
          key: DATA_TYPES.SLEEP,
          tag: 'daily_report',
          start_time: startTime,
          end_time: endTime,
          limit: 30,
        },
      )

      const sleepItems: AggregatedDataItem[] = sleepResp?.result?.data?.items ||
        sleepResp?.result?.items || []

      for (const item of sleepItems) {
        try {
          const sleepData = typeof item.value === 'string' ? JSON.parse(item.value) : item.value
          const date = new Date(item.time * 1000)
          const dateStr = date.toISOString().split('T')[0]
          const sourceId = `mifitness_sleep_${item.time}`

          const segments = sleepData.segment_details || []
          const firstBedtime = segments.length > 0 ? segments[0].bedtime : item.time
          const lastWakeTime = segments.length > 0
            ? segments[segments.length - 1].wake_up_time
            : item.time + (sleepData.total_duration || 0) * 60

          await prisma.sleep.upsert({
            where: { date_sourceId: { date: new Date(dateStr), sourceId } },
            create: {
              userId,
              duration: (sleepData.total_duration || 0) / 60,
              bedTime: new Date(firstBedtime * 1000).toISOString(),
              wakeTime: new Date(lastWakeTime * 1000).toISOString(),
              quality: sleepData.sleep_score || 50,
              deepSleep: sleepData.sleep_deep_duration ? sleepData.sleep_deep_duration / 60 : null,
              remSleep: sleepData.sleep_rem_duration ? sleepData.sleep_rem_duration / 60 : null,
              awakenings: sleepData.sleep_awake_duration ? Math.round(sleepData.sleep_awake_duration) : null,
              date: new Date(dateStr),
              sourceId,
              extraData: JSON.stringify({
                sleepScore: sleepData.sleep_score,
                avgHr: sleepData.avg_hr,
                maxHr: sleepData.max_hr,
                minHr: sleepData.min_hr,
                raw: sleepData,
              }),
            },
            update: {
              duration: (sleepData.total_duration || 0) / 60,
              quality: sleepData.sleep_score || 50,
              deepSleep: sleepData.sleep_deep_duration ? sleepData.sleep_deep_duration / 60 : null,
              remSleep: sleepData.sleep_rem_duration ? sleepData.sleep_rem_duration / 60 : null,
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

    // --- 同步体重数据 ---
    try {
      const weightResp = await encryptedRequest(
        miCrypto, miToken, 'GET',
        '/app/v1/data/get_fitness_data_by_time',
        baseUrl,
        {
          relative_uid: targetUid,
          key: DATA_TYPES.WEIGHT,
          start_time: startTime,
          end_time: endTime,
          limit: 30,
        },
      )

      const weightItems: AggregatedDataItem[] = weightResp?.result?.data?.items ||
        weightResp?.result?.items || []

      for (const item of weightItems) {
        try {
          const weightData = typeof item.value === 'string' ? JSON.parse(item.value) : item.value
          const date = new Date(item.time * 1000)
          const dateStr = date.toISOString().split('T')[0]
          const sourceId = `mifitness_weight_${item.time}`

          await prisma.weight.upsert({
            where: { date_sourceId: { date: new Date(dateStr), sourceId } },
            create: {
              userId,
              weight: weightData.weight || 0,
              bmi: weightData.bmi || null,
              date: new Date(dateStr),
              sourceId,
              extraData: JSON.stringify({ raw: weightData }),
            },
            update: {
              weight: weightData.weight || 0,
              bmi: weightData.bmi || null,
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

    return {
      success: errors.length === 0,
      syncedRecords,
      errors,
    }
  }
}
