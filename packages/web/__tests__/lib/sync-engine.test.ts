import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Mocks ---
const mockSync = vi.fn()
const mockSource = {
  id: 'miapi',
  name: 'test',
  description: '',
  configSchema: [],
  authenticate: vi.fn(),
  sync: mockSync,
}

vi.mock('@/lib/prisma', () => ({
  default: {
    syncJob: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    syncSourceConfig: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    syncLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/sync/registry', () => ({
  syncRegistry: {
    get: vi.fn(() => mockSource),
  },
  registerBuiltinSources: vi.fn(),
}))

import { syncEngine } from '@/lib/sync/engine'
import prisma from '@/lib/prisma'

const mockJobFindUnique = vi.mocked(prisma.syncJob.findUnique)
const mockJobUpdate = vi.mocked(prisma.syncJob.update)
const mockSourceConfigUpdate = vi.mocked(prisma.syncSourceConfig.update)
const mockLogCreate = vi.mocked(prisma.syncLog.create)

const ORIGINAL_KEY = process.env.SYNC_TOKEN_SECRET

describe('SyncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SYNC_TOKEN_SECRET = 'engine-test-key-123456'
    mockSync.mockReset()
  })

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.SYNC_TOKEN_SECRET
    else process.env.SYNC_TOKEN_SECRET = ORIGINAL_KEY
  })

  it('同步成功：状态 running → success，token 解密后传给 sync', async () => {
    const { encryptToken } = await import('@/lib/sync/crypto')
    const tokenObj = { service_token: 'st', user_id: 'u1', c_user_id: 'c1' }

    mockJobFindUnique.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      sourceId: 'miapi',
      sourceConfigId: 'cfg-1',
      startDate: new Date(),
      endDate: new Date(),
      sourceConfig: {
        id: 'cfg-1',
        userId: 'user-1',
        sourceId: 'miapi',
        config: '{}',
        token: encryptToken(JSON.stringify(tokenObj)),
      },
    } as any)

    mockSync.mockResolvedValue({
      success: true,
      syncedRecords: { exercise: 3, sleep: 2, weight: 1, diet: 0 },
      errors: [],
    })

    const result = await syncEngine.executeJob('job-1')

    // sync 收到的 token 是解密后的明文对象
    expect(result.success).toBe(true)
    expect(mockSync).toHaveBeenCalledOnce()
    const syncArg = mockSync.mock.calls[0][0]
    expect(syncArg.token).toMatchObject({ service_token: 'st', user_id: 'u1' })

    // 状态更新：running → success
    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1' }, data: expect.objectContaining({ status: 'running' }) }),
    )
    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'success' }) }),
    )
  })

  it('数据源未注册：任务标记 failed', async () => {
    const { syncRegistry } = await import('@/lib/sync/registry')
    vi.mocked(syncRegistry.get).mockReturnValueOnce(undefined)

    mockJobFindUnique.mockResolvedValue({
      id: 'job-2', userId: 'user-1', sourceId: 'miapi', sourceConfigId: 'cfg-1',
      startDate: new Date(), endDate: new Date(),
      sourceConfig: { id: 'cfg-1', userId: 'user-1', sourceId: 'miapi', config: '{}', token: null },
    } as any)

    const result = await syncEngine.executeJob('job-2')

    expect(result.success).toBe(false)
    expect(result.errors[0].message).toMatch(/未注册/)
    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    )
  })

  it('source.sync 抛错：任务标记 failed 并记录错误', async () => {
    mockJobFindUnique.mockResolvedValue({
      id: 'job-3', userId: 'user-1', sourceId: 'miapi', sourceConfigId: 'cfg-1',
      startDate: new Date(), endDate: new Date(),
      sourceConfig: { id: 'cfg-1', userId: 'user-1', sourceId: 'miapi', config: '{}', token: null },
    } as any)

    mockSync.mockRejectedValue(new Error('网络超时'))

    const result = await syncEngine.executeJob('job-3')

    expect(result.success).toBe(false)
    expect(result.errors[0].message).toBe('网络超时')
    expect(mockJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed', error: '网络超时' }) }),
    )
  })

  it('明文 token 懒迁移：读取明文后重写为密文', async () => {
    const { encryptToken, decryptToken } = await import('@/lib/sync/crypto')
    const plainToken = JSON.stringify({ service_token: 'legacy', user_id: 'u' })

    mockJobFindUnique.mockResolvedValue({
      id: 'job-4', userId: 'user-1', sourceId: 'miapi', sourceConfigId: 'cfg-1',
      startDate: new Date(), endDate: new Date(),
      sourceConfig: { id: 'cfg-1', userId: 'user-1', sourceId: 'miapi', config: '{}', token: plainToken },
    } as any)

    mockSync.mockResolvedValue({
      success: true,
      syncedRecords: { exercise: 0, sleep: 0, weight: 0, diet: 0 },
      errors: [],
    })

    await syncEngine.executeJob('job-4')

    // 应该触发 update 重写 token 为密文
    const updateCall = mockSourceConfigUpdate.mock.calls.find(
      (c) => c[0]?.data?.token,
    )
    expect(updateCall).toBeDefined()
    const rewrittenToken = updateCall![0].data.token
    expect(rewrittenToken.startsWith('v1.')).toBe(true)
    // 解密后仍是原明文
    expect(decryptToken(rewrittenToken)).toBe(plainToken)
  })
})
