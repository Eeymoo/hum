import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: authResult.userId, deleteAt: 0 },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ keys })
  } catch (error) {
    console.error('API keys GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name } = body

    const key = randomUUID().replace(/-/g, '')

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: authResult.userId,
        name: name || 'API Key',
        key
      }
    })

    return NextResponse.json({ apiKey })
  } catch (error) {
    console.error('API keys POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
