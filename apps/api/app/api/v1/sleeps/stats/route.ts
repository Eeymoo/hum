import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { parseDateRange } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
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

    const sleeps = await prisma.sleep.findMany({ where })

    let totalDuration = 0
    let totalQuality = 0
    let totalDeepSleep = 0
    let count = 0

    sleeps.forEach(s => {
      totalDuration += s.duration
      totalQuality += s.quality
      if (s.deepSleep !== null) totalDeepSleep += s.deepSleep
      count++
    })

    return NextResponse.json({
      avgDuration: count > 0 ? totalDuration / count : null,
      avgQuality: count > 0 ? totalQuality / count : null,
      avgDeepSleep: count > 0 ? totalDeepSleep / count : null,
      count
    })
  } catch (error) {
    console.error('Sleeps stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
