import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    sleep: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getAuth: vi.fn(),
}))

import { GET } from '@/app/api/v1/sleeps/calendar/route'
import prisma from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

const mockGetAuth = vi.mocked(getAuth)
const mockFindMany = vi.mocked(prisma.sleep.findMany)

function createRequest(year?: number) {
  const url = year
    ? `http://localhost:3000/api/v1/sleeps/calendar?year=${year}`
    : 'http://localhost:3000/api/v1/sleeps/calendar'
  return {
    nextUrl: new URL(url),
    headers: new Headers(),
  } as any
}

// 生成睡眠记录（日期 + wakeTime + duration）
function makeSleep(dateStr: string, wakeTime: string, duration = 7) {
  return { date: new Date(dateStr), wakeTime, duration, deleteAt: 0 }
}

describe('GET /api/v1/sleeps/calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuth.mockResolvedValue({ userId: 'user-1' } as any)
  })

  it('未登录时返回 401', async () => {
    mockGetAuth.mockResolvedValue(null as any)

    const res = await GET(createRequest(2026))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('无效 year 参数返回 400', async () => {
    const res = await GET(createRequest('abc' as any))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid year parameter' })
  })

  it('无睡眠记录时返回空数据', async () => {
    mockFindMany.mockResolvedValue([])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
    expect(json.summary.totalRecords).toBe(0)
    expect(json.summary.avgScore).toBeNull()
  })

  it('仅 1 条记录时首日评分为 null', async () => {
    // 2026-01-05 是周一
    mockFindMany.mockResolvedValue([makeSleep('2026-01-05', '07:00')])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    expect(json.data).toEqual([['2026-01-05', null, 7]])
    expect(json.summary.avgScore).toBeNull()
  })

  it('第 2 天起开始计算评分', async () => {
    // 2026-01-05 周一 wakeTime=07:00, 2026-01-06 周二 wakeTime=07:00
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '07:00'),
      makeSleep('2026-01-06', '07:00'),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // 第 1 天: null（忽略首日）
    expect(json.data[0]).toEqual(['2026-01-05', null, 7])
    // 第 2 天: 窗口内有 [01-06(二), 01-05(一)]，全是工作日 → null
    expect(json.data[1][0]).toBe('2026-01-06')
    expect(json.data[1][1]).toBeNull()
  })

  it('窗口内同时有工作日和周末时正确计算评分', async () => {
    // 2026-01-05 周一 07:00, 2026-01-10 周六 09:00
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '07:00'),
      makeSleep('2026-01-10', '09:00'),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // 第 1 天: null
    expect(json.data[0][1]).toBeNull()
    // 第 2 天: weekday=7.0, weekend=9.0, diff=2.0, score=7-2=5.0
    expect(json.data[1][1]).toBe(5.0)
  })

  it('滚动窗口至多 7 个有效数据日', async () => {
    // 构造 10 天数据，验证第 8~10 天的窗口只含 7 条
    const sleeps = [
      makeSleep('2026-01-05', '07:00'), // 周一
      makeSleep('2026-01-06', '07:00'), // 周二
      makeSleep('2026-01-07', '07:00'), // 周三
      makeSleep('2026-01-08', '07:00'), // 周四
      makeSleep('2026-01-09', '07:00'), // 周五
      makeSleep('2026-01-10', '09:00'), // 周六
      makeSleep('2026-01-11', '09:00'), // 周日
      makeSleep('2026-01-12', '07:00'), // 周一
      makeSleep('2026-01-13', '07:00'), // 周二
      makeSleep('2026-01-14', '07:00'), // 周三
    ]
    mockFindMany.mockResolvedValue(sleeps)

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // 第 1 天 (01-05): null
    expect(json.data[0][1]).toBeNull()

    // 第 7 天 (01-11): 窗口 7 条 [01-11..01-05]
    // weekday: 07:00 × 5 = 7.0, weekend: 09:00 × 2 = 9.0
    // diff=2.0, score=5.0
    expect(json.data[6][1]).toBe(5.0)

    // 第 8 天 (01-12): 窗口 7 条 [01-12..01-06]，已排除了 01-05
    // weekday: 07:00 × 5 (06,07,08,09,12) = 7.0
    // weekend: 09:00 × 2 (10,11) = 9.0
    // diff=2.0, score=5.0
    expect(json.data[7][1]).toBe(5.0)

    // 第 10 天 (01-14): 窗口 7 条 [01-14..01-08]，已排除了 01-05~07
    // weekday: 07:00 × 5 (08,09,12,13,14) = 7.0
    // weekend: 09:00 × 2 (10,11) = 9.0
    // diff=2.0, score=5.0
    expect(json.data[9][1]).toBe(5.0)

    expect(json.data.length).toBe(10)
  })

  it('完全一致的工作日/周末起床时间评分 7.0', async () => {
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '07:00'), // 周一
      makeSleep('2026-01-10', '07:00'), // 周六
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    expect(json.data[1][1]).toBe(7.0)
  })

  it('差值超过 7 时评分截断为 0', async () => {
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '05:00'), // 周一 5:00
      makeSleep('2026-01-10', '20:00'), // 周六 20:00
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // diff = |5.0 - 20.0| = 15.0, 7 - 15 = -8 → max(0, ...) = 0
    expect(json.data[1][1]).toBe(0)
  })

  it('评分精确到 1 位小数', async () => {
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '07:00'), // 周一 7:00
      makeSleep('2026-01-10', '08:15'), // 周六 8.25
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // diff = |7.0 - 8.25| = 1.25, 7 - 1.25 = 5.75 → round(5.75*10)/10 = 5.8
    expect(json.data[1][1]).toBe(5.8)
  })

  it('同一天多条记录取 duration 最大的一条', async () => {
    mockFindMany.mockResolvedValue([
      { date: new Date('2026-01-05'), wakeTime: '07:00', duration: 6, deleteAt: 0 },
      { date: new Date('2026-01-05'), wakeTime: '08:00', duration: 8, deleteAt: 0 },
      makeSleep('2026-01-10', '09:00'),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // 同一天取 duration=8 的那条，wakeTime=08:00
    // weekday: 08:00 = 8.0, weekend: 09:00 = 9.0
    // diff=1.0, score=6.0
    expect(json.data[0][2]).toBe(8) // duration 取最大的
    expect(json.data[1][1]).toBe(6.0) // 用 wakeTime=08:00 计算
  })

  it('仅返回当年数据，回溯数据用于评分但不显示', async () => {
    mockFindMany.mockResolvedValue([
      makeSleep('2025-12-30', '07:00'), // 周二（上一年）
      makeSleep('2026-01-03', '09:00'), // 周六
      makeSleep('2026-01-05', '07:00'), // 周一
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // 只返回 2026 年数据，2025-12-30 不在结果中
    expect(json.data.length).toBe(2)
    expect(json.data[0][0]).toBe('2026-01-03')
    expect(json.data[1][0]).toBe('2026-01-05')

    // 2026-01-03 是当年首日记录，但全局 i=1（不是首条），所以有评分
    // 窗口 [01-03, 12-30]: weekday=7.0, weekend=9.0, diff=2.0, score=5.0
    expect(json.data[0][1]).toBe(5.0)
  })

  it('avgScore 为当年所有有效评分的平均值', async () => {
    // 01-05 周一 07:00, 01-10 周六 09:00, 01-12 周一 07:00
    // 01-12 的窗口 [01-12(一), 01-10(六), 01-05(一)]
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '07:00'),
      makeSleep('2026-01-10', '09:00'),
      makeSleep('2026-01-12', '07:00'),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // 第 1 天: null
    // 第 2 天: score=5.0
    // 第 3 天: weekday=7.0, weekend=9.0, score=5.0
    const scores = json.data.map((d: any) => d[1]).filter((s: any) => s !== null)
    const expectedAvg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length * 10) / 10

    expect(json.summary.avgScore).toBe(expectedAvg)
    expect(json.summary.totalRecords).toBe(3)
  })

  it('数据库异常返回 500', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'))

    const res = await GET(createRequest(2026))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})
