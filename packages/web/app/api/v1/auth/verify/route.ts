import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json({ valid: false }, { status: 400 })
    }

    // 由于 key 是哈希存储的，需要遍历所有未删除的 key 进行 bcrypt 比较
    const keys = await prisma.apiKey.findMany({
      where: { deleteAt: 0 },
      include: { user: true }
    })

    let matchedKey = null
    for (const key of keys) {
      const isMatch = await bcrypt.compare(apiKey, key.key)
      if (isMatch) {
        matchedKey = key
        break
      }
    }

    if (!matchedKey) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }

    await prisma.apiKey.update({
      where: { id: matchedKey.id },
      data: { lastUsed: new Date() }
    })

    return NextResponse.json({
      valid: true,
      user: matchedKey.user.name || matchedKey.user.email || 'Unknown',
      keyName: matchedKey.name
    })
  } catch (error) {
    console.error('Auth verify error:', error)
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
