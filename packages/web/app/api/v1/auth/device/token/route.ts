import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { storeAccessToken } from '@/lib/device-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceCode } = body

    if (!deviceCode) {
      return NextResponse.json({
        error: 'invalid_request',
        error_description: 'device_code is required',
      }, { status: 400 })
    }

    const code = await prisma.deviceCode.findUnique({
      where: { deviceCode },
    })

    if (!code) {
      return NextResponse.json({
        error: 'invalid_grant',
        error_description: 'Invalid device code',
      }, { status: 400 })
    }

    if (new Date() > code.expiresAt) {
      await prisma.deviceCode.delete({ where: { deviceCode } })
      return NextResponse.json({
        error: 'expired_token',
        error_description: 'Device code has expired',
      }, { status: 400 })
    }

    if (code.status === 'pending') {
      return NextResponse.json({
        error: 'authorization_pending',
        error_description: 'User has not yet authorized the device',
      }, { status: 400 })
    }

    if (code.status === 'approved' && code.userId) {
      const token = randomUUID()
      await storeAccessToken(token, code.userId)

      await prisma.deviceCode.delete({ where: { deviceCode } })

      return NextResponse.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 1209600,
      })
    }

    return NextResponse.json({
      error: 'authorization_pending',
      error_description: 'User has not yet authorized the device',
    }, { status: 400 })
  } catch (error) {
    console.error('Device token error:', error)
    return NextResponse.json({
      error: 'server_error',
      error_description: 'Internal server error',
    }, { status: 500 })
  }
}
