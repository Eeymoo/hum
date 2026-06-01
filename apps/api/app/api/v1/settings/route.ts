import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await prisma.userSetting.findMany({
      where: { userId: authResult.userId }
    })

    const result: Record<string, string> = {}
    for (const s of settings) {
      result[s.key] = s.value
    }

    return NextResponse.json({ settings: result })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
