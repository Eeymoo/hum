import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'

const accessTokens = new Map<string, {
  token: string
  userId: string
  expiresAt: number
}>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { deviceCode, userCode } = body

    if (!deviceCode) {
      return NextResponse.json({
        error: 'invalid_request',
        error_description: 'device_code is required'
      }, { status: 400 })
    }

    const now = Date.now()
    const codeData = (await import('@/app/api/v1/auth/device/route')).deviceCodes?.get(deviceCode)

    const deviceCodes = (global as any).__deviceCodes
    const code = deviceCodes?.get(deviceCode)

    if (!code) {
      return NextResponse.json({
        error: 'invalid_grant',
        error_description: 'Invalid device code'
      }, { status: 400 })
    }

    if (code.status === 'pending') {
      return NextResponse.json({
        error: 'authorization_pending',
        error_description: 'User has not yet authorized the device'
      }, { status: 400 })
    }

    if (code.status === 'expired') {
      return NextResponse.json({
        error: 'expired_token',
        error_description: 'Device code has expired'
      }, { status: 400 })
    }

    if (code.status === 'approved' && code.userId) {
      const token = randomUUID()
      const expiresAt = now + 3600000

      accessTokens.set(token, {
        token,
        userId: code.userId,
        expiresAt
      })

      deviceCodes.delete(deviceCode)

      return NextResponse.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 3600
      })
    }

    return NextResponse.json({
      error: 'authorization_pending',
      error_description: 'User has not yet authorized the device'
    }, { status: 400 })
  } catch (error) {
    console.error('Device token error:', error)
    return NextResponse.json({
      error: 'server_error',
      error_description: 'Internal server error'
    }, { status: 500 })
  }
}

export function validateAccessToken(token: string) {
  const data = accessTokens.get(token)
  if (!data) return null
  if (Date.now() > data.expiresAt) {
    accessTokens.delete(token)
    return null
  }
  return data.userId
}
