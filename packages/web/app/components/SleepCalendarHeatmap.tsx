'use client'

import { useState, useEffect } from 'react'
import ReactECharts from 'react-echarts-library'
import { useTranslations } from 'next-intl'
import Card from '@/app/components/Card'
import { useReadOnlyFetch } from '@/app/components/useReadOnlyFetch'

interface Props {
  year: number
}

interface CalendarCell {
  date: string
  bed: string
  wake: string
  devMinutes: number | null
  score: number | null
  color: string
}

interface CalendarData {
  data: CalendarCell[]
  summary: {
    totalRecords: number
    avgScore: number | null
  }
  year: number
}

const LEGEND_ITEMS = [
  { key: 'sleepLegendDeepGreen', color: '#16a34a' },
  { key: 'sleepLegendLightGreen', color: '#4ade80' },
  { key: 'sleepLegendYellow', color: '#facc15' },
  { key: 'sleepLegendOrange', color: '#fb923c' },
  { key: 'sleepLegendRed', color: '#ef4444' },
  { key: 'sleepLegendNoScore', color: '#e5e7eb' },
]

export default function SleepCalendarHeatmap({ year }: Props) {
  const t = useTranslations('sleep')
  const readOnlyFetch = useReadOnlyFetch()
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(year)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    async function fetchCalendar() {
      setLoading(true)
      try {
        const res = await readOnlyFetch(`/api/v1/sleeps/calendar?year=${currentYear}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (error) {
        console.error('Failed to fetch sleep calendar data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCalendar()
  }, [currentYear])

  function handlePrevYear() {
    setCurrentYear(y => y - 1)
  }

  function handleNextYear() {
    setCurrentYear(y => y + 1)
  }

  if (loading) {
    return (
      <Card className="mb-6">
        <div className="animate-pulse bg-gray-200 rounded h-6 w-48 mb-4"></div>
        <div className="animate-pulse bg-gray-200 rounded h-64 w-full"></div>
      </Card>
    )
  }

  if (!data || data.data.length === 0) {
    return (
      <Card className="mb-6">
        <h2 className="text-lg font-medium mb-4">{t('consistencyTitle')}</h2>
        <div className="text-center text-gray-400 py-12">{t('noRecords')}</div>
      </Card>
    )
  }

  // Use devMinutes for heatmap coloring; null → -1 (gray)
  const heatmapData = data.data.map(cell => {
    const value = cell.devMinutes !== null ? cell.devMinutes : -1
    return [cell.date, value]
  })

  const option = {
    tooltip: {
      formatter: (params: any) => {
        if (!params.data) return ''
        const [date, devVal] = params.data
        const cell = data.data.find((c) => c.date === date)
        if (!cell) return `${date}`

        let lines = `${date}`
        lines += `<br/>${t('sleepBed')}: ${cell.bed}`
        lines += `<br/>${t('sleepWake')}: ${cell.wake}`

        if (cell.devMinutes !== null) {
          lines += `<br/>${t('difference')}: ${cell.devMinutes}min`
          lines += `<br/>${t('consistencyScore')}: ${cell.score}`
        } else {
          lines += `<br/>${t('consistencyScore')}: -`
        }
        return lines
      }
    },
    visualMap: {
      seriesIndex: 0,
      type: 'piecewise' as const,
      pieces: [
        { value: -1, color: '#e5e7eb' },
        { min: 0, max: 10, color: '#16a34a' },
        { min: 11, max: 25, color: '#4ade80' },
        { min: 26, max: 45, color: '#facc15' },
        { min: 46, max: 70, color: '#fb923c' },
        { min: 71, color: '#ef4444' },
      ],
      orient: 'horizontal' as const,
      left: 'center',
      bottom: 0,
      show: false
    },
    calendar: {
      top: 20,
      left: 60,
      right: 20,
      bottom: 30,
      range: currentYear,
      cellSize: 15,
      splitLine: { show: false },
      itemStyle: {
        borderWidth: 1,
        borderColor: '#fff',
        color: '#D1D5DB'
      },
      yearLabel: { show: false },
      dayLabel: {
        firstDay: 1,
        color: '#9CA3AF',
        fontSize: 10
      },
      monthLabel: {
        color: '#9CA3AF',
        fontSize: 11
      }
    },
    series: [
      {
        type: 'heatmap' as const,
        coordinateSystem: 'calendar' as const,
        data: heatmapData
      }
    ]
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium text-gray-900">
          {t('consistencyTitle')}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={handlePrevYear} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">◀</button>
          <span className="text-sm font-medium">{currentYear}</span>
          <button onClick={handleNextYear} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">▶</button>
        </div>
      </div>

      <ReactECharts
        option={option}
        style={{ height: 180 }}
      />

      <div className="flex gap-4 text-xs text-gray-400">
        <span>{data.summary.totalRecords} {t('days')}</span>
        {data.summary.avgScore !== null && (
          <span className="text-emerald-600">
            {t('consistencyScore')}: {data.summary.avgScore}
          </span>
        )}
      </div>

      <button
        onClick={() => setExpanded(v => !v)}
        className="mt-2 text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
      >
        <span>{expanded ? '▲' : '▼'}</span>
        {t('consistencyExplanationToggle')}
      </button>

      {expanded && (
        <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded p-4 space-y-2">
          <div className="font-medium mb-2">{t('consistencyExplanationTitle')}</div>
          <div>1. {t('sleepCalendarRule1')}</div>
          <div>2. {t('sleepCalendarRule2')}</div>
          <div>3. {t('sleepCalendarRule3')}</div>
          <div>4. {t('sleepCalendarRule4')}</div>

          <div className="mt-3">
            <div className="font-medium mb-2">{t('legend')}</div>
            <div className="flex flex-wrap gap-4">
              {LEGEND_ITEMS.map(item => (
                <div key={item.key} className="flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-sm border border-gray-200"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-gray-600">{t(item.key)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
