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
    let caloriesCount = 0
    const frequencyByType: Record<string, number> = {}

    exercises.forEach(ex => {
      totalDuration += ex.duration
      if (ex.caloriesBurned) { totalCalories += ex.caloriesBurned; caloriesCount++ }
      frequencyByType[ex.type] = (frequencyByType[ex.type] || 0) + 1
    })

    return NextResponse.json({
      totalDuration,
      totalCalories,
      avgDuration: exercises.length > 0 ? totalDuration / exercises.length : null,
      avgCalories: caloriesCount > 0 ? totalCalories / caloriesCount : null,
      frequencyByType,
      count: exercises.length
    })
  } catch (error) {
    console.error('Exercises stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
