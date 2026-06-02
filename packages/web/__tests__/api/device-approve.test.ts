import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    deviceCode: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

import { POST } from '@/app/api/v1/auth/device/approve/route'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'

const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.deviceCode.findUnique)
const mockUpdate = vi.mocked(prisma.deviceCode.update)
const mockDelete = vi.mocked(prisma.deviceCode.delete)

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/v1/auth/device/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

describe('POST /api/v1/auth/device/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as any)
  })

  it('未登录时返回 401', async () => {
    mockAuth.mockResolvedValue(null as any)

    const res = await POST(createRequest({ userCode: 'AB1C-2D3E' }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('缺少 userCode 时返回 400', async () => {
    const res = await POST(createRequest({}))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'user_code is required' })
  })

  it('无效的 userCode 返回 404', async () => {
    mockFindUnique.mockResolvedValue(null)

    const res = await POST(createRequest({ userCode: 'INVALID' }))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'invalid_code', error_description: 'Invalid device code' })
  })

  it('已过期返回 400 并删除记录', async () => {
    mockFindUnique.mockResolvedValue({
      userCode: 'AB1C-2D3E',
      expiresAt: new Date('2020-01-01'),
      status: 'pending',
    } as any)

    const res = await POST(createRequest({ userCode: 'AB1C-2D3E' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'expired_token', error_description: 'Device code has expired' })
    expect(mockDelete).toHaveBeenCalledWith({ where: { userCode: 'AB1C-2D3E' } })
  })

  it('已被使用返回 400', async () => {
    mockFindUnique.mockResolvedValue({
      userCode: 'AB1C-2D3E',
      expiresAt: new Date('2099-01-01'),
      status: 'approved',
    } as any)

    const res = await POST(createRequest({ userCode: 'AB1C-2D3E' }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'already_approved', error_description: 'Device code has already been used' })
  })

  it('成功授权返回 200', async () => {
    mockFindUnique.mockResolvedValue({
      userCode: 'AB1C-2D3E',
      expiresAt: new Date('2099-01-01'),
      status: 'pending',
    } as any)

    const res = await POST(createRequest({ userCode: 'AB1C-2D3E' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userCode: 'AB1C-2D3E' },
      data: { status: 'approved', userId: 'user-1' },
    })
  })

  it('异常处理返回 500', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB error'))

    const res = await POST(createRequest({ userCode: 'AB1C-2D3E' }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'server_error', error_description: 'Internal server error' })
  })
})
