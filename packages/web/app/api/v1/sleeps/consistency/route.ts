import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/v1/sleeps/consistency?year=2026&month=6
 *
 * 返回指定月份的每日睡眠一致性评分
 * 评分 = 7 - |工作日平均起床 - 周末平均起床|（小时）
 */
export async function GET(req: NextRequest) {
  const auth = await getAuth(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(url.searchParams.get('month') || String(new Date().getMonth() + 1))

  // 计算该月的起止日期
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

  // 获取该月所有睡眠记录
  const sleeps = await prisma.sleep.findMany({
    where: {
      userId: auth.userId,
      date: { gte: monthStart, lte: monthEnd },
      deleteAt: 0
    },
    orderBy: { date: 'asc' }
  })

  // 按日期分组，每天取第一条记录
  const dailyMap = new Map<string, { wakeTime: string; date: Date }>()
  sleeps.forEach((s: any) => {
    const dateKey = s.date.toISOString().split('T')[0]
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { wakeTime: s.wakeTime, date: s.date })
    }
  })

  // 分离工作日和周末的起床时间
  const weekdayTimes: number[] = []
  const weekendTimes: number[] = []

  dailyMap.forEach(({ wakeTime, date }) => {
    const [h, m] = wakeTime.split(':').map(Number)
    const hours = h + m / 60
    const dayOfWeek = date.getDay() // 0=周日, 1=周一, ..., 6=周六

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekdayTimes.push(hours)
    } else {
      weekendTimes.push(hours)
    }
  })

  // 计算工作日和周末的平均起床时间
  const weekdayAvg = weekdayTimes.length > 0
    ? weekdayTimes.reduce((a, b) => a + b, 0) / weekdayTimes.length
    : null
  const weekendAvg = weekendTimes.length > 0
    ? weekendTimes.reduce((a, b) => a + b, 0) / weekendTimes.length
    : null

  // 计算一致性评分
  let consistencyScore: number | null = null
  if (weekdayAvg !== null && weekendAvg !== null) {
    const diff = Math.abs(weekdayAvg - weekendAvg)
    consistencyScore = Math.max(0, Math.round((7 - diff) * 10) / 10)
  }

  // 构建每日数据
  const dailyScores = Array.from(dailyMap.entries()).map(([date, { wakeTime }]) => {
    const [h, m] = wakeTime.split(':').map(Number)
    return {
      date,
      wakeTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      wakeHours: h + m / 60
    }
  })

  return NextResponse.json({
    year,
    month,
    weekdayAvg: weekdayAvg !== null ? formatHours(weekdayAvg) : null,
    weekendAvg: weekendAvg !== null ? formatHours(weekendAvg) : null,
    weekdayCount: weekdayTimes.length,
    weekendCount: weekendTimes.length,
    consistencyScore,
    dailyScores
  })
}

function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
