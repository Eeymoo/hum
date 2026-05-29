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

    const diets = await prisma.diet.findMany({ where })

    if (diets.length === 0) {
      return NextResponse.json({
        avgCalories: null,
        avgProtein: null,
        avgCarbs: null,
        avgFat: null,
        totalWater: null,
        count: 0
      })
    }

    let totalCalories = 0
    let totalProtein = 0
    let totalCarbs = 0
    let totalFat = 0
    let totalWater = 0
    let caloriesCount = 0
    let proteinCount = 0
    let carbsCount = 0
    let fatCount = 0

    diets.forEach(d => {
      if (d.calories !== null) { totalCalories += d.calories; caloriesCount++ }
      if (d.protein !== null) { totalProtein += d.protein; proteinCount++ }
      if (d.carbs !== null) { totalCarbs += d.carbs; carbsCount++ }
      if (d.fat !== null) { totalFat += d.fat; fatCount++ }
      if (d.water !== null) totalWater += d.water
    })

    return NextResponse.json({
      avgCalories: caloriesCount > 0 ? totalCalories / caloriesCount : null,
      avgProtein: proteinCount > 0 ? totalProtein / proteinCount : null,
      avgCarbs: carbsCount > 0 ? totalCarbs / carbsCount : null,
      avgFat: fatCount > 0 ? totalFat / fatCount : null,
      totalWater: totalWater > 0 ? totalWater : null,
      count: diets.length
    })
  } catch (error) {
    console.error('Diets stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
