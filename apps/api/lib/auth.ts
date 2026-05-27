import prisma from './prisma'

export async function verifyApiKey(authHeader: string | undefined) {
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
