import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptToken, decryptToken, isSyncEncryptionAvailable } from '@/lib/sync/crypto'

const ORIGINAL_KEY = process.env.SYNC_TOKEN_SECRET

describe('sync crypto', () => {
  afterEach(() => {
    // 恢复环境变量
    if (ORIGINAL_KEY === undefined) delete process.env.SYNC_TOKEN_SECRET
    else process.env.SYNC_TOKEN_SECRET = ORIGINAL_KEY
  })

  describe('isSyncEncryptionAvailable', () => {
    it('配置了 SYNC_TOKEN_SECRET 时可用', () => {
      process.env.SYNC_TOKEN_SECRET = 'test-secret-key-123456'
      expect(isSyncEncryptionAvailable()).toBe(true)
    })

    it('未配置时不可用', () => {
      delete process.env.SYNC_TOKEN_SECRET
      expect(isSyncEncryptionAvailable()).toBe(false)
    })
  })

  describe('encrypt / decrypt 往返', () => {
    beforeEach(() => {
      process.env.SYNC_TOKEN_SECRET = 'test-secret-key-123456'
    })

    it('加密后解密还原原文', () => {
      const plain = JSON.stringify({ service_token: 'abc', user_id: '123' })
      const cipher = encryptToken(plain)
      expect(cipher).not.toBe(plain)
      expect(decryptToken(cipher)).toBe(plain)
    })

    it('密文带 v1 前缀', () => {
      const cipher = encryptToken('hello')
      expect(cipher.startsWith('v1.')).toBe(true)
      // 格式：v1.<iv>.<tag>.<ciphertext> → 4 段
      expect(cipher.split('.')).toHaveLength(4)
    })

    it('密文不可直接读出明文', () => {
      const cipher = encryptToken('sensitive-secret-token')
      expect(cipher).not.toContain('sensitive-secret-token')
    })

    it('每次加密产生不同密文（随机 IV）', () => {
      const c1 = encryptToken('same')
      const c2 = encryptToken('same')
      expect(c1).not.toBe(c2)
      expect(decryptToken(c1)).toBe('same')
      expect(decryptToken(c2)).toBe('same')
    })

    it('篡改密文后解密失败', () => {
      const cipher = encryptToken('data')
      const tampered = cipher.slice(0, -2) + 'XX'
      expect(() => decryptToken(tampered)).toThrow()
    })
  })

  describe('明文懒迁移', () => {
    it('旧明文字符串（非 v1 前缀）原样返回', () => {
      process.env.SYNC_TOKEN_SECRET = 'key'
      const legacyPlain = '{"service_token":"old"}'
      expect(decryptToken(legacyPlain)).toBe(legacyPlain)
    })

    it('密钥缺失时加密抛错', () => {
      delete process.env.SYNC_TOKEN_SECRET
      expect(() => encryptToken('x')).toThrow(/SYNC_TOKEN_SECRET/)
    })

    it('密钥缺失时解密 v1 密文抛错', () => {
      process.env.SYNC_TOKEN_SECRET = 'k1'
      const cipher = encryptToken('secret')
      delete process.env.SYNC_TOKEN_SECRET
      expect(() => decryptToken(cipher)).toThrow(/SYNC_TOKEN_SECRET/)
    })
  })
})
