/**
 * QR Session Store - 二维码扫码登录的会话管理
 *
 * 使用内存 Map 存储扫码会话状态。
 * 适用于单实例部署（Docker standalone）。
 */

export interface QrSession {
  /** 小米长轮询 URL */
  lpUrl: string
  /** 会话状态 */
  status: 'pending' | 'scanned' | 'expired' | 'error'
  /** 扫码成功后的 token */
  token?: {
    user_id: string
    c_user_id: string
    service_token: string
    ssecurity: string
    pass_token: string
    device_id: string
    accessToken: string
  }
  /** 错误信息 */
  error?: string
  /** 创建时间 */
  createdAt: number
}

// 全局会话存储
const sessions = new Map<string, QrSession>()

// 清理超过 5 分钟的会话
const SESSION_TTL = 5 * 60 * 1000

function cleanup() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) {
      sessions.delete(id)
    }
  }
}

export function createSession(sessionId: string, lpUrl: string): QrSession {
  cleanup()
  const session: QrSession = {
    lpUrl,
    status: 'pending',
    createdAt: Date.now(),
  }
  sessions.set(sessionId, session)
  return session
}

export function getSession(sessionId: string): QrSession | undefined {
  return sessions.get(sessionId)
}

export function updateSession(sessionId: string, update: Partial<QrSession>): void {
  const session = sessions.get(sessionId)
  if (session) {
    Object.assign(session, update)
  }
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId)
}
