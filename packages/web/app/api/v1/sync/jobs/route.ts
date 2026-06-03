import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'

/**
 * GET /api/v1/sync/jobs?sourceId=xxx&limit=20
 * 获取同步任务历史
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sourceId = searchParams.get('sourceId')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  const where: any = { userId: session.user.id }
  if (sourceId) {
    where.sourceId = sourceId
  }

  const jobs = await prisma.syncJob.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      logs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  })

  return NextResponse.json({
    jobs: jobs.map(j => ({
      id: j.id,
      sourceId: j.sourceId,
      status: j.status,
      startDate: j.startDate,
      endDate: j.endDate,
      result: j.result ? JSON.parse(j.result) : null,
      error: j.error,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt,
      createdAt: j.createdAt,
      logs: j.logs.map(l => ({
        level: l.level,
        message: l.message,
        data: l.data ? JSON.parse(l.data) : null,
        createdAt: l.createdAt,
      })),
    })),
  })
}
