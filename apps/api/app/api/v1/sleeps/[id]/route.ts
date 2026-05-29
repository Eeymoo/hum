import { NextRequest, NextResponse } from 'next/server'
import prisma, { deserializeArray, serializeArray } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { saveFile, validateFile, deleteFile } from '@/lib/file'

function deserializeSleep(sleep: any) {
  return {
    ...sleep,
    attachments: sleep.attachments ? deserializeArray(sleep.attachments) : [],
    extraData: sleep.extraData ? JSON.parse(sleep.extraData) : null
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
    const sleep = await prisma.sleep.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!sleep || sleep.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(deserializeSleep(sleep))
  } catch (error) {
    console.error('Sleep GET error:', error)
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
    const existing = await prisma.sleep.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!existing || existing.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const durationStr = formData.get('duration') as string | null
    const bedTime = formData.get('bedTime') as string | null
    const wakeTime = formData.get('wakeTime') as string | null
    const qualityStr = formData.get('quality') as string | null
    const deepSleepStr = formData.get('deepSleep') as string | null
    const remSleepStr = formData.get('remSleep') as string | null
    const awakeningsStr = formData.get('awakenings') as string | null
    const feelingStr = formData.get('feeling') as string | null
    const note = formData.get('note') as string | null
    const dateStr = formData.get('date') as string | null
    const files = formData.getAll('file') as File[]
    const replaceAttachments = formData.get('replaceAttachments') === 'true'
    const extraDataStr = formData.get('extraData') as string | null

    const existingAttachments = existing.attachments ? deserializeArray(existing.attachments) : []
    let newAttachments = replaceAttachments ? [] : [...existingAttachments]

    for (const file of files) {
      validateFile(file)
      const attachment = await saveFile('sleeps', file)
      newAttachments.push(attachment)
    }

    const data: any = {}
    if (durationStr) data.duration = parseFloat(durationStr)
    if (bedTime) data.bedTime = bedTime
    if (wakeTime) data.wakeTime = wakeTime
    if (qualityStr) data.quality = parseInt(qualityStr, 10)
    if (deepSleepStr !== undefined) data.deepSleep = deepSleepStr ? parseFloat(deepSleepStr) : null
    if (remSleepStr !== undefined) data.remSleep = remSleepStr ? parseFloat(remSleepStr) : null
    if (awakeningsStr !== undefined) data.awakenings = awakeningsStr ? parseInt(awakeningsStr, 10) : null
    if (feelingStr !== undefined) data.feeling = feelingStr ? parseInt(feelingStr, 10) : null
    if (note !== undefined) data.note = note
    if (extraDataStr !== undefined) data.extraData = extraDataStr || null
    if (dateStr) data.date = new Date(dateStr)
    data.attachments = serializeArray(newAttachments)

    const updated = await prisma.sleep.update({
      where: { id },
      data
    })
    return NextResponse.json(deserializeSleep(updated))
  } catch (error) {
    console.error('Sleep PATCH error:', error)
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
    const existing = await prisma.sleep.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!existing || existing.deleteAt !== 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const attachments = existing.attachments ? deserializeArray(existing.attachments) : []
    for (const att of attachments) {
      await deleteFile('sleeps', att.filename)
    }

    await prisma.sleep.update({
      where: { id },
      data: { deleteAt: Math.floor(Date.now() / 1000) }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sleep DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
