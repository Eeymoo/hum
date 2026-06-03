import prisma from '@/lib/prisma'
import { syncRegistry, registerBuiltinSources } from './registry'
import type { AuthToken, SyncResult } from './types'

/**
 * SyncEngine - 同步引擎
 *
 * 负责执行同步任务、记录日志、更新同步状态。
 * 不依赖具体的数据源实现，通过 SyncRegistry 获取数据源。
 */
export class SyncEngine {
  private initialized = false

  /**
   * 确保数据源已注册（幂等）
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    await registerBuiltinSources()
    this.initialized = true
  }

  /**
   * 执行一次同步任务
   */
  async executeJob(jobId: string): Promise<SyncResult> {
    await this.ensureInitialized()

    const job = await prisma.syncJob.findUnique({
      where: { id: jobId },
      include: { sourceConfig: true },
    })

    if (!job) {
      throw new Error(`SyncJob ${jobId} not found`)
    }

    // 更新状态为 running
    await prisma.syncJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    })

    const source = syncRegistry.get(job.sourceId)
    if (!source) {
      await this.failJob(jobId, `数据源 ${job.sourceId} 未注册`)
      return { success: false, syncedRecords: { exercise: 0, sleep: 0, weight: 0, diet: 0 }, errors: [{ type: 'config', message: '数据源未注册' }] }
    }

    try {
      // 解析配置和 Token
      const config = JSON.parse(job.sourceConfig.config || '{}')
      const token: AuthToken = job.sourceConfig.token
        ? JSON.parse(job.sourceConfig.token)
        : {}

      const result = await source.sync({
        userId: job.userId,
        startDate: job.startDate,
        endDate: job.endDate,
        config,
        token,
      })

      // 记录同步结果
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: result.success ? 'success' : 'failed',
          result: JSON.stringify(result),
          finishedAt: new Date(),
          error: result.errors.length > 0 ? result.errors.map(e => e.message).join('; ') : null,
        },
      })

      // 更新最后同步时间
      await prisma.syncSourceConfig.update({
        where: { id: job.sourceConfigId },
        data: { lastSyncAt: new Date() },
      })

      // 记录日志
      await this.log(jobId, 'info', `同步完成: exercise=${result.syncedRecords.exercise}, sleep=${result.syncedRecords.sleep}, weight=${result.syncedRecords.weight}`)

      return result
    } catch (error: any) {
      await this.failJob(jobId, error.message)
      return { success: false, syncedRecords: { exercise: 0, sleep: 0, weight: 0, diet: 0 }, errors: [{ type: 'unknown', message: error.message }] }
    }
  }

  /**
   * 创建并执行同步任务
   */
  async createAndRunJob(
    userId: string,
    sourceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ jobId: string; result: SyncResult }> {
    await this.ensureInitialized()

    const sourceConfig = await prisma.syncSourceConfig.findUnique({
      where: { userId_sourceId: { userId, sourceId } },
    })

    if (!sourceConfig) {
      throw new Error(`未找到 ${sourceId} 的配置，请先配置同步源`)
    }

    const end = endDate || new Date()
    const start = startDate || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)

    const job = await prisma.syncJob.create({
      data: {
        userId,
        sourceId,
        sourceConfigId: sourceConfig.id,
        status: 'pending',
        startDate: start,
        endDate: end,
      },
    })

    const result = await this.executeJob(job.id)
    return { jobId: job.id, result }
  }

  /**
   * 标记任务失败
   */
  private async failJob(jobId: string, error: string): Promise<void> {
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error,
        finishedAt: new Date(),
      },
    })
    await this.log(jobId, 'error', error)
  }

  /**
   * 记录同步日志
   */
  private async log(jobId: string, level: string, message: string): Promise<void> {
    await prisma.syncLog.create({
      data: { jobId, level, message },
    })
  }
}

// 全局单例
export const syncEngine = new SyncEngine()
