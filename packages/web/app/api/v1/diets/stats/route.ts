import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
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

    const aggregate = await prisma.diet.aggregate({
      where,
      _avg: { calories: true, protein: true, carbs: true, fat: true },
      _sum: { water: true },
      _count: { calories: true }
    })

    const count = aggregate._count.calories
    if (count === 0) {
      return NextResponse.json({
        avgCalories: null,
        avgProtein: null,
        avgCarbs: null,
        avgFat: null,
        totalWater: null,
        count: 0
      })
    }

    const diets = await prisma.diet.findMany({
      where,
      select: { calories: true, protein: true, carbs: true, fat: true, water: true, date: true }
    })

    let totalWater = 0
    const dailyMap = new Map<string, {
      calories: number; protein: number; carbs: number; fat: number
    }>()

    diets.forEach((d: any) => {
      const dateKey = d.date.toISOString().split('T')[0]
      const day = dailyMap.get(dateKey) || { calories: 0, protein: 0, carbs: 0, fat: 0 }
      if (d.calories !== null) day.calories += d.calories
      if (d.protein !== null) day.protein += d.protein
      if (d.carbs !== null) day.carbs += d.carbs
      if (d.fat !== null) day.fat += d.fat
      if (d.water !== null) totalWater += d.water
      dailyMap.set(dateKey, day)
    })

    const days = Array.from(dailyMap.values())
    const dayCount = days.length

    return NextResponse.json({
      avgCalories: dayCount > 0
        ? Math.round(days.reduce((s, d) => s + d.calories, 0) / dayCount)
        : null,
      avgProtein: dayCount > 0
        ? Math.round(days.reduce((s, d) => s + d.protein, 0) / dayCount * 10) / 10
        : null,
      avgCarbs: dayCount > 0
        ? Math.round(days.reduce((s, d) => s + d.carbs, 0) / dayCount * 10) / 10
        : null,
      avgFat: dayCount > 0
        ? Math.round(days.reduce((s, d) => s + d.fat, 0) / dayCount * 10) / 10
        : null,
      totalWater: totalWater > 0 ? totalWater : null,
      count: dayCount
    })
  } catch (error) {
    console.error('Diets stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
