import { describe, it, expect } from 'vitest'
import { parseMiResponse, hashPassword, computeClientSign } from '@/lib/sync/sources/miapi'

describe('parseMiResponse', () => {
  it('去除 &&&START&&& 前缀并解析 JSON', () => {
    const raw = '&&&START&&&{"code":0,"desc":"ok"}'
    expect(parseMiResponse(raw)).toEqual({ code: 0, desc: 'ok' })
  })

  it('无前缀时直接解析', () => {
    expect(parseMiResponse('{"a":1}')).toEqual({ a: 1 })
  })

  it('尾部空白在 trim 后正确解析', () => {
    expect(parseMiResponse('&&&START&&&{"b":2}  ')).toEqual({ b: 2 })
  })

  it('非 JSON 返回空对象', () => {
    expect(parseMiResponse('&&&START&&&not-json')).toEqual({})
  })

  it('数字字符串按 JSON 解析为对应类型', () => {
    // String(123) = '123' 是合法 JSON，parseMiResponse 返回数字
    expect(parseMiResponse(123 as any)).toBe(123)
  })
})

describe('hashPassword', () => {
  it('MD5 大写', () => {
    // md5("123456") = e10adc3949ba59abbe56e057f20f883e
    expect(hashPassword('123456')).toBe('E10ADC3949BA59ABBE56E057F20F883E')
  })

  it('相同输入结果稳定', () => {
    expect(hashPassword('test')).toBe(hashPassword('test'))
  })
})

describe('computeClientSign', () => {
  it('SHA1("nonce={nonce}&{ssecurity}") → Base64', () => {
    // 固定向量：crypto.createHash('sha1').update('nonce=12345&secret').digest('base64')
    const expected = '2UoytDN6anPJG1Z6aQPmjBALCX0=' // precomputed
    expect(computeClientSign(12345, 'secret')).toBe(expected)
  })

  it('nonce 为字符串时与数字等价（拼接到同一字符串）', () => {
    expect(computeClientSign('12345', 'secret')).toBe(computeClientSign(12345, 'secret'))
  })
})
