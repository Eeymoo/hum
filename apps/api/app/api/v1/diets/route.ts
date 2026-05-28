import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeArray, serializeArray } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { saveFile, validateFile } from '@/lib/file'
import { parseDateRange, parseFoods } from '@/lib/utils'

function deserializeDiet(diet: any) {
  return {
    ...diet,
    foods: JSON.parse(diet.foods || '[]'),
    attachments: diet.attachments ? deserializeArray(diet.attachments) : []
  }
}

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const mealType = searchParams.get('mealType')
    const last = searchParams.get('last')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const order = searchParams.get('order') || 'desc'

    const { startDate, endDate } = parseDateRange(last, start, end)

    const where: any = { userId: authResult.userId }
    if (mealType) where.mealType = mealType
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
    const diets = await prisma.diet.findMany({
      where,
      orderBy: { date: order === 'asc' ? 'asc' : 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.diet.count({ where })

    return NextResponse.json({
      diets: diets.map(deserializeDiet),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Diets GET error:', error)
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
    const mealType = formData.get('mealType') as string
    if (!mealType) {
      return NextResponse.json({ error: 'mealType is required' }, { status: 400 })
    }
    const caloriesStr = formData.get('calories') as string | null
    const proteinStr = formData.get('protein') as string | null
    const carbsStr = formData.get('carbs') as string | null
    const fatStr = formData.get('fat') as string | null
    const fiberStr = formData.get('fiber') as string | null
    const sodiumStr = formData.get('sodium') as string | null
    const foodsStr = formData.get('foods') as string
    const waterStr = formData.get('water') as string | null
    const note = formData.get('note') as string | null
    const dateStr = formData.get('date') as string | null
    const files = formData.getAll('file') as File[]

    const attachments: any[] = []
    for (const file of files) {
      validateFile(file)
      const attachment = await saveFile('diets', file)
      attachments.push(attachment)
    }

    const foods = parseFoods(foodsStr)

    const diet = await prisma.diet.create({
      data: {
        userId: authResult.userId,
        mealType,
        calories: caloriesStr ? parseInt(caloriesStr, 10) : null,
        protein: proteinStr ? parseFloat(proteinStr) : null,
        carbs: carbsStr ? parseFloat(carbsStr) : null,
        fat: fatStr ? parseFloat(fatStr) : null,
        fiber: fiberStr ? parseFloat(fiberStr) : null,
        sodium: sodiumStr ? parseFloat(sodiumStr) : null,
        foods: JSON.stringify(foods),
        water: waterStr ? parseInt(waterStr, 10) : null,
        note,
        attachments: serializeArray(attachments),
        date: dateStr ? new Date(dateStr) : new Date()
      }
    })

    return NextResponse.json(deserializeDiet(diet), { status: 201 })
  } catch (error) {
    console.error('Diets POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
