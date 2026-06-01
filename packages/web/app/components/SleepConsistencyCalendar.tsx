'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Card from '@/app/components/Card'
import { useReadOnlyFetch } from '@/app/components/useReadOnlyFetch'
import SleepCalendarHeatmap from './SleepCalendarHeatmap'

interface DailyScore {
  date: string
  wakeTime: string
  wakeHours: number
}

interface ConsistencyData {
  year: number
  month: number
  weekdayAvg: string | null
  weekendAvg: string | null
  weekdayCount: number
  weekendCount: number
  consistencyScore: number | null
  dailyScores: DailyScore[]
}

export default function SleepConsistencyCalendar() {
  const t = useTranslations('sleep')
  const readOnlyFetch = useReadOnlyFetch()
  const [data, setData] = useState<ConsistencyData | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    readOnlyFetch(`/api/v1/sleeps/consistency?year=${year}&month=${month}`)
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [year, month])

  if (loading) {
    return (
      <Card className="mb-6">
        <div className="animate-pulse bg-gray-200 rounded h-6 w-48 mb-4"></div>
        <div className="animate-pulse bg-gray-200 rounded h-64 w-full"></div>
      </Card>
    )
  }

  if (!data || data.dailyScores.length === 0) {
    return (
      <Card className="mb-6">
        <h2 className="text-lg font-medium mb-4">{t('consistencyTitle')}</h2>
        <div className="text-center text-gray-400 py-12">{t('noRecords')}</div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 一致性评分卡片 */}
      {data.consistencyScore !== null && (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{t('consistencyScore')}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('consistencyFormula')}: 7 - |{t('weekdayAvg')} - {t('weekendAvg')}|
              </p>
            </div>
            <div className="text-right">
              <span className={`text-4xl font-bold ${getScoreColorClass(data.consistencyScore)}`}>
                {data.consistencyScore}
              </span>
              <span className="text-gray-400">/7</span>
              <p className="text-sm mt-1">{getScoreLabel(data.consistencyScore)}</p>
            </div>
          </div>

          {/* 分解信息 */}
          <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <span className="text-sm text-gray-500">{t('weekdayAvg')}</span>
              <p className="font-semibold">{data.weekdayAvg}
                <span className="text-xs text-gray-400 ml-1">
                  ({data.weekdayCount} {t('days')})
                </span>
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">{t('weekendAvg')}</span>
              <p className="font-semibold">{data.weekendAvg}
                <span className="text-xs text-gray-400 ml-1">
                  ({data.weekendCount} {t('days')})
                </span>
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-sm text-gray-500">{t('difference')}</span>
              <p className="font-semibold">
                {data.weekdayAvg && data.weekendAvg
                  ? calcDiff(data.weekdayAvg, data.weekendAvg)
                  : '—'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 日历热力图 */}
      <SleepCalendarHeatmap
        data={data}
        year={year}
        month={month}
        onMonthChange={(y, m) => { setYear(y); setMonth(m) }}
      />
    </div>
  )
}

function getScoreColorClass(score: number): string {
  if (score >= 6.5) return 'text-green-600'
  if (score >= 5.0) return 'text-green-400'
  if (score >= 3.0) return 'text-yellow-500'
  return 'text-red-500'
}

function getScoreLabel(score: number): string {
  if (score >= 6.5) return '⭐ 优秀'
  if (score >= 5.0) return '✅ 良好'
  if (score >= 3.0) return '⚠️ 一般'
  return '❌ 需改善'
}

function calcDiff(time1: string, time2: string): string {
  const [h1, m1] = time1.split(':').map(Number)
  const [h2, m2] = time2.split(':').map(Number)
  const diff = Math.abs((h1 + m1 / 60) - (h2 + m2 / 60))
  const hours = Math.floor(diff)
  const minutes = Math.round((diff - hours) * 60)
  return `${hours}小时${minutes}分钟`
}
