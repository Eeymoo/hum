import { NextRequest, NextResponse } from 'next/server'
import prisma, { serializeRecordData, serializeArray, deserializeRecord } from '@/lib/prisma'
import { getAuth, requireWriteAuth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const includeDeleted = searchParams.get('includeDeleted') === 'true'

    const where: any = { id, userId: authResult.userId }
    if (!includeDeleted) {
      where.deleteAt = 0
    }

    const record = await prisma.record.findFirst({ where })

    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    return NextResponse.json(deserializeRecord(record))
  } catch (error) {
    console.error('Record GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireWriteAuth(await getAuth(request))
  if (!authResult) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { data, tags, note, attachments, date } = body

    const existing = await prisma.record.findFirst({
      where: { id, userId: authResult.userId }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (data !== undefined) {
      updateData.data = serializeRecordData(data)
    }
    if (tags !== undefined) {
      updateData.tags = serializeArray(tags)
    }
    if (note !== undefined) {
      updateData.note = note
    }
    if (attachments !== undefined) {
      updateData.attachments = serializeArray(attachments)
    }
    if (date !== undefined) {
      updateData.date = new Date(date)
    }

    const record = await prisma.record.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(deserializeRecord(record))
  } catch (error) {
    console.error('Record PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireWriteAuth(await getAuth(request))
  if (!authResult) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params

    const existing = await prisma.record.findFirst({
      where: { id, userId: authResult.userId, deleteAt: 0 }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.record.update({
      where: { id },
      data: { deleteAt: Math.floor(Date.now() / 1000) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Record DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
