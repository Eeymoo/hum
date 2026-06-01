import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  const authResult = await getAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tokens = await prisma.shareToken.findMany({
      where: { userId: authResult.userId, deleteAt: 0 },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { viewLogs: true } }
      }
    })

    return NextResponse.json({ tokens })
  } catch (error) {
    console.error('Share tokens GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await getAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name } = body

    const token = `share_${randomUUID().replace(/-/g, '')}`

    const shareToken = await prisma.shareToken.create({
      data: {
        userId: authResult.userId,
        name: name || 'Read-only Share',
        token
      }
    })

    return NextResponse.json({ shareToken })
  } catch (error) {
    console.error('Share token POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
