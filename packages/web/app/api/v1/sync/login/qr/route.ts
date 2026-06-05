import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getQrCode } from '@/lib/sync/sources/miapi'
import { createSession } from '@/lib/sync/qr-session'

/**
 * POST /api/v1/sync/login/qr
 *
 * 初始化二维码扫码登录：
 * 1. 调用小米 API 获取二维码图片 URL + 长轮询 URL
 * 2. 创建会话并启动后台长轮询
 * 3. 返回二维码图片 URL + sessionId 给前端
 *
 * Response: { qrImageUrl, sessionId }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 调用小米 API 获取二维码
    const { qrImageUrl, longPollingUrl } = await getQrCode()

    // 生成会话 ID
    const sessionId = crypto.randomUUID().replace(/-/g, '')

    // 存储会话
    createSession(sessionId, longPollingUrl)

    return NextResponse.json({
      qrImageUrl,
      sessionId,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: `获取二维码失败: ${error.message}` },
      { status: 500 },
    )
  }
}
