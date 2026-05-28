import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeArray, serializeArray } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { saveFile, validateFile, deleteFile } from '@/lib/file'

function deserializeWeight(weight: any) {
  return {
    ...weight,
    attachments: weight.attachments ? deserializeArray(weight.attachments) : []
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
    const weight = await prisma.weight.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!weight || weight.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(deserializeWeight(weight))
  } catch (error) {
    console.error('Weight GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const existing = await prisma.weight.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!existing || existing.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const weightStr = formData.get('weight') as string | null
    const bodyFatStr = formData.get('bodyFat') as string | null
    const muscleMassStr = formData.get('muscleMass') as string | null
    const bmiStr = formData.get('bmi') as string | null
    const waterStr = formData.get('water') as string | null
    const boneMassStr = formData.get('boneMass') as string | null
    const visceralFatStr = formData.get('visceralFat') as string | null
    const note = formData.get('note') as string | null
    const dateStr = formData.get('date') as string | null
    const files = formData.getAll('file') as File[]
    const replaceAttachments = formData.get('replaceAttachments') === 'true'

    const existingAttachments = existing.attachments ? deserializeArray(existing.attachments) : []
    let newAttachments = replaceAttachments ? [] : [...existingAttachments]

    for (const file of files) {
      validateFile(file)
      const attachment = await saveFile('weights', file)
      newAttachments.push(attachment)
    }

    const data: any = {}
    if (weightStr) data.weight = parseFloat(weightStr)
    if (bodyFatStr !== undefined) data.bodyFat = bodyFatStr ? parseFloat(bodyFatStr) : null
    if (muscleMassStr !== undefined) data.muscleMass = muscleMassStr ? parseFloat(muscleMassStr) : null
    if (bmiStr !== undefined) data.bmi = bmiStr ? parseFloat(bmiStr) : null
    if (waterStr !== undefined) data.water = waterStr ? parseFloat(waterStr) : null
    if (boneMassStr !== undefined) data.boneMass = boneMassStr ? parseFloat(boneMassStr) : null
    if (visceralFatStr !== undefined) data.visceralFat = visceralFatStr ? parseInt(visceralFatStr, 10) : null
    if (note !== undefined) data.note = note
    if (dateStr) data.date = new Date(dateStr)
    data.attachments = serializeArray(newAttachments)

    const updated = await prisma.weight.update({
      where: { id },
      data
    })
    return NextResponse.json(deserializeWeight(updated))
  } catch (error) {
    console.error('Weight PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const existing = await prisma.weight.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!existing || existing.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const attachments = existing.attachments ? deserializeArray(existing.attachments) : []
    for (const att of attachments) {
      await deleteFile('weights', att.filename)
    }

    await prisma.weight.update({
      where: { id },
      data: { deleteAt: Date.now() }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Weight DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
