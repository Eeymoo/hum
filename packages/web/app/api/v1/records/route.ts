import { NextRequest, NextResponse } from 'next/server'
import prisma, { serializeRecordData, serializeArray, deserializeRecord } from '@/lib/prisma'
import { getAuth, requireWriteAuth } from '@/lib/auth'
import { parseDateRange } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const authResult = await getAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const tag = searchParams.get('tag')
    const date = searchParams.get('date')
    const last = searchParams.get('last')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const { startDate, endDate } = parseDateRange(last, start, end)

    const where: any = { userId: authResult.userId }
    if (type) {
      where.type = type
    }
    if (tag) {
      where.tags = { contains: tag }
    }
    if (date) {
      where.date = new Date(date)
    }
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

    const skip = (page - 1) * limit
    const records = await prisma.record.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.record.count({ where })

    return NextResponse.json({
      records: records.map(deserializeRecord),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Records GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireWriteAuth(await getAuth(request))
  if (!authResult) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { type, data, tags, note, attachments, date } = body

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 })
    }
    if (!data) {
      return NextResponse.json({ error: 'data is required' }, { status: 400 })
    }

    const record = await prisma.record.create({
      data: {
        userId: authResult.userId,
        type,
        data: serializeRecordData(data),
        tags: serializeArray(tags || []),
        note,
        attachments: serializeArray(attachments || []),
        date: date ? new Date(date) : new Date()
      }
    })

    return NextResponse.json(deserializeRecord(record), { status: 201 })
  } catch (error) {
    console.error('Records POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
