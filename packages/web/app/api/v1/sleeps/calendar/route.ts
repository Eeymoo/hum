import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

// Parse time string (HH:mm or ISO 8601) to minutes since midnight (0~1439)
function toMin(time: string): number | null {
  const hmMatch = time.match(/^(\d{1,2}):(\d{2})$/)
  if (hmMatch) return parseInt(hmMatch[1]) * 60 + parseInt(hmMatch[2])
  const isoMatch = time.match(/T(\d{1,2}):(\d{2})/)
  if (isoMatch) return parseInt(isoMatch[1]) * 60 + parseInt(isoMatch[2])
  return null
}

// Format minutes to HH:mm
function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = Math.round(minutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Circular difference: shortest distance between two time-of-day moments (0~720 min)
function circularDiff(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.min(diff, 1440 - diff)
}

// Determine the base sleep segment for a day
function getBaseSleep(segments: Array<{ bed: string; wake: string; duration: number }>) {
  const valid = segments.filter(s => toMin(s.bed) !== null && toMin(s.wake) !== null)
  if (valid.length === 0) return null

  const longSegments = valid.filter(s => s.duration > 4)
  const candidates = longSegments.length > 0 ? longSegments : valid
  return candidates.reduce((best, cur) => (cur.duration > best.duration ? cur : best))
}

// Determine color based on total deviation (minutes)
function devToColor(devMinutes: number): string {
  if (devMinutes <= 10) return '#16a34a'
  if (devMinutes <= 25) return '#4ade80'
  if (devMinutes <= 45) return '#facc15'
  if (devMinutes <= 70) return '#fb923c'
  return '#ef4444'
}

export async function GET(request: NextRequest) {
  const authResult = await getAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

    if (isNaN(year)) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
    }

    const startDate = new Date(year - 1, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999)

    const allSleeps = await prisma.sleep.findMany({
      where: {
        userId: authResult.userId,
        date: { gte: startDate, lte: endDate },
        deleteAt: 0
      },
      orderBy: { date: 'asc' },
      select: { date: true, duration: true, wakeTime: true, bedTime: true }
    })

    // Group by date, keeping all segments
    const dailySegments = new Map<string, Array<{ bed: string; wake: string; duration: number }>>()
    for (const s of allSleeps) {
      const dateKey = s.date.toISOString().slice(0, 10)
      if (!dailySegments.has(dateKey)) {
        dailySegments.set(dateKey, [])
      }
      dailySegments.get(dateKey)!.push({
        bed: s.bedTime,
        wake: s.wakeTime,
        duration: s.duration
      })
    }

    const sortedDates = Array.from(dailySegments.keys())
    const yearStart = `${year}-01-01`

    // Compute base sleep for each day
    const baseSleepMap = new Map<string, { bed: string; wake: string; duration: number } | null>()
    for (const [dateStr, segments] of dailySegments) {
      baseSleepMap.set(dateStr, getBaseSleep(segments))
    }

    // Calculate scores for each day in target year
    const data: Array<{
      date: string
      bed: string
      wake: string
      devMinutes: number | null
      score: number | null
      color: string
    }> = []

    for (let i = 0; i < sortedDates.length; i++) {
      const dateStr = sortedDates[i]
      if (dateStr < yearStart) continue

      const current = baseSleepMap.get(dateStr)
      const currentBedMin = current ? toMin(current.bed) : null
      const currentWakeMin = current ? toMin(current.wake) : null

      // Build historical window: up to 7 days with valid base sleep
      const historyDays: Array<{ bedMin: number; wakeMin: number }> = []
      for (let j = i - 1; j >= 0 && historyDays.length < 7; j--) {
        const histBase = baseSleepMap.get(sortedDates[j])
        if (!histBase) continue
        const bedMin = toMin(histBase.bed)
        const wakeMin = toMin(histBase.wake)
        if (bedMin !== null && wakeMin !== null) {
          historyDays.push({ bedMin, wakeMin })
        }
      }

      if (historyDays.length < 2 || currentBedMin === null || currentWakeMin === null) {
        data.push({
          date: dateStr,
          bed: currentBedMin !== null ? toHHMM(currentBedMin) : '--:--',
          wake: currentWakeMin !== null ? toHHMM(currentWakeMin) : '--:--',
          devMinutes: null,
          score: null,
          color: '#e5e7eb'
        })
        continue
      }

      // Arithmetic average of historical bed and wake times
      const avgBed = historyDays.reduce((sum, d) => sum + d.bedMin, 0) / historyDays.length
      const avgWake = historyDays.reduce((sum, d) => sum + d.wakeMin, 0) / historyDays.length

      // Compute deviations
      const devBed = circularDiff(currentBedMin, avgBed)
      const devWake = circularDiff(currentWakeMin, avgWake)
      const totalDev = (devBed + devWake) / 2

      const score = Math.max(0, Math.round((100 - totalDev * 1.67) * 10) / 10)

      data.push({
        date: dateStr,
        bed: toHHMM(currentBedMin),
        wake: toHHMM(currentWakeMin),
        devMinutes: Math.round(totalDev * 10) / 10,
        score,
        color: devToColor(totalDev)
      })
    }

    // Summary
    const validScores = data.filter(d => d.score !== null).map(d => d.score as number)
    const avgScore = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length * 10) / 10
      : null

    return NextResponse.json({
      data,
      summary: { totalRecords: data.length, avgScore },
      year
    })
  } catch (error) {
    console.error('Sleep calendar GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
