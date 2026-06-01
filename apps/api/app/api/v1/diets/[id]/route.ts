import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeArray, serializeArray } from '@/lib/prisma'
import { verifyAuth, verifyWriteAuth } from '@/lib/auth'
import { saveFile, validateFile, deleteFile } from '@/lib/file'
import { parseFoods } from '@/lib/utils'

function deserializeDiet(diet: any) {
  return {
    ...diet,
    foods: JSON.parse(diet.foods || '[]'),
    attachments: diet.attachments ? deserializeArray(diet.attachments) : [],
    extraData: diet.extraData ? JSON.parse(diet.extraData) : null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const diet = await prisma.diet.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!diet || diet.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(deserializeDiet(diet))
  } catch (error) {
    console.error('Diet GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await verifyWriteAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const existing = await prisma.diet.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!existing || existing.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const mealType = formData.get('mealType') as string | null
    const caloriesStr = formData.get('calories') as string | null
    const proteinStr = formData.get('protein') as string | null
    const carbsStr = formData.get('carbs') as string | null
    const fatStr = formData.get('fat') as string | null
    const fiberStr = formData.get('fiber') as string | null
    const sodiumStr = formData.get('sodium') as string | null
    const foodsStr = formData.get('foods') as string | null
    const waterStr = formData.get('water') as string | null
    const note = formData.get('note') as string | null
    const dateStr = formData.get('date') as string | null
    const files = formData.getAll('file') as File[]
    const replaceAttachments = formData.get('replaceAttachments') === 'true'
    const extraDataStr = formData.get('extraData') as string | null

    const existingAttachments = existing.attachments ? deserializeArray(existing.attachments) : []
    let newAttachments = replaceAttachments ? [] : [...existingAttachments]

    for (const file of files) {
      validateFile(file)
      const attachment = await saveFile('diets', file)
      newAttachments.push(attachment)
    }

    const data: any = {}
    if (mealType) data.mealType = mealType
    if (caloriesStr !== undefined) data.calories = caloriesStr ? parseInt(caloriesStr, 10) : null
    if (proteinStr !== undefined) data.protein = proteinStr ? parseFloat(proteinStr) : null
    if (carbsStr !== undefined) data.carbs = carbsStr ? parseFloat(carbsStr) : null
    if (fatStr !== undefined) data.fat = fatStr ? parseFloat(fatStr) : null
    if (fiberStr !== undefined) data.fiber = fiberStr ? parseFloat(fiberStr) : null
    if (sodiumStr !== undefined) data.sodium = sodiumStr ? parseFloat(sodiumStr) : null
    if (foodsStr !== undefined) data.foods = JSON.stringify(parseFoods(foodsStr))
    if (waterStr !== undefined) data.water = waterStr ? parseInt(waterStr, 10) : null
    if (note !== undefined) data.note = note
    if (extraDataStr !== undefined) data.extraData = extraDataStr || null
    if (dateStr) data.date = new Date(dateStr)
    data.attachments = serializeArray(newAttachments)

    const updated = await prisma.diet.update({
      where: { id },
      data
    })
    return NextResponse.json(deserializeDiet(updated))
  } catch (error) {
    console.error('Diet PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await verifyWriteAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const existing = await prisma.diet.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!existing || existing.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const attachments = existing.attachments ? deserializeArray(existing.attachments) : []
    for (const att of attachments) {
      await deleteFile('diets', att.filename)
    }

    await prisma.diet.update({
      where: { id },
      data: { deleteAt: Math.floor(Date.now() / 1000) }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Diet DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
