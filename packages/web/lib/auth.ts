import prisma from './prisma'
import { auth } from '@/auth'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { validateAccessToken } from './device-auth'

export interface AuthContext {
  userId: string
  type: 'apiKey' | 'session' | 'shareToken' | 'accessToken'
  readOnly: boolean
  source: 'header' | 'cookie' | 'param'
  tokenId?: string
}

export type AuthResult = AuthContext | null

// 内部辅助：验证 API Key
async function _verifyApiKey(authHeader: string | null): Promise<AuthContext | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const key = authHeader.slice(7)

  // 由于 key 是哈希存储的，需要遍历所有未删除的 key 进行 bcrypt 比较
  const apiKeys = await prisma.apiKey.findMany({ where: { deleteAt: 0 } })

  for (const apiKey of apiKeys) {
    const isMatch = await bcrypt.compare(key, apiKey.key)
    if (isMatch) {
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsed: new Date() }
      })
      return {
        userId: apiKey.userId,
        type: 'apiKey',
        readOnly: false,
        source: 'header',
        tokenId: apiKey.id
      }
    }
  }

  return null
}

// 内部辅助：验证 Access Token（device flow 颁发）
async function _verifyAccessToken(authHeader: string | null): Promise<AuthContext | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)

  // 先尝试 API Key，如果匹配就跳过 access token 验证
  // 避免和 _verifyApiKey 重复查询

  const userId = await validateAccessToken(token)
  if (!userId) return null

  return {
    userId,
    type: 'accessToken',
    readOnly: false,
    source: 'header',
  }
}

// 内部辅助：验证 Session
async function _verifySession(): Promise<AuthContext | null> {
  try {
    const session = await auth()
    if (session?.user?.id) {
      return {
        userId: session.user.id,
        type: 'session',
        readOnly: false,
        source: 'cookie'
      }
    }
  } catch {
    // Session 验证失败
  }
  return null
}

// 内部辅助：验证 Share Token
async function _verifyShareToken(
  tokenValue: string | null,
  source: 'header' | 'param',
  request?: NextRequest
): Promise<AuthContext | null> {
  if (!tokenValue) return null

  try {
    const token = await prisma.shareToken.findUnique({
      where: { token: tokenValue, deleteAt: 0 }
    })
    if (!token || !token.isActive) return null

    // 记录访问日志
    if (request) {
      const forwarded = request.headers.get('x-forwarded-for')
      const ip = forwarded ? forwarded.split(',')[0].trim() : (request.headers.get('x-real-ip') || null)
      const userAgent = request.headers.get('user-agent') || null

      await prisma.viewLog.create({
        data: {
          shareTokenId: token.id,
          token: token.token,
          ip,
          userAgent,
          path: request.nextUrl.pathname
        }
      })

      await prisma.shareToken.update({
        where: { id: token.id },
        data: { lastUsed: new Date() }
      })
    }

    return {
      userId: token.userId,
      type: 'shareToken',
      readOnly: true,
      source,
      tokenId: token.id
    }
  } catch {
    return null
  }
}

/**
 * 统一认证入口
 * 优先级：API Key → Session → Share Token
 * Share Token 支持 x-share-token header（优先）和 URL ?token=（兼容）
 */
export async function getAuth(req: NextRequest): Promise<AuthResult> {
  // 1. API Key
  const authHeader = req.headers.get('authorization')
  const apiKeyAuth = await _verifyApiKey(authHeader)
  if (apiKeyAuth) return apiKeyAuth

  // 2. Access Token（device flow 颁发）
  const accessTokenAuth = await _verifyAccessToken(authHeader)
  if (accessTokenAuth) return accessTokenAuth

  // 3. Session
  const sessionAuth = await _verifySession()
  if (sessionAuth) return sessionAuth

  // 4. Share Token（优先 header）
  const shareTokenHeader = req.headers.get('x-share-token')
  if (shareTokenHeader) {
    const shareAuth = await _verifyShareToken(shareTokenHeader, 'header', req)
    if (shareAuth) return shareAuth
  }

  // 5. Share Token（兼容 URL param）
  const shareTokenParam = req.nextUrl.searchParams.get('token')
  if (shareTokenParam) {
    const shareAuth = await _verifyShareToken(shareTokenParam, 'param', req)
    if (shareAuth) return shareAuth
  }

  return null
}

/**
 * 要求写权限
 * 如果认证结果是只读（share token），返回 null
 */
export async function requireWriteAuth(auth: AuthResult): Promise<AuthResult> {
  if (!auth) return null
  if (auth.readOnly) return null
  return auth
}

// ── 向后兼容的旧 API ──

/** @deprecated 使用 getAuth(req) 替代 */
export async function verifyAuth(request: Request) {
  const req = request as unknown as NextRequest
  const authResult = await getAuth(req)
  if (!authResult) return null
  // 保持旧返回结构兼容
  return { type: authResult.type, userId: authResult.userId, readOnly: authResult.readOnly }
}

/** @deprecated 使用 requireWriteAuth(await getAuth(req)) 替代 */
export async function verifyWriteAuth(request: Request) {
  const authResult = await verifyAuth(request)
  if (!authResult) return null
  if ('readOnly' in authResult && authResult.readOnly) return null
  return authResult
}
