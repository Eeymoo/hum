import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    // Verify ownership
    const shareToken = await prisma.shareToken.findFirst({
      where: { id, userId: authResult.userId, deleteAt: 0 }
    })
    if (!shareToken) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      prisma.viewLog.findMany({
        where: { shareTokenId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.viewLog.count({
        where: { shareTokenId: id }
      })
    ])

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('View logs GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
