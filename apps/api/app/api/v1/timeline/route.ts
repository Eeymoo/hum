import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeRecord } from '@/lib/prisma'
import { verifyApiKey } from '@/lib/auth'

function parseDateRange(last?: string, start?: string, end?: string) {
  let startDate: Date | undefined
  let endDate: Date | undefined

  if (last) {
    const now = new Date()
    const match = last.match(/^(\d+)(d|w|m|y)$/)
    if (match) {
      const [, num, unit] = match
      const n = parseInt(num, 10)
      switch (unit) {
        case 'd':
          startDate = new Date(now.getTime() - n * 24 * 60 * 60 * 1000)
          break
        case 'w':
          startDate = new Date(now.getTime() - n * 7 * 24 * 60 * 60 * 1000)
          break
        case 'm':
          startDate = new Date(now)
          startDate.setMonth(startDate.getMonth() - n)
          break
        case 'y':
          startDate = new Date(now)
          startDate.setFullYear(startDate.getFullYear() - n)
          break
      }
    } else {
      const num = parseInt(last, 10)
      if (!isNaN(num)) {
        startDate = new Date(now.getTime() - num * 24 * 60 * 60 * 1000)
      }
    }
  }

  if (start) {
    startDate = new Date(start)
  }
  if (end) {
    endDate = new Date(end)
  }

  return { startDate, endDate }
}

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
    const includeDeleted = searchParams.get('includeDeleted') === 'true'

    const { startDate, endDate } = parseDateRange(last, start, end)

    const where: any = {}
    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = startDate
      }
      if (endDate) {
        where.date.lte = endDate
      }
    }
    if (!includeDeleted) {
      where.deleteAt = 0
    }

    const records = await prisma.record.findMany({
      where,
      orderBy: { date: 'desc' }
    })

    const timeline: Record<string, any[]> = {}
    for (const record of records) {
      const dateKey = record.date.toISOString().split('T')[0]
      if (!timeline[dateKey]) {
        timeline[dateKey] = []
      }
      timeline[dateKey].push(deserializeRecord(record))
    }

    return NextResponse.json({ timeline })
  } catch (error) {
    console.error('Timeline error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
