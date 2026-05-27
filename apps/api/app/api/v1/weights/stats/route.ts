import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyApiKey } from '@/lib/auth'
import { parseDateRange } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const authResult = await verifyApiKey(request.headers.get('authorization'))
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const last = searchParams.get('last')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const { startDate, endDate } = parseDateRange(last, start, end)

    const where: any = { deleteAt: 0 }
    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = startDate
      }
      if (endDate) {
        where.date.lte = endDate
      }
    }

    const weights = await prisma.weight.findMany({
      where,
      orderBy: { date: 'asc' }
    })

    if (weights.length === 0) {
      return NextResponse.json({
        trend: [],
        avgWeight: null,
        minWeight: null,
        maxWeight: null,
        change: null
      })
    }

    const weightValues = weights.map(w => w.weight)
    const avgWeight = weightValues.reduce((a, b) => a + b, 0) / weightValues.length
    const minWeight = Math.min(...weightValues)
    const maxWeight = Math.max(...weightValues)
    const change = weights.length > 1 ? weights[weights.length - 1].weight - weights[0].weight : null

    return NextResponse.json({
      trend: weights.map(w => ({
        date: w.date.toISOString().split('T')[0],
        weight: w.weight,
        bodyFat: w.bodyFat
      })),
      avgWeight: Math.round(avgWeight * 10) / 10,
      minWeight: Math.round(minWeight * 10) / 10,
      maxWeight: Math.round(maxWeight * 10) / 10,
      change: change !== null ? Math.round(change * 10) / 10 : null
    })
  } catch (error) {
    console.error('Weights stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
