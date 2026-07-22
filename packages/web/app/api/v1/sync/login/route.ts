import { NextRequest, NextResponse } from 'next/server'
import { getAuth, requireWriteAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { syncRegistry, registerBuiltinSources } from '@/lib/sync/registry'
import { encryptToken } from '@/lib/sync/crypto'

/**
 * POST /api/v1/sync/login
 *
 * 两种认证模式：
 * 1. 密码登录：{ sourceId?, credentials: { username, password } }
 * 2. 手动导入 Token：{ sourceId?, credentials: {
 *      service_token, c_user_id,            // 必填
 *      pass_token?, user_id?, device_id?    // 可选，有 pass_token 时支持自动刷新
 *    }}
 * Response: { success: true } 或 { error: "...", step: "retry" }
 */
export async function POST(req: NextRequest) {
  const authResult = await requireWriteAuth(await getAuth(req))
  if (!authResult?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const sourceId = body.sourceId || 'miapi'
  const { credentials } = body

  if (!credentials || typeof credentials !== 'object') {
    return NextResponse.json(
      { error: 'credentials is required' },
      { status: 400 },
    )
  }

  // 校验凭据：密码模式或手动 Token 模式
  const hasPassword = credentials.username && credentials.password
  const hasManualToken = credentials.service_token && credentials.c_user_id

  if (!hasPassword && !hasManualToken) {
    return NextResponse.json(
      { error: '请提供 (username, password) 或 (service_token, c_user_id)' },
      { status: 400 },
    )
  }

  // 校验 UserSyncConfig：enabled=true
  const userConfig = await prisma.userSyncConfig.findUnique({
    where: { userId: authResult.userId },
  })

  if (!userConfig || !userConfig.enabled) {
    return NextResponse.json({ error: '同步功能未开启' }, { status: 400 })
  }

  // sourceId 只允许 miapi
  if (sourceId !== 'miapi') {
    return NextResponse.json(
      { error: `不支持的数据源: ${sourceId}` },
      { status: 400 },
    )
  }

  await registerBuiltinSources()
  const source = syncRegistry.get(sourceId)
  if (!source) {
    return NextResponse.json({ error: `Unknown source: ${sourceId}` }, { status: 400 })
  }

  try {
    const token = await source.authenticate(credentials)

    await prisma.syncSourceConfig.upsert({
      where: {
        userId_sourceId: {
          userId: authResult.userId,
          sourceId,
        },
      },
      update: {
        token: encryptToken(JSON.stringify(token)),
      },
      create: {
        userId: authResult.userId,
        sourceId,
        token: encryptToken(JSON.stringify(token)),
      },
    })

    return NextResponse.json({ success: true, message: 'Token 已保存' })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, step: 'retry' },
      { status: 500 },
    )
  }
}
