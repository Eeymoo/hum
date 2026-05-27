import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json({ valid: false }, { status: 400 })
    }

    const key = await prisma.apiKey.findUnique({ where: { key: apiKey } })

    if (!key) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }

    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsed: new Date() }
    })

    return NextResponse.json({ valid: true, name: key.name })
  } catch (error) {
    console.error('Auth verify error:', error)
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
