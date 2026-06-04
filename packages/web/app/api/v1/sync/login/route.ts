import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { syncRegistry, registerBuiltinSources } from '@/lib/sync/registry'

/**
 * POST /api/v1/sync/login
 *
 * 支持两种登录模式：
 *
 * 模式 A — 二维码登录（如 mifitness）：
 *   Step 1: POST { sourceId } → 获取二维码 URL
 *     Response: { qrUrl, longPollingUrl, step: "scan" }
 *   Step 2: POST { sourceId, longPollingUrl } → 等待扫码并保存 Token
 *     Response: { success: true } 或 { error: "...", step: "retry" }
 *
 * 模式 B — 密码登录（如 miapi）：
 *   POST { sourceId, credentials: { username, password } } → 登录并保存 Token
 *   Response: { success: true } 或 { error: "...", step: "retry" }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { sourceId, longPollingUrl, credentials } = body

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
  }

  await registerBuiltinSources()
  const source = syncRegistry.get(sourceId)
  if (!source) {
    return NextResponse.json({ error: `Unknown source: ${sourceId}` }, { status: 400 })
  }

  // 构建传给 authenticate 的参数
  const authCredentials: Record<string, unknown> = {}

  try {
    // 模式 A - Step 2: 有 longPollingUrl → 长轮询等待扫码
    if (longPollingUrl) {
      authCredentials.longPollingUrl = longPollingUrl
    }

    // 模式 B: 密码登录，credentials 包含 username/password 等字段
    if (credentials && typeof credentials === 'object') {
      Object.assign(authCredentials, credentials)
    }

    const token = await source.authenticate(authCredentials)

    // 保存 token 到 SyncSourceConfig
    await prisma.syncSourceConfig.upsert({
      where: {
        userId_sourceId: {
          userId: session.user.id,
          sourceId,
        },
      },
      update: {
        token: JSON.stringify(token),
      },
      create: {
        userId: session.user.id,
        sourceId,
        enabled: false,
        token: JSON.stringify(token),
      },
    })

    // 模式 A - Step 1: 二维码登录首次调用，返回二维码信息
    if (!longPollingUrl && !credentials && token.qrUrl) {
      return NextResponse.json({
        step: 'scan',
        qrUrl: token.qrUrl,
        longPollingUrl: token.longPollingUrl,
      })
    }

    // 登录成功（密码登录 或 扫码完成）
    return NextResponse.json({
      success: true,
      message: '登录成功，Token 已保存',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, step: 'retry' },
      { status: 500 },
    )
  }
}
