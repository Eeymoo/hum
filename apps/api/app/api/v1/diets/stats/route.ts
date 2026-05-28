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
        avgCaloriesPerDay: null,
        avgProtein: null,
        avgCarbs: null,
        avgFat: null,
        totalWater: null,
        count: 0
      })
    }

    const daysInRange = (() => {
      const s = startDate || diets.reduce((min, d) => d.date < min ? d.date : min, diets[0].date)
      const e = endDate || new Date()
      const diff = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)))
      return diff
    })()

    let totalCalories = 0
    let totalProtein = 0
    let totalCarbs = 0
    let totalFat = 0
    let totalWater = 0
    let hasCaloriesCount = 0

    diets.forEach(d => {
      if (d.calories !== null) {
        totalCalories += d.calories
        hasCaloriesCount++
      }
      if (d.protein !== null) totalProtein += d.protein
      if (d.carbs !== null) totalCarbs += d.carbs
      if (d.fat !== null) totalFat += d.fat
      if (d.water !== null) totalWater += d.water
    })

    return NextResponse.json({
      avgCaloriesPerDay: hasCaloriesCount > 0 ? totalCalories / daysInRange : null,
      avgProtein: diets.length > 0 ? totalProtein / daysInRange : null,
      avgCarbs: diets.length > 0 ? totalCarbs / daysInRange : null,
      avgFat: diets.length > 0 ? totalFat / daysInRange : null,
      totalWater,
      count: diets.length
    })
  } catch (error) {
    console.error('Diets stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
