import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  try {
    const shareToken = await prisma.shareToken.findUnique({
      where: { token, deleteAt: 0 },
      include: { user: { select: { id: true, name: true } } }
    })

    if (!shareToken || !shareToken.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive token' }, { status: 404 })
    }

    // Log the view
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : (request.headers.get('x-real-ip') || null)
    const userAgent = request.headers.get('user-agent') || null
    const path = url.searchParams.get('path') || null

    await prisma.viewLog.create({
      data: {
        shareTokenId: shareToken.id,
        token: shareToken.token,
        ip,
        userAgent,
        path
      }
    })

    // Update lastUsed
    await prisma.shareToken.update({
      where: { id: shareToken.id },
      data: { lastUsed: new Date() }
    })

    return NextResponse.json({
      valid: true,
      userName: shareToken.user.name
    })
  } catch (error) {
    console.error('Share verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
