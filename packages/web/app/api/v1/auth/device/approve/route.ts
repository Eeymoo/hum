import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userCode } = body

    if (!userCode) {
      return NextResponse.json({ error: 'user_code is required' }, { status: 400 })
    }

    const deviceCode = await prisma.deviceCode.findUnique({
      where: { userCode },
    })

    if (!deviceCode) {
      return NextResponse.json({ error: 'invalid_code', error_description: 'Invalid device code' }, { status: 404 })
    }

    if (new Date() > deviceCode.expiresAt) {
      await prisma.deviceCode.delete({ where: { userCode } })
      return NextResponse.json({ error: 'expired_token', error_description: 'Device code has expired' }, { status: 400 })
    }

    if (deviceCode.status !== 'pending') {
      return NextResponse.json({ error: 'already_approved', error_description: 'Device code has already been used' }, { status: 400 })
    }

    await prisma.deviceCode.update({
      where: { userCode },
      data: {
        status: 'approved',
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Device approve error:', error)
    return NextResponse.json({ error: 'server_error', error_description: 'Internal server error' }, { status: 500 })
  }
}
