import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeRecord } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const q = searchParams.get('q')
    const type = searchParams.get('type')
    const last = searchParams.get('last')
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    if (!q) {
      return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 })
    }

    let startDate: Date | undefined
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

    const where: any = {
      userId: authResult.userId,
      OR: [
        { type: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
        { tags: { contains: q, mode: 'insensitive' } }
      ]
    }

    if (type) {
      where.type = type
    }
    if (startDate) {
      where.date = { gte: startDate }
    }
    if (!includeDeleted) {
      where.deleteAt = 0
    }

    const records = await prisma.record.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit
    })

    return NextResponse.json({ records: records.map(deserializeRecord) })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
