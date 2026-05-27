import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyApiKey } from '@/lib/auth'
import { parseDateRange } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const authResult = await verifyApiKey(request.headers.get('authorization'))
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const last = searchParams.get('last')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const { startDate, endDate } = parseDateRange(last, start, end)

    const where: any = { deleteAt: 0 }
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

    let totalCalories = 0
    let totalProtein = 0
    let totalCarbs = 0
    let totalFat = 0
    let totalWater = 0
    let count = 0

    diets.forEach(d => {
      if (d.calories !== null) { totalCalories += d.calories; count++ }
      if (d.protein !== null) totalProtein += d.protein
      if (d.carbs !== null) totalCarbs += d.carbs
      if (d.fat !== null) totalFat += d.fat
      if (d.water !== null) totalWater += d.water
    })

    return NextResponse.json({
      avgCaloriesPerDay: count > 0 ? totalCalories / count : null,
      avgProtein: count > 0 ? totalProtein / count : null,
      avgCarbs: count > 0 ? totalCarbs / count : null,
      avgFat: count > 0 ? totalFat / count : null,
      totalWater,
      count
    })
  } catch (error) {
    console.error('Diets stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
