import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'

const DEVICE_CODE_EXPIRY = 600000
const POLLING_INTERVAL = 5

function generateUserCode(): string {
  const chars = 'BCDFGHJKLMNPQRSTVWXYZ'
  const nums = '23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
    code += nums[Math.floor(Math.random() * nums.length)]
  }
  return code.slice(0, 4) + '-' + code.slice(4)
}

export async function POST() {
  const deviceCode = randomUUID()
  const userCode = generateUserCode()
  const expiresAt = new Date(Date.now() + DEVICE_CODE_EXPIRY)

  await prisma.deviceCode.create({
    data: {
      deviceCode,
      userCode,
      expiresAt,
    },
  })

  return NextResponse.json({
    deviceCode,
    userCode,
    verificationUriComplete: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login/device?code=${userCode}`,
    verificationUri: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login/device`,
    expiresIn: DEVICE_CODE_EXPIRY / 1000,
    interval: POLLING_INTERVAL,
  })
}

export async function GET() {
  const now = new Date()
  // 清理已过期的 device codes
  await prisma.deviceCode.deleteMany({
    where: { expiresAt: { lt: now }, status: 'pending' },
  })

  const codes = await prisma.deviceCode.findMany()
  return NextResponse.json({
    codes: codes.map((c) => ({
      deviceCode: c.deviceCode,
      userCode: c.userCode,
      status: c.status,
      expiresAt: c.expiresAt.getTime(),
    })),
  })
}
