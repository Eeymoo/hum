import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { waitForQrScan } from '@/lib/sync/sources/miapi'
import { getSession, updateSession, deleteSession } from '@/lib/sync/qr-session'

/**
 * POST /api/v1/sync/login/qr-poll
 *
 * 二维码扫码结果轮询：
 * - 首次调用：启动长轮询（等待用户扫码），立即返回 waiting
 * - 后续调用：检查长轮询是否完成，返回结果
 *
 * Body: { sessionId }
 * Response: { status: 'waiting' | 'scanned' | 'expired' | 'error' }
 */

// 后台轮询 Promise 缓存（防止重复发起）
const pollingPromises = new Map<string, Promise<void>>()

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { sessionId } = body

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const qrSession = getSession(sessionId)
  if (!qrSession) {
    return NextResponse.json({ error: '会话不存在或已过期' }, { status: 404 })
  }

  // 如果已经有最终状态，直接返回
  if (qrSession.status === 'scanned') {
    // 保存 token 到数据库
    if (qrSession.token) {
      await saveToken(session.user.id, qrSession.token)
    }
    // 清理会话
    deleteSession(sessionId)
    pollingPromises.delete(sessionId)
    return NextResponse.json({ status: 'scanned' })
  }

  if (qrSession.status === 'error') {
    const err = qrSession.error
    deleteSession(sessionId)
    pollingPromises.delete(sessionId)
    return NextResponse.json({ status: 'error', error: err })
  }

  if (qrSession.status === 'expired') {
    deleteSession(sessionId)
    pollingPromises.delete(sessionId)
    return NextResponse.json({ status: 'expired' })
  }

  // status === 'pending': 启动长轮询（仅首次）
  if (!pollingPromises.has(sessionId)) {
    const promise = startBackgroundPoll(sessionId, qrSession.lpUrl)
    pollingPromises.set(sessionId, promise)
    // 不 await，后台执行
    promise.catch(() => {}) // 防止 unhandled rejection
  }

  return NextResponse.json({ status: 'waiting' })
}

/**
 * 后台长轮询：等待用户扫码，完成后更新会话状态
 */
async function startBackgroundPoll(sessionId: string, lpUrl: string): Promise<void> {
  try {
    const token = await waitForQrScan(lpUrl)

    updateSession(sessionId, {
      status: 'scanned',
      token: {
        ...token,
        accessToken: token.service_token,
      },
    })
  } catch (error: any) {
    const msg = error.message || String(error)

    // 超时类错误 → expired
    if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('abort')) {
      updateSession(sessionId, { status: 'expired' })
    } else {
      updateSession(sessionId, { status: 'error', error: msg })
    }
  }
}

/**
 * 保存 token 到数据库
 */
async function saveToken(userId: string, token: any) {
  await prisma.syncSourceConfig.upsert({
    where: {
      userId_sourceId: {
        userId,
        sourceId: 'miapi',
      },
    },
    update: {
      token: JSON.stringify(token),
    },
    create: {
      userId,
      sourceId: 'miapi',
      token: JSON.stringify(token),
    },
  })
}
