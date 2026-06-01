import prisma from './prisma'

export async function storeAccessToken(token: string, userId: string, expiresIn: number = 1209600000) {
  await prisma.accessToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + expiresIn),
    },
  })
}

export async function validateAccessToken(token: string) {
  const data = await prisma.accessToken.findUnique({
    where: { token },
  })
  if (!data) return null
  if (new Date() > data.expiresAt) {
    await prisma.accessToken.delete({ where: { token } })
    return null
  }
  return data.userId
}

export async function deleteAccessToken(token: string) {
  await prisma.accessToken.delete({ where: { token } }).catch(() => {})
}
