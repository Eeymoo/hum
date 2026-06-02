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

// Helper: create a sleep record
function makeSleep(dateStr: string, bed: string, wake: string, duration = 7) {
  return {
    date: new Date(dateStr),
    bedTime: bed,
    wakeTime: wake,
    duration,
    deleteAt: 0
  }
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

  it('仅 1 条记录时无历史评分', async () => {
    mockFindMany.mockResolvedValue([makeSleep('2026-01-05', '23:00', '07:00', 8)])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    expect(json.data.length).toBe(1)
    expect(json.data[0].score).toBeNull()
    expect(json.data[0].color).toBe('#e5e7eb')
  })

  it('历史有效日不足 2 天时不计算评分', async () => {
    // Day 1: no history → null
    // Day 2: history = 1 → still null
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '23:00', '07:00', 8),
      makeSleep('2026-01-06', '23:30', '07:30', 8),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    expect(json.data[0].score).toBeNull()
    expect(json.data[1].score).toBeNull()
  })

  it('历史有效日 ≥ 2 天时计算评分', async () => {
    // Day 1: null
    // Day 2: history = 1 → null
    // Day 3: history = 2 → has score
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '23:00', '07:00', 8),
      makeSleep('2026-01-06', '23:00', '07:00', 8),
      makeSleep('2026-01-07', '23:00', '07:00', 8),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    expect(json.data[0].score).toBeNull()
    expect(json.data[1].score).toBeNull()
    // Day 3: all same bed/wake → total_dev = 0 → score = 100
    expect(json.data[2].score).toBe(100)
    expect(json.data[2].devMinutes).toBe(0)
  })

  it('完全一致的睡眠时间评分 100', async () => {
    const sleeps = [
      makeSleep('2026-01-05', '23:00', '07:00', 8),
      makeSleep('2026-01-06', '23:00', '07:00', 8),
      makeSleep('2026-01-07', '23:00', '07:00', 8),
    ]
    mockFindMany.mockResolvedValue(sleeps)

    const res = await GET(createRequest(2026))
    const json = await res.json()

    expect(json.data[2].score).toBe(100)
    expect(json.data[2].devMinutes).toBe(0)
    expect(json.data[2].color).toBe('#16a34a')
  })

  it('偏差超过 60 分钟时评分截断为 0', async () => {
    // History: bed=23:00(1380), wake=07:00(420)
    // Current: bed=12:00(720), wake=20:00(1200)
    // devBed = circularDiff(720, 1380) = min(660, 780) = 660
    // devWake = circularDiff(1200, 420) = min(780, 660) = 660
    // totalDev = 660 → score = max(0, 100 - 660*1.67) = 0
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '23:00', '07:00', 8),
      makeSleep('2026-01-06', '23:00', '07:00', 8),
      makeSleep('2026-01-07', '12:00', '20:00', 8),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    expect(json.data[2].score).toBe(0)
    expect(json.data[2].color).toBe('#ef4444')
  })

  it('评分精确到 1 位小数', async () => {
    // History: 23:00(1380), wake=07:00(420) × 2
    // Current: bed=23:30(1410), wake=07:15(435)
    // avgBed = 1380, avgWake = 420
    // devBed = circularDiff(1410, 1380) = 30
    // devWake = circularDiff(435, 420) = 15
    // totalDev = (30+15)/2 = 22.5
    // score = max(0, 100 - 22.5*1.67) = 100 - 37.575 = 62.425 → round to 62.4
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '23:00', '07:00', 8),
      makeSleep('2026-01-06', '23:00', '07:00', 8),
      makeSleep('2026-01-07', '23:30', '07:15', 8),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // 62.4 rounded to 1 decimal
    expect(json.data[2].score).toBe(62.4)
  })

  it('同一天多条记录取 >4h 最长段作为基准', async () => {
    mockFindMany.mockResolvedValue([
      // Same day: short nap + main sleep
      { date: new Date('2026-01-05'), bedTime: '18:00', wakeTime: '20:00', duration: 2, deleteAt: 0 },
      { date: new Date('2026-01-05'), bedTime: '23:00', wakeTime: '07:00', duration: 8, deleteAt: 0 },
      makeSleep('2026-01-06', '23:00', '07:00', 8),
      makeSleep('2026-01-07', '23:00', '07:00', 8),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // Day 1 should use the 8h segment (bed=23:00, wake=07:00), not the 2h one
    expect(json.data[0].bed).toBe('23:00')
    expect(json.data[0].wake).toBe('07:00')
  })

  it('所有段 ≤ 4h 时 fallback 取最长段', async () => {
    mockFindMany.mockResolvedValue([
      // All segments ≤ 4h; 3h is the longest
      { date: new Date('2026-01-05'), bedTime: '13:00', wakeTime: '14:00', duration: 1, deleteAt: 0 },
      { date: new Date('2026-01-05'), bedTime: '18:00', wakeTime: '21:00', duration: 3, deleteAt: 0 },
      makeSleep('2026-01-06', '22:00', '06:00', 8),
      makeSleep('2026-01-07', '22:00', '06:00', 8),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // Should use the 3h segment (bed=18:00, wake=21:00)
    expect(json.data[0].bed).toBe('18:00')
    expect(json.data[0].wake).toBe('21:00')
  })

  it('滚动窗口至多 7 个有效历史日', async () => {
    // 10 days of consistent data
    const sleeps = Array.from({ length: 10 }, (_, i) =>
      makeSleep(`2026-01-${String(5 + i).padStart(2, '0')}`, '23:00', '07:00', 8)
    )
    mockFindMany.mockResolvedValue(sleeps)

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // Day 10 (01-14): history window = [01-13 .. 01-07] = 7 days
    // All same bed/wake → score = 100
    expect(json.data[9].score).toBe(100)
    expect(json.data[9].devMinutes).toBe(0)
  })

  it('bedTime/wakeTime 为 ISO 8601 格式时正确解析', async () => {
    mockFindMany.mockResolvedValue([
      { date: new Date('2026-01-05'), bedTime: '2026-01-05T23:00:00+08:00', wakeTime: '2026-01-06T07:00:00+08:00', duration: 8, deleteAt: 0 },
      { date: new Date('2026-01-06'), bedTime: '2026-01-06T23:00:00+08:00', wakeTime: '2026-01-07T07:00:00+08:00', duration: 8, deleteAt: 0 },
      { date: new Date('2026-01-07'), bedTime: '23:00', wakeTime: '07:00', duration: 8, deleteAt: 0 },
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // All same times → score = 100
    expect(json.data[2].score).toBe(100)
    expect(json.data[2].bed).toBe('23:00')
    expect(json.data[2].wake).toBe('07:00')
  })

  it('环形偏差正确处理跨午夜时间', async () => {
    // History: bed=23:50(1430), wake=07:10(430)
    // Current: bed=00:10(10), wake=06:50(410)
    // devBed = circularDiff(10, 1430) = min(1420, 20) = 20
    // devWake = circularDiff(410, 430) = 20
    // totalDev = (20+20)/2 = 20
    // score = max(0, 100 - 20*1.67) = 100 - 33.4 = 66.6
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '23:50', '07:10', 8),
      makeSleep('2026-01-06', '23:50', '07:10', 8),
      makeSleep('2026-01-07', '00:10', '06:50', 8),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    expect(json.data[2].score).toBe(66.6)
    expect(json.data[2].devMinutes).toBe(20)
    expect(json.data[2].color).toBe('#4ade80')
  })

  it('仅返回当年数据，前一年数据仅用于历史窗口', async () => {
    mockFindMany.mockResolvedValue([
      makeSleep('2025-12-30', '23:00', '07:00', 8),
      makeSleep('2026-01-03', '23:00', '07:00', 8),
      makeSleep('2026-01-05', '23:00', '07:00', 8),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    // Only 2026 dates returned
    expect(json.data.length).toBe(2)
    expect(json.data[0].date).toBe('2026-01-03')
    expect(json.data[1].date).toBe('2026-01-05')

    // Day 1 (01-03): history = [12-30] → only 1 day → null
    expect(json.data[0].score).toBeNull()
    // Day 2 (01-05): history = [01-03, 12-30] → 2 days → score = 100
    expect(json.data[1].score).toBe(100)
  })

  it('avgScore 为当年所有有效评分的平均值', async () => {
    // 01-05: null, 01-06: null, 01-07: 100
    // Then 01-08: bed=23:30, wake=07:30 → history=[01-07(23,7), 01-06(23,7), 01-05(23,7)]
    // avgBed = 23*60 = 1380, avgWake = 7*60 = 420
    // devBed = circularDiff(1410, 1380) = 30, devWake = circularDiff(450, 420) = 30
    // totalDev = 30, score = 100 - 30*1.67 = 100 - 50.1 = 49.9
    mockFindMany.mockResolvedValue([
      makeSleep('2026-01-05', '23:00', '07:00', 8),
      makeSleep('2026-01-06', '23:00', '07:00', 8),
      makeSleep('2026-01-07', '23:00', '07:00', 8),
      makeSleep('2026-01-08', '23:30', '07:30', 8),
    ])

    const res = await GET(createRequest(2026))
    const json = await res.json()

    const scores = json.data.map((d: any) => d.score).filter((s: any) => s !== null)
    const expectedAvg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length * 10) / 10

    expect(json.summary.avgScore).toBe(expectedAvg)
    expect(json.summary.totalRecords).toBe(4)
  })

  it('颜色映射符合偏差阈值', async () => {
    // Build history with bed=23:00(1380), wake=07:00(420)
    // Then test various current times to hit each color band
    const cases = [
      { bed: '23:05', wake: '07:05', expectedColor: '#16a34a' },  // dev ≈ 5min → deep green
      { bed: '23:20', wake: '07:20', expectedColor: '#4ade80' },  // dev ≈ 20min → light green
      { bed: '23:40', wake: '07:40', expectedColor: '#facc15' },  // dev ≈ 40min → yellow
      { bed: '00:10', wake: '08:10', expectedColor: '#fb923c' },  // dev ≈ 50min → orange
    ]

    for (const { bed, wake, expectedColor } of cases) {
      vi.clearAllMocks()
      mockGetAuth.mockResolvedValue({ userId: 'user-1' } as any)
      mockFindMany.mockResolvedValue([
        makeSleep('2026-01-05', '23:00', '07:00', 8),
        makeSleep('2026-01-06', '23:00', '07:00', 8),
        makeSleep('2026-01-07', bed, wake, 8),
      ])

      const res = await GET(createRequest(2026))
      const json = await res.json()

      expect(json.data[2].color).toBe(expectedColor)
    }
  })

  it('数据库异常返回 500', async () => {
    mockFindMany.mockRejectedValue(new Error('DB error'))

    const res = await GET(createRequest(2026))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})
