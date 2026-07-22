import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getAuth: vi.fn(),
  requireWriteAuth: vi.fn(async (auth: unknown) => auth),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    userSyncConfig: { findUnique: vi.fn() },
    syncSourceConfig: { findUnique: vi.fn() },
    syncJob: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/sync/engine', () => ({
  syncEngine: { ensureInitialized: vi.fn(), createAndRunJob: vi.fn() },
}))

import { POST as triggerPOST } from '@/app/api/v1/sync/trigger/route'
import { getAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { syncEngine } from '@/lib/sync/engine'

const mockAuth = vi.mocked(getAuth)
const mockUserConfig = vi.mocked(prisma.userSyncConfig.findUnique)
const mockSourceConfig = vi.mocked(prisma.syncSourceConfig.findUnique)
const mockRunningJob = vi.mocked(prisma.syncJob.findFirst)
const mockCreateJob = vi.mocked(prisma.syncJob.create)
const mockRunJob = vi.mocked(syncEngine.createAndRunJob)

function req(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/v1/sync/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

describe('POST /api/v1/sync/trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: 'user-1' } as any)
  })

  it('未登录返回 401', async () => {
    mockAuth.mockResolvedValue(null as any)
    const res = await triggerPOST(req())
    expect(res.status).toBe(401)
  })

  it('同步未开启返回 400', async () => {
    mockUserConfig.mockResolvedValue({ enabled: false } as any)
    const res = await triggerPOST(req())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/未开启/)
  })

  it('无 sourceConfig（未登录小米）返回 400', async () => {
    mockUserConfig.mockResolvedValue({ enabled: true } as any)
    mockSourceConfig.mockResolvedValue(null)
    const res = await triggerPOST(req())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/登录/)
  })

  it('sourceConfig 无 token 返回 400 提示先登录', async () => {
    mockUserConfig.mockResolvedValue({ enabled: true } as any)
    mockSourceConfig.mockResolvedValue({ token: null } as any)
    const res = await triggerPOST(req())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/未授权|登录/)
  })

  it('已有运行中任务返回 409', async () => {
    mockUserConfig.mockResolvedValue({ enabled: true } as any)
    mockSourceConfig.mockResolvedValue({ token: 'v1.xxx' } as any)
    mockRunningJob.mockResolvedValue({ id: 'running-job' } as any)
    const res = await triggerPOST(req())
    expect(res.status).toBe(409)
  })

  it('正常触发返回同步结果', async () => {
    mockUserConfig.mockResolvedValue({ enabled: true } as any)
    mockSourceConfig.mockResolvedValue({ token: 'v1.xxx' } as any)
    mockRunningJob.mockResolvedValue(null)
    mockRunJob.mockResolvedValue({
      jobId: 'job-1',
      result: { success: true, syncedRecords: { exercise: 1, sleep: 1, weight: 1, diet: 0 }, errors: [] },
    })

    const res = await triggerPOST(req({ startDate: '2026-01-01' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.syncedRecords.exercise).toBe(1)
  })
})
