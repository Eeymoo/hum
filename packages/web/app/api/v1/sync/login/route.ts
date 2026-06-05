import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { syncRegistry, registerBuiltinSources } from '@/lib/sync/registry'

/**
 * POST /api/v1/sync/login
 *
 * 密码登录（miapi）：
 *   POST { sourceId?, credentials: { username, password } } → 登录并保存 Token
 *   Response: { success: true } 或 { error: "...", step: "retry" }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const sourceId = body.sourceId || 'miapi'
  const { credentials } = body

  if (!credentials || typeof credentials !== 'object' || !credentials.username || !credentials.password) {
    return NextResponse.json(
      { error: 'credentials (username, password) is required' },
      { status: 400 },
    )
  }

  // 校验 UserSyncConfig：enabled=true
  const userConfig = await prisma.userSyncConfig.findUnique({
    where: { userId: session.user.id },
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
        token: JSON.stringify(token),
      },
    })

    return NextResponse.json({ success: true, message: '登录成功，Token 已保存' })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, step: 'retry' },
      { status: 500 },
    )
  }
}
