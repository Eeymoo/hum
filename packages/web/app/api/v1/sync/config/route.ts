import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { scheduleTask, stopTask } from '@/lib/sync/scheduler'

/**
 * GET /api/v1/sync/config
 * 获取当前用户的同步配置列表
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const configs = await prisma.syncSourceConfig.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    configs: configs.map(c => ({
      id: c.id,
      sourceId: c.sourceId,
      enabled: c.enabled,
      cron: c.cron,
      config: JSON.parse(c.config || '{}'),
      lastSyncAt: c.lastSyncAt,
      hasToken: !!c.token,
      createdAt: c.createdAt,
    })),
  })
}

/**
 * POST /api/v1/sync/config
 * 创建或更新同步源配置
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { sourceId, enabled, cron, config } = body

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
  }

  const upsertData = {
    enabled: enabled ?? false,
    cron: cron || '0 9 * * *',
    config: JSON.stringify(config || {}),
  }

  const result = await prisma.syncSourceConfig.upsert({
    where: {
      userId_sourceId: {
        userId: session.user.id,
        sourceId,
      },
    },
    update: upsertData,
    create: {
      userId: session.user.id,
      sourceId,
      ...upsertData,
    },
  })

  // 更新 cron 任务
  if (result.enabled) {
    scheduleTask(result.id, result.cron, result.userId, result.sourceId)
  } else {
    stopTask(result.id)
  }

  return NextResponse.json({
    config: {
      id: result.id,
      sourceId: result.sourceId,
      enabled: result.enabled,
      cron: result.cron,
      config: JSON.parse(result.config || '{}'),
      hasToken: !!result.token,
    },
  })
}

/**
 * DELETE /api/v1/sync/config?sourceId=xxx
 * 删除同步源配置
 */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sourceId = searchParams.get('sourceId')

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
  }

  // 停止 cron 任务
  const config = await prisma.syncSourceConfig.findUnique({
    where: { userId_sourceId: { userId: session.user.id, sourceId } },
  })

  if (config) {
    stopTask(config.id)
    await prisma.syncSourceConfig.delete({ where: { id: config.id } })
  }

  return NextResponse.json({ success: true })
}
