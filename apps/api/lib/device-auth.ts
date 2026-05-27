const accessTokens = new Map<string, {
  token: string
  userId: string
  expiresAt: number
}>()

export function storeAccessToken(token: string, userId: string, expiresIn: number = 3600000) {
  accessTokens.set(token, {
    token,
    userId,
    expiresAt: Date.now() + expiresIn
  })
}

export function validateAccessToken(token: string) {
  const data = accessTokens.get(token)
  if (!data) return null
  if (Date.now() > data.expiresAt) {
    accessTokens.delete(token)
    return null
  }
  return data.userId
}

export function deleteAccessToken(token: string) {
  accessTokens.delete(token)
}
