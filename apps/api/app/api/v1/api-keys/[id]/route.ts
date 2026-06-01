import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth, verifyWriteAuth } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyWriteAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId: authResult.userId }
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.apiKey.update({
      where: { id },
      data: { deleteAt: Math.floor(Date.now() / 1000) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API key DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
