import prisma from './prisma'
import { auth } from '@/auth'

export async function verifyApiKey(authHeader: string | null | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  
  const key = authHeader.slice(7)
  const apiKey = await prisma.apiKey.findUnique({ where: { key } })
  
  if (!apiKey) {
    return null
  }
  
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() }
  })
  
  return apiKey
}

// 同时支持 API Key、Session 和 Share Token 认证
export async function verifyAuth(request: Request) {
  // 先尝试 API Key 认证
  const authHeader = request.headers.get('authorization')
  const apiKeyResult = await verifyApiKey(authHeader)
  
  if (apiKeyResult) {
    return { type: 'apiKey' as const, userId: apiKeyResult.userId }
  }
  
  // 再尝试 Session 认证（NextAuth）
  try {
    const session = await auth()
    if (session?.user?.id) {
      return { type: 'session' as const, userId: session.user.id }
    }
  } catch {
    // Session 验证失败
  }

  // 尝试 Share Token 认证（只读）
  try {
    const url = new URL(request.url)
    const shareToken = url.searchParams.get('token')
    if (shareToken) {
      const token = await prisma.shareToken.findUnique({
        where: { token: shareToken, deleteAt: 0 }
      })
      if (token && token.isActive) {
        return { type: 'shareToken' as const, userId: token.userId, readOnly: true }
      }
    }
  } catch {
    // Share Token 验证失败
  }
  
  return null
}

// 写操作认证 - 拒绝只读 share token
export async function verifyWriteAuth(request: Request) {
  const authResult = await verifyAuth(request)
  if (!authResult) return null
  if ('readOnly' in authResult && authResult.readOnly) return null
  return authResult
}
