import prisma from '@/lib/prisma'
import { syncEngine } from './engine'
import { registerBuiltinSources } from './registry'

// 确保内置数据源已注册
registerBuiltinSources()

/**
 * SyncScheduler - 基于 node-cron 的定时同步调度器
 *
 * 在 Next.js 服务启动时初始化，读取所有 enabled=true 的 UserSyncConfig，
 * 为每个用户的当前 provider 创建对应的 cron 定时任务（单 provider 架构）。
 */

let cron: typeof import('node-cron') | null = null
const scheduledTasks: Map<string, import('node-cron').ScheduledTask> = new Map()

/**
 * 初始化调度器（需在服务启动时调用）
 */
export async function initScheduler(): Promise<void> {
  try {
    cron = await import('node-cron')
  } catch {
    console.warn('[SyncScheduler] node-cron 未安装，定时同步功能不可用。请运行: npm install node-cron')
    return
  }

  console.log('[SyncScheduler] 初始化定时同步调度器...')

  // 加载所有已启用同步的用户配置
  const userConfigs = await prisma.userSyncConfig.findMany({
    where: {
      enabled: true,
    },
  })

  const sourceId = 'miapi'

  for (const uc of userConfigs) {
    const sourceConfig = await prisma.syncSourceConfig.findUnique({
      where: { userId_sourceId: { userId: uc.userId, sourceId } },
    })

    if (sourceConfig?.token) {
      scheduleTask(sourceConfig.id, sourceConfig.cron, uc.userId, sourceId)
    }
  }

  console.log(`[SyncScheduler] 已加载 ${scheduledTasks.size} 个定时同步任务`)
}

/**
 * 为指定同步配置添加/更新 cron 任务
 */
export function scheduleTask(
  configId: string,
  cronExpression: string,
  userId: string,
  sourceId: string,
): void {
  if (!cron) return

  // 移除旧任务（如果存在）
  stopTask(configId)

  // 验证 cron 表达式
  if (!cron.validate(cronExpression)) {
    console.error(`[SyncScheduler] 无效的 cron 表达式: ${cronExpression}`)
    return
  }

  const task = cron.schedule(cronExpression, async () => {
    console.log(`[SyncScheduler] 执行定时同步: userId=${userId}, sourceId=${sourceId}`)
    try {
      await syncEngine.createAndRunJob(userId, sourceId)
    } catch (error: any) {
      console.error(`[SyncScheduler] 同步失败: ${error.message}`)
    }
  })

  scheduledTasks.set(configId, task)
  console.log(`[SyncScheduler] 已注册 cron 任务: ${cronExpression} (configId=${configId})`)
}

/**
 * 停止指定配置的 cron 任务
 */
export function stopTask(configId: string): void {
  const task = scheduledTasks.get(configId)
  if (task) {
    task.stop()
    scheduledTasks.delete(configId)
  }
}

/**
 * 停止所有 cron 任务
 */
export function stopAllTasks(): void {
  for (const [id, task] of scheduledTasks) {
    task.stop()
    scheduledTasks.delete(id)
  }
  console.log('[SyncScheduler] 已停止所有定时任务')
}

/**
 * 获取当前运行中的任务数量
 */
export function getRunningTaskCount(): number {
  return scheduledTasks.size
}
