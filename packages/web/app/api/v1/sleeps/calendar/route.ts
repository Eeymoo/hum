import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const authResult = await getAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

    if (isNaN(year)) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
    }

    // 查询从上一年1月1日到当年12月31日的所有睡眠记录
    const startDate = new Date(year - 1, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999)

    const allSleeps = await prisma.sleep.findMany({
      where: {
        userId: authResult.userId,
        date: { gte: startDate, lte: endDate },
        deleteAt: 0
      },
      orderBy: { date: 'asc' },
      select: { date: true, duration: true, wakeTime: true }
    })

    // 按日期分组，每天取 duration 最大的一条记录的 wakeTime 和 duration
    const dailyMap = new Map<string, { wakeTime: string; duration: number }>()
    for (const s of allSleeps) {
      const dateKey = s.date.toISOString().slice(0, 10)
      const existing = dailyMap.get(dateKey)
      if (!existing || s.duration > existing.duration) {
        dailyMap.set(dateKey, { wakeTime: s.wakeTime, duration: s.duration })
      }
    }

    // 按日期排序（已按 date asc 查询，dailyMap 保持插入顺序）
    const sortedDates = Array.from(dailyMap.keys())

    // 逐日计算一致性评分：忽略首日，自第二天起以滚动窗口回溯至多 7 个有效数据日
    const scoreMap = new Map<string, number | null>()

    for (let i = 0; i < sortedDates.length; i++) {
      const dateStr = sortedDates[i]

      // 忽略首日
      if (i === 0) {
        scoreMap.set(dateStr, null)
        continue
      }

      // 以当日为起点向前回溯，采集至多 7 个有效数据日（含当日）
      const windowDays: Array<{ dateStr: string; wakeTime: string }> = []
      for (let j = i; j >= 0 && windowDays.length < 7; j--) {
        const d = sortedDates[j]
        windowDays.push({ dateStr: d, wakeTime: dailyMap.get(d)!.wakeTime })
      }

      // 分离工作日和周末的起床时间
      const weekdayTimes: number[] = []
      const weekendTimes: number[] = []

      for (const day of windowDays) {
        const d = new Date(day.dateStr)
        const [h, m] = day.wakeTime.split(':').map(Number)
        const hours = h + m / 60
        const dayOfWeek = d.getDay()

        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          weekdayTimes.push(hours)
        } else {
          weekendTimes.push(hours)
        }
      }

      // 计算一致性评分：7 - |工作日平均起床 - 周末平均起床|（小时）
      if (weekdayTimes.length > 0 && weekendTimes.length > 0) {
        const weekdayAvg = weekdayTimes.reduce((a, b) => a + b, 0) / weekdayTimes.length
        const weekendAvg = weekendTimes.reduce((a, b) => a + b, 0) / weekendTimes.length
        const diff = Math.abs(weekdayAvg - weekendAvg)
        scoreMap.set(dateStr, Math.max(0, Math.round((7 - diff) * 10) / 10))
      } else {
        scoreMap.set(dateStr, null)
      }
    }

    // 构建当年数据
    const yearStart = `${year}-01-01`
    const data: Array<[string, number | null, number]> = []

    for (const dateStr of sortedDates) {
      if (dateStr < yearStart) continue

      const entry = dailyMap.get(dateStr)!
      const score = scoreMap.get(dateStr) ?? null

      data.push([dateStr, score, entry.duration])
    }

    // 汇总统计
    const validScores = data
      .map(([, score]) => score)
      .filter((s): s is number => s !== null)
    const avgScore = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length * 10) / 10
      : null

    return NextResponse.json({
      data,
      summary: {
        totalRecords: data.length,
        avgScore
      },
      year
    })
  } catch (error) {
    console.error('Sleep calendar GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
