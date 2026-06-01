import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit } from '@/lib/rate-limiter'

describe('rateLimiter', () => {
  beforeEach(() => {
    // 由于 rate-limiter 使用模块级 Map，我们需要等待窗口过期
    // 这里通过使用不同的 IP 来隔离测试
  })

  it('新 IP 第一次请求应返回 true', () => {
    const ip = '192.168.1.1'
    const result = rateLimit(ip, 5, 60000)
    expect(result).toBe(true)
  })

  it('超过限制返回 false', () => {
    const ip = '192.168.1.2'
    const maxAttempts = 3
    // 前 3 次应通过
    expect(rateLimit(ip, maxAttempts, 60000)).toBe(true)
    expect(rateLimit(ip, maxAttempts, 60000)).toBe(true)
    expect(rateLimit(ip, maxAttempts, 60000)).toBe(true)
    // 第 4 次应被拒绝
    expect(rateLimit(ip, maxAttempts, 60000)).toBe(false)
  })

  it('窗口过期后重置', () => {
    const ip = '192.168.1.3'
    const maxAttempts = 2
    const windowMs = 50 // 50ms 窗口，方便测试

    // 用满限制
    rateLimit(ip, maxAttempts, windowMs)
    rateLimit(ip, maxAttempts, windowMs)
    expect(rateLimit(ip, maxAttempts, windowMs)).toBe(false)

    // 等待窗口过期
    return new Promise((resolve) => {
      setTimeout(() => {
        // 窗口过期后应重置
        expect(rateLimit(ip, maxAttempts, windowMs)).toBe(true)
        resolve(undefined)
      }, windowMs + 10)
    })
  })
})
