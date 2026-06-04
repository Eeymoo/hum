import type { SyncSource } from './types'

/**
 * SyncRegistry - 数据源注册中心
 *
 * 采用单例模式管理所有已注册的 SyncSource 实现。
 * 新增数据源时只需在此注册，无需修改调度器或 UI 代码。
 */
class SyncRegistry {
  private sources: Map<string, SyncSource> = new Map()

  register(source: SyncSource): void {
    if (this.sources.has(source.id)) {
      throw new Error(`Sync source "${source.id}" already registered`)
    }
    this.sources.set(source.id, source)
  }

  get(id: string): SyncSource | undefined {
    return this.sources.get(id)
  }

  getAll(): SyncSource[] {
    return Array.from(this.sources.values())
  }

  has(id: string): boolean {
    return this.sources.has(id)
  }

  unregister(id: string): boolean {
    return this.sources.delete(id)
  }
}

// 全局单例
export const syncRegistry = new SyncRegistry()

// 标记是否已注册，避免重复执行
let _registered = false

/**
 * 注册所有内置数据源
 *
 * 使用动态 import() 以兼容 Next.js App Router (webpack)。
 * 新增数据源时在此添加注册即可，无需修改其他文件。
 */
export async function registerBuiltinSources(): Promise<void> {
  if (_registered) return
  _registered = true

  try {
    // 动态 import 确保 webpack 能正确打包
    const { MiFitnessSource } = await import('./sources/mifitness')
    if (!syncRegistry.has('mifitness')) {
      syncRegistry.register(new MiFitnessSource())
    }
  } catch (error) {
    console.warn('[SyncRegistry] 注册 MiFitnessSource 失败:', error instanceof Error ? error.message : String(error))
  }

  try {
    const { MiApiSource } = await import('./sources/miapi')
    if (!syncRegistry.has('miapi')) {
      syncRegistry.register(new MiApiSource())
    }
  } catch (error) {
    console.warn('[SyncRegistry] 注册 MiApiSource 失败:', error instanceof Error ? error.message : String(error))
  }
}

/**
 * 同步版本：用于非 webpack 环境（如 CLI）
 */
export function registerBuiltinSourcesSync(): void {
  if (_registered) return
  _registered = true

  try {
    const { MiFitnessSource } = require('./sources/mifitness')
    if (!syncRegistry.has('mifitness')) {
      syncRegistry.register(new MiFitnessSource())
    }
  } catch {
    // 忽略
  }

  try {
    const { MiApiSource } = require('./sources/miapi')
    if (!syncRegistry.has('miapi')) {
      syncRegistry.register(new MiApiSource())
    }
  } catch {
    // 忽略
  }
}
