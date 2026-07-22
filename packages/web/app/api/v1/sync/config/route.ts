import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuth, requireWriteAuth } from '@/lib/auth'
import { scheduleTask, stopTask } from '@/lib/sync/scheduler'

const DEFAULT_SOURCE_ID = 'miapi'

interface SyncConfig {
  sourceId?: string
  cron?: string
  config?: Record<string, unknown>
}

/**
 * 获取或创建用户的 UserSyncConfig（确保每用户一条）
 */
async function ensureUserSyncConfig(userId: string) {
  return prisma.userSyncConfig.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
}

/**
 * 解析 providerConfig JSON
 */
function parseSyncConfig(raw: string | null): SyncConfig {
  try {
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
}

/**
 * GET /api/v1/sync/config
 * 返回用户的 UserSyncConfig 及所有 SyncSourceConfig
 */
export async function GET(req: NextRequest) {
  const authResult = await getAuth(req)
  if (!authResult?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [userConfig, sourceConfigs] = await Promise.all([
    ensureUserSyncConfig(authResult.userId),
    prisma.syncSourceConfig.findMany({
      where: { userId: authResult.userId },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({
    userConfig: {
      enabled: userConfig.enabled,
      provider: userConfig.provider,
      providerConfig: parseSyncConfig(userConfig.providerConfig),
    },
    sourceConfigs: sourceConfigs.map((c) => ({
      id: c.id,
      sourceId: c.sourceId,
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
 * 操作：toggle | save_config
 */
export async function POST(req: NextRequest) {
  const authResult = await requireWriteAuth(await getAuth(req))
  if (!authResult?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body

  const userConfig = await ensureUserSyncConfig(authResult.userId)

  switch (action) {
    case 'toggle':
      return handleToggle(authResult.userId, userConfig, body.enabled)
    case 'save_config':
      return handleSaveConfig(authResult.userId, userConfig, body)
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}

/**
 * 切换总开关
 * 关闭时：停止定时任务、清空 provider、清空所有 SyncSourceConfig 的 token
 * 开启时：自动设置 provider 为 'MIAPI'
 */
async function handleToggle(
  userId: string,
  userConfig: Awaited<ReturnType<typeof ensureUserSyncConfig>>,
  enabled: unknown,
) {
  const newEnabled = !!enabled

  if (!newEnabled) {
    const sourceConfigs = await prisma.syncSourceConfig.findMany({
      where: { userId },
    })

    for (const sc of sourceConfigs) {
      stopTask(sc.id)
    }

    await Promise.all(
      sourceConfigs.map((sc) =>
        prisma.syncSourceConfig.update({
          where: { id: sc.id },
          data: { token: null },
        }),
      ),
    )

    await prisma.userSyncConfig.update({
      where: { id: userConfig.id },
      data: { enabled: false, provider: null, providerConfig: '{}' },
    })

    return NextResponse.json({
      userConfig: { enabled: false, provider: null, providerConfig: {} },
    })
  }

  // 开启：设置 enabled=true，自动设置 provider 为 MIAPI
  await prisma.userSyncConfig.update({
    where: { id: userConfig.id },
    data: { enabled: true, provider: 'MIAPI' },
  })

  return NextResponse.json({
    userConfig: {
      enabled: true,
      provider: 'MIAPI',
      providerConfig: parseSyncConfig(userConfig.providerConfig),
    },
  })
}

/**
 * 保存 miapi 的 SyncSourceConfig 配置
 * 写入 providerConfig 并同步更新/创建 SyncSourceConfig
 */
async function handleSaveConfig(
  userId: string,
  userConfig: Awaited<ReturnType<typeof ensureUserSyncConfig>>,
  body: { cron?: string; config?: Record<string, unknown> },
) {
  if (!userConfig.enabled) {
    return NextResponse.json(
      { error: '请先开启同步' },
      { status: 400 },
    )
  }

  const sourceId = DEFAULT_SOURCE_ID
  const { cron, config } = body

  const newSyncConfig: SyncConfig = {
    sourceId,
    cron: cron || '0 9 * * *',
    config: config || {},
  }

  await prisma.userSyncConfig.update({
    where: { id: userConfig.id },
    data: {
      provider: 'MIAPI',
      providerConfig: JSON.stringify(newSyncConfig),
    },
  })

  const cronValue = newSyncConfig.cron!
  const configValue = JSON.stringify(newSyncConfig.config || {})
  const syncSourceConfig = await prisma.syncSourceConfig.upsert({
    where: { userId_sourceId: { userId, sourceId } },
    update: { cron: cronValue, config: configValue },
    create: { userId, sourceId, cron: cronValue, config: configValue },
  })

  if (syncSourceConfig.token) {
    scheduleTask(syncSourceConfig.id, cronValue, userId, sourceId)
  }

  return NextResponse.json({
    userConfig: {
      enabled: userConfig.enabled,
      provider: 'MIAPI',
      providerConfig: newSyncConfig,
    },
    syncSourceConfig: {
      id: syncSourceConfig.id,
      sourceId: syncSourceConfig.sourceId,
      cron: syncSourceConfig.cron,
      config: JSON.parse(syncSourceConfig.config || '{}'),
      hasToken: !!syncSourceConfig.token,
    },
  })
}

/**
 * DELETE /api/v1/sync/config?sourceId=xxx
 * 删除同步源配置
 */
export async function DELETE(req: NextRequest) {
  const authResult = await getAuth(req)
  if (!authResult?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sourceId = searchParams.get('sourceId')

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
  }

  const config = await prisma.syncSourceConfig.findUnique({
    where: { userId_sourceId: { userId: authResult.userId, sourceId } },
  })

  if (config) {
    stopTask(config.id)
    await prisma.syncSourceConfig.delete({ where: { id: config.id } })
  }

  return NextResponse.json({ success: true })
}
