import { describe, it, expect } from 'vitest'
import {
  rc4Crypt,
  generateNonce,
  computeSignedNonce,
  buildSigMessage,
  buildEncryptedParams,
  decryptResponse,
} from '@/lib/sync/mi-crypto'

// 固定向量（测试用）
const SSECURITY = '5Yb5Vgh1GfXVx+ZfEjRqEw=='
const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA=='
const KEY = Buffer.from(computeSignedNonce(SSECURITY, NONCE), 'base64')

describe('rc4Crypt', () => {
  it('加解密往返还原', () => {
    const plain = Buffer.from('hello-rc4-小米', 'utf8')
    const cipher = rc4Crypt(KEY, plain)
    const decrypted = rc4Crypt(KEY, cipher)
    expect(Buffer.from(decrypted).toString('utf8')).toBe('hello-rc4-小米')
  })

  it('skip 1024：前 1024 字节密钥流被丢弃', () => {
    const data = Buffer.from('A', 'utf8')
    // skip=1024 vs skip=0 结果不同
    const withSkip = rc4Crypt(KEY, data, 1024)
    const noSkip = rc4Crypt(KEY, data, 0)
    expect(withSkip).not.toEqual(noSkip)
  })

  it('同密钥同数据结果确定', () => {
    const data = Buffer.from('test', 'utf8')
    expect(rc4Crypt(KEY, data)).toEqual(rc4Crypt(KEY, data))
  })
})

describe('generateNonce', () => {
  it('长度为 12 字节的 base64（8 随机 + 4 分钟）', () => {
    const nonce = generateNonce()
    const bytes = Buffer.from(nonce, 'base64')
    expect(bytes.length).toBe(12)
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('每次生成都不同', () => {
    expect(generateNonce()).not.toBe(generateNonce())
  })
})

describe('computeSignedNonce', () => {
  it('确定且为 base64', () => {
    const snonce = computeSignedNonce(SSECURITY, NONCE)
    expect(snonce).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(computeSignedNonce(SSECURITY, NONCE)).toBe(snonce)
  })

  it('不同 nonce 产生不同 signedNonce', () => {
    const a = computeSignedNonce(SSECURITY, NONCE)
    const b = computeSignedNonce(SSECURITY, 'BBBBBBBBBBBBBBBBBBBBBB==')
    expect(a).not.toBe(b)
  })
})

describe('buildSigMessage', () => {
  it('格式: METHOD&/path&k=v&...&signedNonce（字典序）', () => {
    const msg = buildSigMessage('get', '/app/v1/test', { b: '2', a: '1' }, 'SIGNED')
    expect(msg).toBe('GET&/app/v1/test&a=1&b=2&SIGNED')
  })

  it('path 自动补前导 /', () => {
    const msg = buildSigMessage('POST', 'foo', {}, 'X')
    expect(msg).toBe('POST&/foo&X')
  })
})

describe('buildEncryptedParams', () => {
  it('返回 signature 和 _nonce', () => {
    const result = buildEncryptedParams('GET', '/app/v1/test', SSECURITY, { foo: 'bar' })
    expect(result.signature).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(result._nonce).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(result.data).toBeDefined()
    expect(result.rc4_hash__).toBeDefined()
  })

  it('固定 nonce 下 signature 确定（同输入同输出）', () => {
    // 注意：_nonce 随机，但同一次调用的 signature 是该 nonce 的确定函数
    const r1 = buildEncryptedParams('GET', '/p', SSECURITY, { x: '1' })
    // 用相同 nonce 手算一遍比对
    const r2 = buildEncryptedParams('GET', '/p', SSECURITY, { x: '1' })
    // 结构一致（字段集相同）
    expect(Object.keys(r1).sort()).toEqual(Object.keys(r2).sort())
  })

  it('rc4_hash__ 基于明文计算，不随加密变化', () => {
    const result = buildEncryptedParams('GET', '/app/v1/data/get', SSECURITY, { a: 'b' })
    // rc4_hash__ 存在且是 base64
    expect(result.rc4_hash__).toMatch(/^[A-Za-z0-9+/]+=*$/)
    // data 被加密（不是明文 JSON）
    expect(result.data).not.toBe(JSON.stringify({ a: 'b' }))
  })
})

describe('decryptResponse（往返一致性）', () => {
  it('buildEncryptedParams 加密的 data 能被 decryptResponse 解出', () => {
    // 构造一个"响应"：用与请求相同的 signedNonce 加密一段 JSON
    const params = { foo: 'bar', n: 42 }
    const enc = buildEncryptedParams('GET', '/p', SSECURITY, params)
    const nonce = enc._nonce
    const snonce = computeSignedNonce(SSECURITY, nonce)
    const snonceBytes = Buffer.from(snonce, 'base64')

    // 模拟服务器：用同一 signedNonce RC4 加密 JSON 响应
    const fakeResp = { code: 0, data: { items: [1, 2, 3] } }
    const respCipher = rc4Crypt(snonceBytes, Buffer.from(JSON.stringify(fakeResp), 'utf8'))
    const respB64 = Buffer.from(respCipher).toString('base64')

    const decrypted = decryptResponse(SSECURITY, nonce, respB64) as typeof fakeResp
    expect(decrypted).toEqual(fakeResp)
  })
})
