import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeRecord, deserializeArray } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

function parseDateRange(last?: string | null, start?: string | null, end?: string | null) {
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
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const { startDate, endDate } = parseDateRange(last, start, end)

    const baseWhere: any = { userId: authResult.userId }
    if (startDate || endDate) {
      baseWhere.date = {}
      if (startDate) {
        baseWhere.date.gte = startDate
      }
      if (endDate) {
        baseWhere.date.lte = endDate
      }
    }
    if (!includeDeleted) {
      baseWhere.deleteAt = 0
    }

    const [weights, exercises, diets, sleeps, records] = await Promise.all([
      prisma.weight.findMany({
        where: { ...baseWhere },
        orderBy: { date: 'desc' },
        take: limit
      }),
      prisma.exercise.findMany({
        where: { ...baseWhere },
        orderBy: { date: 'desc' },
        take: limit
      }),
      prisma.diet.findMany({
        where: { ...baseWhere },
        orderBy: { date: 'desc' },
        take: limit
      }),
      prisma.sleep.findMany({
        where: { ...baseWhere },
        orderBy: { date: 'desc' },
        take: limit
      }),
      prisma.record.findMany({
        where: { ...baseWhere },
        orderBy: { date: 'desc' },
        take: limit
      })
    ])

    const items: Array<{
      type: string
      id: string
      date: string
      data: any
    }> = []

    for (const w of weights) {
      items.push({
        type: 'weight',
        id: w.id,
        date: w.date.toISOString(),
        data: {
          weight: w.weight,
          bodyFat: w.bodyFat,
          muscleMass: w.muscleMass,
          bmi: w.bmi
        }
      })
    }

    for (const e of exercises) {
      items.push({
        type: 'exercise',
        id: e.id,
        date: e.date.toISOString(),
        data: {
          type: e.type,
          duration: e.duration,
          caloriesBurned: e.caloriesBurned,
          activities: JSON.parse(e.activities || '[]')
        }
      })
    }

    for (const d of diets) {
      items.push({
        type: 'diet',
        id: d.id,
        date: d.date.toISOString(),
        data: {
          mealType: d.mealType,
          calories: d.calories,
          protein: d.protein,
          carbs: d.carbs,
          fat: d.fat,
          foods: JSON.parse(d.foods || '[]')
        }
      })
    }

    for (const s of sleeps) {
      items.push({
        type: 'sleep',
        id: s.id,
        date: s.date.toISOString(),
        data: {
          duration: s.duration,
          bedTime: s.bedTime,
          wakeTime: s.wakeTime,
          quality: s.quality,
          deepSleep: s.deepSleep,
          remSleep: s.remSleep
        }
      })
    }

    for (const r of records) {
      items.push({
        type: 'record',
        id: r.id,
        date: r.date.toISOString(),
        data: deserializeRecord(r)
      })
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ items: items.slice(0, limit) })
  } catch (error) {
    console.error('Timeline error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
