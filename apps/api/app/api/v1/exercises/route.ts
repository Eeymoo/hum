import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeArray, serializeArray } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { saveFile, validateFile, deleteFile } from '@/lib/file'
import { parseDateRange, parseActivities } from '@/lib/utils'

function deserializeExercise(exercise: any) {
  return {
    ...exercise,
    activities: JSON.parse(exercise.activities || '[]'),
    attachments: exercise.attachments ? deserializeArray(exercise.attachments) : []
  }
}

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const last = searchParams.get('last')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const order = searchParams.get('order') || 'desc'

    const { startDate, endDate } = parseDateRange(last, start, end)

    const where: any = {}
    if (type) where.type = type
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
    const exercises = await prisma.exercise.findMany({
      where,
      orderBy: { date: order === 'asc' ? 'asc' : 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.exercise.count({ where })

    return NextResponse.json({
      exercises: exercises.map(deserializeExercise),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Exercises GET error:', error)
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
    const type = formData.get('type') as string
    const durationStr = formData.get('duration') as string
    const caloriesBurnedStr = formData.get('caloriesBurned') as string | null
    const activitiesStr = formData.get('activities') as string
    const heartRateAvgStr = formData.get('heartRateAvg') as string | null
    const heartRateMaxStr = formData.get('heartRateMax') as string | null
    const feelingStr = formData.get('feeling') as string | null
    const location = formData.get('location') as string | null
    const note = formData.get('note') as string | null
    const dateStr = formData.get('date') as string | null
    const files = formData.getAll('file') as File[]

    const attachments: any[] = []
    for (const file of files) {
      validateFile(file)
      const attachment = await saveFile('exercises', file)
      attachments.push(attachment)
    }

    const activities = parseActivities(activitiesStr)

    const exercise = await prisma.exercise.create({
      data: {
        type,
        duration: parseInt(durationStr, 10),
        caloriesBurned: caloriesBurnedStr ? parseInt(caloriesBurnedStr, 10) : null,
        activities: JSON.stringify(activities),
        heartRateAvg: heartRateAvgStr ? parseInt(heartRateAvgStr, 10) : null,
        heartRateMax: heartRateMaxStr ? parseInt(heartRateMaxStr, 10) : null,
        feeling: feelingStr ? parseInt(feelingStr, 10) : null,
        location,
        note,
        attachments: serializeArray(attachments),
        date: dateStr ? new Date(dateStr) : new Date()
      }
    })

    return NextResponse.json(deserializeExercise(exercise), { status: 201 })
  } catch (error) {
    console.error('Exercises POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
