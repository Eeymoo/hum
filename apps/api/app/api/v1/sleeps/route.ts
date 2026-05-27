import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeArray, serializeArray } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { saveFile, validateFile, deleteFile } from '@/lib/file'
import { parseDateRange } from '@/lib/utils'

function deserializeSleep(sleep: any) {
  return {
    ...sleep,
    attachments: sleep.attachments ? deserializeArray(sleep.attachments) : []
  }
}

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
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const order = searchParams.get('order') || 'desc'

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

    const skip = (page - 1) * limit
    const sleeps = await prisma.sleep.findMany({
      where,
      orderBy: { date: order === 'asc' ? 'asc' : 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.sleep.count({ where })

    return NextResponse.json({
      sleeps: sleeps.map(deserializeSleep),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Sleeps GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const durationStr = formData.get('duration') as string
    const bedTime = formData.get('bedTime') as string
    const wakeTime = formData.get('wakeTime') as string
    const qualityStr = formData.get('quality') as string
    const deepSleepStr = formData.get('deepSleep') as string | null
    const remSleepStr = formData.get('remSleep') as string | null
    const awakeningsStr = formData.get('awakenings') as string | null
    const feelingStr = formData.get('feeling') as string | null
    const note = formData.get('note') as string | null
    const dateStr = formData.get('date') as string | null
    const files = formData.getAll('file') as File[]

    const attachments: any[] = []
    for (const file of files) {
      validateFile(file)
      const attachment = await saveFile('sleeps', file)
      attachments.push(attachment)
    }

    const sleep = await prisma.sleep.create({
      data: {
        duration: parseFloat(durationStr),
        bedTime,
        wakeTime,
        quality: parseInt(qualityStr, 10),
        deepSleep: deepSleepStr ? parseFloat(deepSleepStr) : null,
        remSleep: remSleepStr ? parseFloat(remSleepStr) : null,
        awakenings: awakeningsStr ? parseInt(awakeningsStr, 10) : null,
        feeling: feelingStr ? parseInt(feelingStr, 10) : null,
        note,
        attachments: serializeArray(attachments),
        date: dateStr ? new Date(dateStr) : new Date()
      }
    })

    return NextResponse.json(deserializeSleep(sleep), { status: 201 })
  } catch (error) {
    console.error('Sleeps POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
