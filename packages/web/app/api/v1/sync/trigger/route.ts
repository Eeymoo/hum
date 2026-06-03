import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { syncEngine } from '@/lib/sync/engine'

/**
 * POST /api/v1/sync/trigger
 * 手动触发同步
 *
 * Body: { sourceId: string, startDate?: string, endDate?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { sourceId, startDate, endDate } = body

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
  }

  try {
    const { jobId, result } = await syncEngine.createAndRunJob(
      session.user.id,
      sourceId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    )

    return NextResponse.json({
      jobId,
      success: result.success,
      syncedRecords: result.syncedRecords,
      errors: result.errors,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    )
  }
}
