import { NextRequest, NextResponse } from 'next/server'
import { getAuth, requireWriteAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { syncEngine } from '@/lib/sync/engine'

const SOURCE_ID = 'miapi'

/**
 * POST /api/v1/sync/trigger
 * 手动触发同步（守卫逻辑：enabled + token + 无运行中任务）
 */
export async function POST(req: NextRequest) {
  const authResult = await requireWriteAuth(await getAuth(req))
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userConfig = await prisma.userSyncConfig.findUnique({
    where: { userId: authResult.userId },
  })

  if (!userConfig || !userConfig.enabled) {
    return NextResponse.json({ error: '同步功能未开启' }, { status: 400 })
  }

  const sourceConfig = await prisma.syncSourceConfig.findUnique({
    where: {
      userId_sourceId: { userId: authResult.userId, sourceId: SOURCE_ID },
    },
  })

  if (!sourceConfig) {
    return NextResponse.json(
      { error: '未找到 miapi 的配置，请先完成登录' },
      { status: 400 },
    )
  }

  if (!sourceConfig.token) {
    return NextResponse.json(
      { error: 'miapi 未授权，请先登录' },
      { status: 400 },
    )
  }

  const runningJob = await prisma.syncJob.findFirst({
    where: {
      userId: authResult.userId,
      sourceId: SOURCE_ID,
      status: 'running',
    },
  })

  if (runningJob) {
    return NextResponse.json(
      { error: '当前已有同步任务正在运行，请稍后再试', jobId: runningJob.id },
      { status: 409 },
    )
  }

  const body = await req.json()
  const { startDate, endDate } = body

  try {
    const { jobId, result } = await syncEngine.createAndRunJob(
      authResult.userId,
      SOURCE_ID,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    )

    return NextResponse.json({
      jobId,
      success: result.success,
      syncedRecords: result.syncedRecords,
      errors: result.errors,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    )
  }
}
