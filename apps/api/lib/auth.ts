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

// 同时支持 API Key 和 Session 认证
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
  
  return null
}
