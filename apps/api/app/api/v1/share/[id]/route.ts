import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { isActive, name } = body

    // Verify ownership
    const existing = await prisma.shareToken.findFirst({
      where: { id, userId: authResult.userId, deleteAt: 0 }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const data: any = {}
    if (typeof isActive === 'boolean') data.isActive = isActive
    if (name !== undefined) data.name = name

    const token = await prisma.shareToken.update({
      where: { id },
      data
    })

    return NextResponse.json({ token })
  } catch (error) {
    console.error('Share token PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    // Verify ownership
    const existing = await prisma.shareToken.findFirst({
      where: { id, userId: authResult.userId, deleteAt: 0 }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.shareToken.update({
      where: { id },
      data: { deleteAt: Math.floor(Date.now() / 1000) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Share token DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
