/**
 * Next.js Instrumentation - 服务启动时初始化
 *
 * Next.js 15 支持 instrumentation.ts 文件在服务启动时执行一次性初始化逻辑。
 * 这里用于启动同步调度器（node-cron 定时任务）。
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 只在 Node.js 运行时执行（跳过 Edge Runtime）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initScheduler } = await import('./lib/sync/scheduler')
      await initScheduler()
      console.log('[Instrumentation] 同步调度器初始化完成')
    } catch (error) {
      // 初始化失败不应阻塞应用启动
      console.warn('[Instrumentation] 同步调度器初始化失败:', error instanceof Error ? error.message : String(error))
    }
  }
}
