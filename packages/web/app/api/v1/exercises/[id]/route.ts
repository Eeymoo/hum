import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeArray, serializeArray } from '@/lib/prisma'
import { getAuth, requireWriteAuth } from '@/lib/auth'
import { saveFile, validateFile, deleteFile } from '@/lib/file'
import { parseActivities } from '@/lib/utils'
import { deserializeExercise } from '@/lib/serializers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await getAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const exercise = await prisma.exercise.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!exercise || exercise.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(deserializeExercise(exercise))
  } catch (error) {
    console.error('Exercise GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await requireWriteAuth(await getAuth(request))
  if (!authResult) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const existing = await prisma.exercise.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!existing || existing.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const type = formData.get('type') as string | null
    const durationStr = formData.get('duration') as string | null
    const caloriesBurnedStr = formData.get('caloriesBurned') as string | null
    const activitiesStr = formData.get('activities') as string | null
    const heartRateAvgStr = formData.get('heartRateAvg') as string | null
    const heartRateMaxStr = formData.get('heartRateMax') as string | null
    const feelingStr = formData.get('feeling') as string | null
    const location = formData.get('location') as string | null
    const note = formData.get('note') as string | null
    const dateStr = formData.get('date') as string | null
    const files = formData.getAll('file') as File[]
    const replaceAttachments = formData.get('replaceAttachments') === 'true'
    const extraDataStr = formData.get('extraData') as string | null

    const existingAttachments = existing.attachments ? deserializeArray(existing.attachments) : []
    let newAttachments = replaceAttachments ? [] : [...existingAttachments]

    for (const file of files) {
      validateFile(file)
      const attachment = await saveFile('exercises', file)
      newAttachments.push(attachment)
    }

    const data: any = {}
    if (type) data.type = type
    if (durationStr) data.duration = parseInt(durationStr, 10)
    if (caloriesBurnedStr !== undefined) data.caloriesBurned = caloriesBurnedStr ? parseInt(caloriesBurnedStr, 10) : null
    if (activitiesStr !== undefined) data.activities = JSON.stringify(parseActivities(activitiesStr))
    if (heartRateAvgStr !== undefined) data.heartRateAvg = heartRateAvgStr ? parseInt(heartRateAvgStr, 10) : null
    if (heartRateMaxStr !== undefined) data.heartRateMax = heartRateMaxStr ? parseInt(heartRateMaxStr, 10) : null
    if (feelingStr !== undefined) data.feeling = feelingStr ? parseInt(feelingStr, 10) : null
    if (location !== undefined) data.location = location
    if (note !== undefined) data.note = note
    if (extraDataStr !== undefined) data.extraData = extraDataStr || null
    if (dateStr) data.date = new Date(dateStr)
    data.attachments = serializeArray(newAttachments)

    const updated = await prisma.exercise.update({
      where: { id },
      data
    })
    return NextResponse.json(deserializeExercise(updated))
  } catch (error) {
    console.error('Exercise PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await requireWriteAuth(await getAuth(request))
  if (!authResult) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const existing = await prisma.exercise.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!existing || existing.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const attachments = existing.attachments ? deserializeArray(existing.attachments) : []
    for (const att of attachments) {
      await deleteFile('exercises', att.filename)
    }

    await prisma.exercise.update({
      where: { id },
      data: { deleteAt: Math.floor(Date.now() / 1000) }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Exercise DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
