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

    // 按月份计算一致性评分
    const monthScores = new Map<number, number | null>()
    for (let month = 0; month < 12; month++) {
      const weekdayTimes: number[] = []
      const weekendTimes: number[] = []

      dailyMap.forEach(({ wakeTime }, dateStr) => {
        const d = new Date(dateStr)
        if (d.getFullYear() !== year || d.getMonth() !== month) return

        const [h, m] = wakeTime.split(':').map(Number)
        const hours = h + m / 60
        const dayOfWeek = d.getDay()

        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          weekdayTimes.push(hours)
        } else {
          weekendTimes.push(hours)
        }
      })

      if (weekdayTimes.length > 0 && weekendTimes.length > 0) {
        const weekdayAvg = weekdayTimes.reduce((a, b) => a + b, 0) / weekdayTimes.length
        const weekendAvg = weekendTimes.reduce((a, b) => a + b, 0) / weekendTimes.length
        const diff = Math.abs(weekdayAvg - weekendAvg)
        monthScores.set(month, Math.max(0, Math.round((7 - diff) * 10) / 10))
      } else {
        monthScores.set(month, null)
      }
    }

    // 构建当年数据
    const yearStart = `${year}-01-01`
    const data: Array<[string, number | null, number]> = []

    const sortedDates = Array.from(dailyMap.keys()).sort()
    for (const dateStr of sortedDates) {
      if (dateStr < yearStart) continue

      const entry = dailyMap.get(dateStr)!
      const month = new Date(dateStr).getMonth()
      const score = monthScores.get(month) ?? null

      data.push([dateStr, score, entry.duration])
    }

    // 汇总统计
    const validScores = Array.from(monthScores.values()).filter((s): s is number => s !== null)
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
