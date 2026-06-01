'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import TimeRangeSelector from '@/app/components/TimeRangeSelector'
import { useTimezone } from '@/app/components/TimezoneProvider'
import { useReadOnlyFetch } from '@/app/components/useReadOnlyFetch'
import Card from '@/app/components/Card'
import Pagination from '@/app/components/Pagination'

interface TimeRange {
  last?: string
  start?: string
  end?: string
}

interface TimelineItem {
  type: 'weight' | 'exercise' | 'diet' | 'sleep' | 'record'
  id: string
  date: string
  data: any
}

export default function TimelinePage() {
  const t = useTranslations('timeline')
  const tc = useTranslations('common')
  const { formatDateTime } = useTimezone()
  const readOnlyFetch = useReadOnlyFetch()
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>({ last: '7d' })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [allItems, setAllItems] = useState<TimelineItem[]>([])

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const params = new URLSearchParams()
      params.set('limit', '1000') // Fetch all and paginate client-side
      if (timeRange.last) params.set('last', timeRange.last)
      if (timeRange.start) params.set('start', timeRange.start)
      if (timeRange.end) params.set('end', timeRange.end)

      const res = await readOnlyFetch(`/api/v1/timeline?${params}`)
      if (res.ok) {
        const data = await res.json()
        const fetched = data.items || []
        setAllItems(fetched)
        setTotal(fetched.length)
        setItems(fetched.slice(0, limit))
      }
    } catch (error) {
      console.error('Failed to fetch timeline:', error)
      setError(tc('errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [timeRange, limit, tc])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const start = (page - 1) * limit
    setItems(allItems.slice(start, start + limit))
  }, [page, limit, allItems])

  function handleTimeRangeChange(range: TimeRange) {
    setTimeRange(range)
    setPage(1)
  }

  const totalPages = Math.ceil(total / limit) || 1

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse bg-gray-200 rounded h-8 w-28 mb-6"></div>
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="animate-pulse bg-gray-200 rounded h-6 w-32"></div>
          </div>
          <ul className="divide-y divide-gray-200">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <li key={i} className="px-6 py-4">
                <div className="flex items-start">
                  <div className="animate-pulse bg-gray-200 rounded h-8 w-8 mr-3 mt-0.5"></div>
                  <div className="flex-1">
                    <div className="animate-pulse bg-gray-200 rounded h-4 w-20 mb-2"></div>
                    <div className="animate-pulse bg-gray-200 rounded h-4 w-3/4 mb-2"></div>
                    <div className="animate-pulse bg-gray-200 rounded h-3 w-28"></div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  const detailPaths: Record<string, string> = {
    weight: '/dashboard/weight',
    exercise: '/dashboard/exercise',
    diet: '/dashboard/diet',
    sleep: '/dashboard/sleep',
    record: '/dashboard/records'
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('title')}</h1>

      <div className="mb-6">
        <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => { setError(null); fetchData() }} className="text-sm underline">{tc('retry')}</button>
        </div>
      )}

      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">{t('allActivity')}</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`} className="px-6 py-4 hover:bg-gray-50 cursor-pointer">
              <Link href={`${detailPaths[item.type]}/${item.id}`} className="flex items-start">
                <div className="flex-1">
                  <div className="text-sm text-gray-500 capitalize mb-1">{t(item.type)}</div>
                  <div className="text-sm text-gray-900">
                    {item.type === 'weight' && `${item.data.weight} kg`}
                    {item.type === 'exercise' && `${item.data.duration} min ${item.data.type}`}
                    {item.type === 'diet' && `${item.data.calories || 0} kcal (${item.data.mealType})`}
                    {item.type === 'sleep' && `${item.data.duration}h, ${t('qualityLabel') || 'Quality'}: ${item.data.quality}/10`}
                    {item.type === 'record' && item.data.type}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formatDateTime(item.date)}
                  </div>
                </div>
                <span className="text-gray-300 mt-2">→</span>
              </Link>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-6 py-4 text-center text-gray-500">{t('noRecords')}</li>
          )}
        </ul>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1) }}
        />
      </Card>
    </div>
  )
}
