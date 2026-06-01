import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuth, requireWriteAuth } from '@/lib/auth'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
  const authResult = await getAuth(request)
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
  const authResult = await requireWriteAuth(await getAuth(request))
  if (!authResult) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name } = body

    const rawKey = 'hum_' + randomBytes(32).toString('hex')
    const hashedKey = await bcrypt.hash(rawKey, 10)

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: authResult.userId,
        name: name || 'API Key',
        key: hashedKey
      }
    })

    // 返回原始 key 给用户（仅此一次）
    return NextResponse.json({ apiKey: { ...apiKey, key: rawKey } })
  } catch (error) {
    console.error('API keys POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
