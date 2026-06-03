import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { syncRegistry, registerBuiltinSources } from '@/lib/sync/registry'

/**
 * POST /api/v1/sync/login
 *
 * 分步二维码登录流程，避免 API Route 超时：
 *
 * Step 1: POST { sourceId } → 获取二维码 URL
 *   Response: { qrUrl, longPollingUrl, step: "scan" }
 *
 * Step 2: POST { sourceId, longPollingUrl } → 等待扫码并保存 Token
 *   Response: { success: true } 或 { error: "...", step: "retry" }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { sourceId, longPollingUrl } = body

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
  }

  await registerBuiltinSources()
  const source = syncRegistry.get(sourceId)
  if (!source) {
    return NextResponse.json({ error: `Unknown source: ${sourceId}` }, { status: 400 })
  }

  try {
    // Step 2: 有 longPollingUrl → 长轮询等待扫码
    if (longPollingUrl) {
      const token = await source.authenticate({ longPollingUrl })

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

      return NextResponse.json({
        success: true,
        message: '登录成功，Token 已保存',
      })
    }

    // Step 1: 获取二维码
    const token = await source.authenticate({})

    // token 包含 qrUrl 和 longPollingUrl，返回给前端
    return NextResponse.json({
      step: 'scan',
      qrUrl: token.qrUrl,
      longPollingUrl: token.longPollingUrl,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, step: 'retry' },
      { status: 500 },
    )
  }
}
