import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { key } = await params
    const body = await request.json()
    const { value } = body

    if (value === undefined || value === null) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 })
    }

    const setting = await prisma.userSetting.upsert({
      where: {
        userId_key: {
          userId: authResult.userId,
          key
        }
      },
      update: { value: String(value) },
      create: {
        userId: authResult.userId,
        key,
        value: String(value)
      }
    })

    return NextResponse.json({ setting })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
