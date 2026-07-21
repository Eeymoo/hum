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

// 会话 TTL：10 分钟（小米二维码有效期 5 分钟 + 长轮询/处理余量）
const SESSION_TTL = 10 * 60 * 1000

function isExpired(session: QrSession): boolean {
  return Date.now() - session.createdAt > SESSION_TTL
}

function cleanup() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) {
      sessions.delete(id)
    }
  }
}

// 定期清理过期会话（每 2 分钟），避免长期不再 createSession 时内存泄漏
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(cleanup, 2 * 60 * 1000)
  if (typeof timer === 'object' && 'unref' in timer) {
    ;(timer as NodeJS.Timeout).unref()
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
  const session = sessions.get(sessionId)
  if (!session) return undefined
  // 读取时检查过期：过期则删除并返回 undefined
  if (isExpired(session)) {
    sessions.delete(sessionId)
    return undefined
  }
  return session
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
