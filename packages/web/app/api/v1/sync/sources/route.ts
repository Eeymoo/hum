import { NextResponse } from 'next/server'
import { syncRegistry, registerBuiltinSources } from '@/lib/sync/registry'

/**
 * GET /api/v1/sync/sources
 * 获取所有已注册的同步数据源列表
 */
export async function GET() {
  await registerBuiltinSources()
  const sources = syncRegistry.getAll()

  return NextResponse.json({
    sources: sources.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      configSchema: s.configSchema,
    })),
  })
}
