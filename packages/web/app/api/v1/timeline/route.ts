import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeRecord, deserializeArray } from '@/lib/prisma'
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

    const perTableLimit = Math.ceil(limit / 5)

    const [weights, exercises, diets, sleeps, records] = await Promise.all([
      prisma.weight.findMany({
        where: { ...baseWhere },
        orderBy: { date: 'desc' },
        take: perTableLimit
      }),
      prisma.exercise.findMany({
        where: { ...baseWhere },
        orderBy: { date: 'desc' },
        take: perTableLimit
      }),
      prisma.diet.findMany({
        where: { ...baseWhere },
        orderBy: { date: 'desc' },
        take: perTableLimit
      }),
      prisma.sleep.findMany({
        where: { ...baseWhere },
        orderBy: { date: 'desc' },
        take: perTableLimit
      }),
      prisma.record.findMany({
        where: { ...baseWhere },
        orderBy: { date: 'desc' },
        take: perTableLimit
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
