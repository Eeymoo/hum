import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createSession, getSession, updateSession, deleteSession } from '@/lib/sync/qr-session'

describe('qr-session', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('创建并获取会话', () => {
    const s = createSession('sess-1', 'https://lp.example.com/k1')
    expect(s.status).toBe('pending')
    expect(getSession('sess-1')).toBe(s)
  })

  it('更新会话状态', () => {
    createSession('sess-2', 'https://lp.example.com/k2')
    updateSession('sess-2', { status: 'scanned', token: { accessToken: 'x' } as any })
    expect(getSession('sess-2')?.status).toBe('scanned')
    expect(getSession('sess-2')?.token?.accessToken).toBe('x')
  })

  it('删除会话', () => {
    createSession('sess-3', 'https://lp.example.com/k3')
    deleteSession('sess-3')
    expect(getSession('sess-3')).toBeUndefined()
  })

  it('不存在的会话返回 undefined', () => {
    expect(getSession('nope')).toBeUndefined()
  })

  it('会话过期后 getSession 返回 undefined 并清理', () => {
    vi.useFakeTimers()
    createSession('sess-expired', 'https://lp.example.com/k4')
    // 快进 11 分钟（超过 10 分钟 TTL）
    vi.setSystemTime(new Date(Date.now() + 11 * 60 * 1000))
    expect(getSession('sess-expired')).toBeUndefined()
  })

  it('未过期的会话正常返回', () => {
    vi.useFakeTimers()
    createSession('sess-fresh', 'https://lp.example.com/k5')
    vi.setSystemTime(new Date(Date.now() + 5 * 60 * 1000))
    expect(getSession('sess-fresh')).toBeDefined()
  })
})
