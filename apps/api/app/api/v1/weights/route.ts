import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeArray, serializeArray } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { saveFile, validateFile } from '@/lib/file'
import { parseDateRange } from '@/lib/utils'

function deserializeWeight(weight: any) {
  return {
    ...weight,
    attachments: weight.attachments ? deserializeArray(weight.attachments) : [],
    extraData: weight.extraData ? JSON.parse(weight.extraData) : null
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

    const where: any = { userId: authResult.userId }
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
    const weights = await prisma.weight.findMany({
      where,
      orderBy: { date: order === 'asc' ? 'asc' : 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.weight.count({ where })

    return NextResponse.json({
      weights: weights.map(deserializeWeight),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Weights GET error:', error)
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
    const weightStr = formData.get('weight') as string
    if (!weightStr || isNaN(parseFloat(weightStr))) {
      return NextResponse.json({ error: 'weight is required and must be a number' }, { status: 400 })
    }
    const bodyFatStr = formData.get('bodyFat') as string | null
    const muscleMassStr = formData.get('muscleMass') as string | null
    const bmiStr = formData.get('bmi') as string | null
    const waterStr = formData.get('water') as string | null
    const boneMassStr = formData.get('boneMass') as string | null
    const visceralFatStr = formData.get('visceralFat') as string | null
    const note = formData.get('note') as string | null
    const dateStr = formData.get('date') as string | null
    const files = formData.getAll('file') as File[]
    const extraDataStr = formData.get('extraData') as string | null

    const attachments: any[] = []
    for (const file of files) {
      validateFile(file)
      const attachment = await saveFile('weights', file)
      attachments.push(attachment)
    }

    const weight = await prisma.weight.create({
      data: {
        userId: authResult.userId,
        weight: parseFloat(weightStr),
        bodyFat: bodyFatStr ? parseFloat(bodyFatStr) : null,
        muscleMass: muscleMassStr ? parseFloat(muscleMassStr) : null,
        bmi: bmiStr ? parseFloat(bmiStr) : null,
        water: waterStr ? parseFloat(waterStr) : null,
        boneMass: boneMassStr ? parseFloat(boneMassStr) : null,
        visceralFat: visceralFatStr ? parseInt(visceralFatStr, 10) : null,
        note,
        attachments: serializeArray(attachments),
        extraData: extraDataStr || null,
        date: dateStr ? new Date(dateStr) : new Date()
      }
    })

    return NextResponse.json(deserializeWeight(weight), { status: 201 })
  } catch (error) {
    console.error('Weights POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
