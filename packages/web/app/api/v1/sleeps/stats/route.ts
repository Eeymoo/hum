import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { parseDateRange } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const authResult = await getAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const last = searchParams.get('last')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const { startDate, endDate } = parseDateRange(last, start, end)

    const where: any = { userId: authResult.userId, deleteAt: 0 }
    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = startDate
      }
      if (endDate) {
        where.date.lte = endDate
      }
    }

    const aggregate = await prisma.sleep.aggregate({
      where,
      _avg: { duration: true, quality: true, deepSleep: true },
      _count: { duration: true }
    })

    const count = aggregate._count.duration
    if (count === 0) {
      return NextResponse.json({
        avgDuration: null,
        avgQuality: null,
        avgDeepSleep: null,
        count: 0
      })
    }

    const sleeps = await prisma.sleep.findMany({
      where,
      select: { duration: true, quality: true, deepSleep: true, date: true }
    })

    const dailyMap = new Map<string, {
      duration: number; quality: number; deepSleep: number;
      deepSleepCount: number; count: number
    }>()

    sleeps.forEach((s: any) => {
      const dateKey = s.date.toISOString().split('T')[0]
      const day = dailyMap.get(dateKey) || { duration: 0, quality: 0, deepSleep: 0, deepSleepCount: 0, count: 0 }
      day.duration += s.duration
      day.quality += s.quality
      if (s.deepSleep !== null) { day.deepSleep += s.deepSleep; day.deepSleepCount++ }
      day.count++
      dailyMap.set(dateKey, day)
    })

    const days = Array.from(dailyMap.values())
    const dayCount = days.length

    return NextResponse.json({
      avgDuration: dayCount > 0
        ? Math.round(days.reduce((s, d) => s + d.duration, 0) / dayCount * 10) / 10
        : null,
      avgQuality: dayCount > 0
        ? Math.round(days.reduce((s, d) => s + d.quality / d.count, 0) / dayCount * 10) / 10
        : null,
      avgDeepSleep: dayCount > 0
        ? Math.round(days.reduce((s, d) => s + d.deepSleep, 0) / dayCount * 10) / 10
        : null,
      count: dayCount
    })
  } catch (error) {
    console.error('Sleeps stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
