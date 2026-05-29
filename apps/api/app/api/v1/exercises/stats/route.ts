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

    const exercises = await prisma.exercise.findMany({ where })

    let totalDuration = 0
    let totalCalories = 0
    const frequencyByType: Record<string, number> = {}

    // 按日期分组汇总
    const dailyMap = new Map<string, { duration: number; calories: number; caloriesCount: number }>()

    exercises.forEach(ex => {
      totalDuration += ex.duration
      if (ex.caloriesBurned) totalCalories += ex.caloriesBurned
      frequencyByType[ex.type] = (frequencyByType[ex.type] || 0) + 1

      const dateKey = ex.date.toISOString().split('T')[0]
      const day = dailyMap.get(dateKey) || { duration: 0, calories: 0, caloriesCount: 0 }
      day.duration += ex.duration
      if (ex.caloriesBurned) { day.calories += ex.caloriesBurned; day.caloriesCount++ }
      dailyMap.set(dateKey, day)
    })

    const days = Array.from(dailyMap.values())
    const dayCount = days.length

    return NextResponse.json({
      totalDuration,
      totalCalories,
      avgDuration: dayCount > 0
        ? Math.round(days.reduce((s, d) => s + d.duration, 0) / dayCount)
        : null,
      avgCalories: dayCount > 0
        ? Math.round(days.reduce((s, d) => s + d.calories, 0) / dayCount)
        : null,
      frequencyByType,
      count: exercises.length
    })
  } catch (error) {
    console.error('Exercises stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
