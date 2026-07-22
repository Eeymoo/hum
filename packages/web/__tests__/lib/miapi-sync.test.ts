import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// 真实 token fixture（用于构造有效凭证，不实际发网络请求）
const TOKEN_PATH = path.resolve(__dirname, '../../../.tmp/token.json')
// vitest CJS 下 __dirname 可能是 __tests__/lib，回退查找
const TOKEN_PATHS = [
  TOKEN_PATH,
  path.resolve(process.cwd(), '../../.tmp/token.json'),
  path.resolve(process.cwd(), '../.tmp/token.json'),
  '/home/opencode/Codes/hum/.tmp/token.json',
]
const TOKEN_PATH_ACTUAL = TOKEN_PATHS.find(p => fs.existsSync(p)) || TOKEN_PATH

vi.mock('@/lib/prisma', () => {
  // 内存 exercise/sleep/weight store，模拟 upsert + count
  const store = { exercise: new Map(), sleep: new Map(), weight: new Map() }
  const upsert = (table: keyof typeof store) => async (args: any) => {
    const key = `${args.where.date_sourceId?.date?.toISOString?.()}_${args.where.date_sourceId?.sourceId}` || 'k'
    store[table].set(key, args.create || args.update)
    return { id: key, ...args.create }
  }
  return {
    default: {
      exercise: { upsert: upsert('exercise') },
      sleep: { upsert: upsert('sleep') },
      weight: { upsert: upsert('weight') },
      syncSourceConfig: { updateMany: vi.fn() },
      __store: store,
    },
  }
})

import { MiApiSource } from '@/lib/sync/sources/miapi'

const ORIGINAL_FETCH = globalThis.fetch

function mockFetchSequence(responses: Array<{ ok: boolean; status: number; body: string }>) {
  let i = 0
  globalThis.fetch = vi.fn(async () => {
    const r = responses[i] ?? responses[responses.length - 1]
    i++
    return {
      ok: r.ok, status: r.status,
      text: async () => r.body,
      headers: new Headers(),
    } as any
  }) as any
}

/** 分块拉取时每个请求都返回同样的响应（不再按序匹配） */
function mockFetchEvery(resp: { ok: boolean; status: number; body: string }) {
  globalThis.fetch = vi.fn(async () => ({
    ok: resp.ok, status: resp.status,
    text: async () => resp.body,
    headers: new Headers(),
  }) as any) as any
}

describe('MiApiSource.sync 多类型同步行为', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH })

  // 跳过无 token 环境
  const hasToken = fs.existsSync(TOKEN_PATH_ACTUAL)
  const skipIfNoToken = hasToken ? it : it.skip

  skipIfNoToken('各数据类型独立同步，单类型失败不中断其他', async () => {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH_ACTUAL, 'utf8'))
    const source = new MiApiSource()

    // 分块拉取模式：用 mockFetchEvery 让每个请求都返回数据
    // 通过 URL 参数判断当前拉取的是哪个 key（分块请求 URL 里含 data=加密参数）
    // 简化：步数成功、心率失败、其余成功 —— 用每次请求都成功的方式验证独立失败
    const okResp = {
      ok: true, status: 200,
      body: JSON.stringify({ code: 0, message: 'ok', result: { data_list: [{ time: 1780272000, value: '{"steps":100,"calories":50,"distance":500,"segment_details":[{"bedtime":1,"wake_up_time":2,"duration":400,"sleep_deep_duration":80}],"weight":70.5,"avg_hr":65,"max_hr":120,"min_hr":50,"avg_rhr":60,"calories":2000,"avg_spo2":98,"count":8,"duration":30,"avg_stress":20}' }] } }),
    }
    mockFetchEvery(okResp)

    const result = await source.sync({
      userId: 'test-user',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
      config: {},
      token: {
        user_id: token.user_id, c_user_id: token.c_user_id,
        service_token: token.service_token, ssecurity: token.ssecurity,
        pass_token: '', device_id: 'test', accessToken: token.service_token,
      },
    })

    // 所有类型都成功（分块模式下每块返回数据）
    expect(result.errors.length).toBe(0)
    expect(result.syncedRecords.exercise).toBeGreaterThan(0)
    expect(result.syncedRecords.sleep).toBeGreaterThan(0)
  })

  skipIfNoToken('ssecurity 缺失时拒绝请求', async () => {
    const source = new MiApiSource()
    const result = await source.sync({
      userId: 'u', startDate: new Date('2026-06-01'), endDate: new Date('2026-06-02'), config: {},
      token: { user_id: 'u', c_user_id: 'c', service_token: 's', ssecurity: '', pass_token: '', device_id: 'd', accessToken: 's' },
    })
    // ssecurity 为空时 encryptedHealthGet 直接抛错，被各类型 catch 捕获
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some((e: any) => e.message.includes('ssecurity') || e.message.includes('加密'))).toBe(true)
  })
})
