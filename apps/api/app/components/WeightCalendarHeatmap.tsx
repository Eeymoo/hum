'use client'

import { useState, useEffect } from 'react'
import ReactECharts from 'react-echarts-library'
import { useTranslations } from 'next-intl'
import Card from '@/app/components/Card'
import { useReadOnlyFetch } from '@/app/components/useReadOnlyFetch'

interface Props {
  year: number
  targetWeight: number | null
}

interface CalendarData {
  data: Array<[string, number | null, number | null]>
  summary: {
    totalRecords: number
    netChange: number | null
  }
  year: number
}

export default function WeightCalendarHeatmap({ year, targetWeight }: Props) {
  const t = useTranslations('weight')
  const readOnlyFetch = useReadOnlyFetch()
  const [data, setData] = useState<CalendarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(year)

  useEffect(() => {
    async function fetchCalendar() {
      setLoading(true)
      try {
        const res = await readOnlyFetch(`/api/v1/weights/calendar?year=${currentYear}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (error) {
        console.error('Failed to fetch calendar data:', error)
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
        <h2 className="text-lg font-medium mb-4">{t('calendarTitle')}</h2>
        <div className="text-center text-gray-400 py-12">{t('noRecords')}</div>
      </Card>
    )
  }

  const heatmapData = data.data
    .filter(([, change]) => change !== null)
    .map(([date, change]) => [date, change])

  const option = {
    tooltip: {
      formatter: (params: any) => {
        if (!params.data) return ''
        const [date, value] = params.data
        const dateStr = date as string
        const change = value as number
        const sign = change > 0 ? '+' : ''
        return `${dateStr}<br/>${sign}${change} kg`
      }
    },
    visualMap: {
      seriesIndex: 0,
      type: 'continuous',
      min: -1.2,
      max: 1.2,
      inRange: {
        color: ['#16A34A', '#4ADE80', '#86EFAC', '#D1FAE5', '#F3F4F6', '#FEE2E2', '#FCA5A5', '#F87171', '#DC2626']
      },
      orient: 'horizontal',
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
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: heatmapData
      }
    ]
  }

  return (
    <Card className="mb-6">
      <h2 className="text-lg font-medium text-gray-900">
        {t('calendarTitle')}
      </h2>

      {targetWeight && (
        <div className="text-xs text-gray-400 mb-1">
          {t('targetWeight')} {targetWeight} kg
        </div>
      )}

      <ReactECharts
        option={option}
        style={{ height: 180 }}
      />

      <div className="flex gap-4 text-xs text-gray-400">
        <span>{data.summary.totalRecords}</span>
        {data.summary.netChange !== null && (
          <span className={data.summary.netChange < 0 ? 'text-green-500' : 'text-red-500'}>
            {data.summary.netChange > 0 ? '+' : ''}{data.summary.netChange} kg
          </span>
        )}
      </div>
    </Card>
  )
}
