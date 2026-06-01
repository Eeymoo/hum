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

    const aggregate = await prisma.weight.aggregate({
      where,
      _avg: { weight: true, bodyFat: true },
      _min: { weight: true, bodyFat: true },
      _max: { weight: true, bodyFat: true },
      _count: { weight: true }
    })

    const first = await prisma.weight.findFirst({
      where,
      orderBy: { date: 'asc' },
      select: { weight: true }
    })

    const lastRecord = await prisma.weight.findFirst({
      where,
      orderBy: { date: 'desc' },
      select: { weight: true }
    })

    const count = aggregate._count.weight
    if (count === 0) {
      return NextResponse.json({
        trend: [],
        avgWeight: null,
        minWeight: null,
        maxWeight: null,
        change: null
      })
    }

    const weights = await prisma.weight.findMany({
      where,
      orderBy: { date: 'asc' },
      select: { date: true, weight: true, bodyFat: true }
    })

    const avgWeight = aggregate._avg.weight ?? null
    const minWeight = aggregate._min.weight ?? null
    const maxWeight = aggregate._max.weight ?? null
    const change = first && lastRecord ? lastRecord.weight - first.weight : null

    return NextResponse.json({
      trend: weights.map(w => ({
        date: w.date.toISOString().split('T')[0],
        weight: w.weight,
        bodyFat: w.bodyFat
      })),
      avgWeight: avgWeight !== null ? Math.round(avgWeight * 10) / 10 : null,
      minWeight: minWeight !== null ? Math.round(minWeight * 10) / 10 : null,
      maxWeight: maxWeight !== null ? Math.round(maxWeight * 10) / 10 : null,
      change: change !== null ? Math.round(change * 10) / 10 : null
    })
  } catch (error) {
    console.error('Weights stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
