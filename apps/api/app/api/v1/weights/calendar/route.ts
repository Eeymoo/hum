import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
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

    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999)

    // 拉取该年份及之前的所有体重记录
    const allWeights = await prisma.weight.findMany({
      where: {
        userId: authResult.userId,
        date: { lte: endDate },
        deleteAt: 0
      },
      orderBy: { date: 'asc' },
      select: { date: true, weight: true }
    })

    // 按日期取最后一条体重
    const weightByDate = new Map<string, number>()
    for (const w of allWeights) {
      const dateKey = w.date.toISOString().slice(0, 10)
      weightByDate.set(dateKey, w.weight)
    }

    const sortedDates = Array.from(weightByDate.keys()).sort()

    // 有序的日期-体重数组
    const weightEntries: Array<{ date: string; weight: number }> = sortedDates
      .map(d => ({ date: d, weight: weightByDate.get(d)! }))

    const data: Array<[string, number | null, number | null]> = []

    for (let i = 0; i < weightEntries.length; i++) {
      const entry = weightEntries[i]
      const entryDate = new Date(entry.date)
      if (entryDate < startDate) continue

      // 过去 8 天均值：[i-8, i-1]
      const prevStart = Math.max(0, i - 8)
      const prevEnd = i
      const prevEntries = weightEntries.slice(prevStart, prevEnd)

      let change: number | null = null
      if (prevEntries.length > 0) {
        const prevAvg = prevEntries.reduce((s, e) => s + e.weight, 0) / prevEntries.length
        change = Math.round((entry.weight - prevAvg) * 100) / 100
      }

      data.push([entry.date, change, entry.weight])
    }

    const yearDates = data.map(d => d[0])
    let netChange: number | null = null
    if (yearDates.length >= 2) {
      const firstW = weightByDate.get(yearDates[0])!
      const lastW = weightByDate.get(yearDates[yearDates.length - 1])!
      netChange = Math.round((lastW - firstW) * 100) / 100
    }

    return NextResponse.json({
      data,
      summary: {
        totalRecords: yearDates.length,
        netChange
      },
      year
    })
  } catch (error) {
    console.error('Calendar GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
