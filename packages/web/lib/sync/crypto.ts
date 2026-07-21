import crypto from 'crypto'

// ============================================================
// 同步凭证加密：AES-256-GCM
//
// 密钥来源：SYNC_TOKEN_SECRET 环境变量（至少 32 字节）
// 密文格式：v1.<iv>.<tag>.<ciphertext>（均 base64url）
// 启动时密钥缺失 → 同步功能禁用（不阻塞主应用），见 isSyncEncryptionAvailable()
// ============================================================

const VERSION = 'v1'

function getSecretKey(): string {
  return process.env.SYNC_TOKEN_SECRET || ''
}

function getRawKey(): Buffer {
  // 接受任意长度的 secret，统一派生为 32 字节密钥
  return crypto.createHash('sha256').update(getSecretKey()).digest()
}

/** 加密功能是否可用（SYNC_TOKEN_SECRET 已配置） */
export function isSyncEncryptionAvailable(): boolean {
  return getSecretKey().length > 0
}

/**
 * 加密任意对象（JSON 序列化后 AES-256-GCM 加密）
 * 输入明文 JSON 字符串，返回 v1.<iv>.<tag>.<ciphertext>
 */
export function encryptToken(plaintext: string): string {
  if (!isSyncEncryptionAvailable()) {
    throw new Error('SYNC_TOKEN_SECRET 未配置，无法加密同步凭证')
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getRawKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

/**
 * 解密 encryptToken 产出的密文
 * - 成功：返回原始明文字符串
 * - 输入不是 v1 密文（旧明文 JSON）：直接返回原值，由调用方触发懒迁移
 * - 解密失败（密钥变更/篡改）：抛错
 */
export function decryptToken(stored: string): string {
  if (!stored.startsWith('v1.')) {
    // 旧明文凭证，原样返回（调用方读取后会重写为密文）
    return stored
  }
  if (!isSyncEncryptionAvailable()) {
    throw new Error('SYNC_TOKEN_SECRET 未配置，无法解密同步凭证')
  }
  const parts = stored.split('.')
  if (parts.length !== 4) {
    throw new Error('凭证密文格式错误')
  }
  const [, ivB64, tagB64, ciphertextB64] = parts
  const decipher = crypto.createDecipheriv('aes-256-gcm', getRawKey(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64url')), decipher.final()])
  return plain.toString('utf8')
}
