'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactECharts from 'react-echarts-library'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import TimeRangeSelector from '@/app/components/TimeRangeSelector'
import Pagination from '@/app/components/Pagination'
import Card from '@/app/components/Card'
import { useTimezone } from '@/app/components/TimezoneProvider'
import { useReadOnlyFetch } from '@/app/components/useReadOnlyFetch'
import { useReadOnly } from '@/app/components/ReadOnlyProvider'

interface TimeRange {
  last?: string
  start?: string
  end?: string
}

interface SleepRecord {
  id: string
  duration: number
  bedTime: string
  wakeTime: string
  quality: number
  deepSleep?: number
  remSleep?: number
  date: string
  extraData?: any
}

interface StatsData {
  avgDuration: number | null
  avgQuality: number | null
  avgDeepSleep: number | null
  count: number
}

export default function SleepPage() {
  const t = useTranslations('sleep')
  const tc = useTranslations('common')
  const { formatDateTime, formatDate, appendTimezoneOffset } = useTimezone()
  const readOnlyFetch = useReadOnlyFetch()
  const { isReadOnly } = useReadOnly()
  const [sleeps, setSleeps] = useState<SleepRecord[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    duration: '',
    bedTime: '22:00',
    wakeTime: '06:00',
    quality: '7',
    deepSleep: '',
    remSleep: '',
    date: ''
  })
  const [timeRange, setTimeRange] = useState<TimeRange>({ last: '7d' })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (timeRange.last) params.set('last', timeRange.last)
      if (timeRange.start) params.set('start', timeRange.start)
      if (timeRange.end) params.set('end', timeRange.end)

      const statsParams = new URLSearchParams()
      if (timeRange.last) statsParams.set('last', timeRange.last)
      if (timeRange.start) statsParams.set('start', timeRange.start)
      if (timeRange.end) statsParams.set('end', timeRange.end)

      const [sleepsRes, statsRes] = await Promise.all([
        readOnlyFetch(`/api/v1/sleeps?${params}`),
        readOnlyFetch(`/api/v1/sleeps/stats?${statsParams}`)
      ])

      if (sleepsRes.ok) {
        const data = await sleepsRes.json()
        setSleeps(data.sleeps || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch sleeps:', error)
      setError(tc('errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [page, limit, timeRange, tc])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleTimeRangeChange(range: TimeRange) {
    setTimeRange(range)
    setPage(1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const formDataToSend = new FormData()
    formDataToSend.append('duration', formData.duration)
    formDataToSend.append('bedTime', formData.bedTime)
    formDataToSend.append('wakeTime', formData.wakeTime)
    formDataToSend.append('quality', formData.quality)
    if (formData.deepSleep) formDataToSend.append('deepSleep', formData.deepSleep)
    if (formData.remSleep) formDataToSend.append('remSleep', formData.remSleep)
    if (formData.date) {
      formDataToSend.append('date', appendTimezoneOffset(formData.date))
    }

    try {
      const res = await readOnlyFetch('/api/v1/sleeps', {
        method: 'POST',
        body: formDataToSend
      })

      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error || tc('errorSave'))
        return
      }

      setFormData({ duration: '', bedTime: '22:00', wakeTime: '06:00', quality: '7', deepSleep: '', remSleep: '', date: '' })
      setShowForm(false)
      fetchData()
    } catch (error) {
      console.error('Failed to add sleep:', error)
      setSubmitError(tc('errorSave'))
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="animate-pulse bg-gray-200 rounded h-8 w-44"></div>
          <div className="animate-pulse bg-gray-200 rounded h-10 w-32"></div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[0, 1, 2].map(i => (
            <Card key={i} padding="sm">
              <div className="animate-pulse bg-gray-200 rounded h-4 w-24 mb-2"></div>
              <div className="animate-pulse bg-gray-200 rounded h-8 w-16"></div>
            </Card>
          ))}
        </div>
        <Card className="mb-6">
          <div className="animate-pulse bg-gray-200 rounded h-6 w-64 mb-4"></div>
          <div className="animate-pulse bg-gray-200 rounded h-64 w-full"></div>
        </Card>
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="animate-pulse bg-gray-200 rounded h-6 w-44"></div>
          </div>
          <ul className="divide-y divide-gray-200">
            {[0, 1, 2, 3, 4].map(i => (
              <li key={i} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="animate-pulse bg-gray-200 rounded h-8 w-8 mr-3"></div>
                    <div>
                      <div className="animate-pulse bg-gray-200 rounded h-5 w-16 mb-2"></div>
                      <div className="animate-pulse bg-gray-200 rounded h-4 w-28"></div>
                    </div>
                  </div>
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-24"></div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  const chartData = sleeps.slice(0, 7).reverse().map(s => ({
    date: formatDate(s.date),
    [t('duration')]: s.duration,
    [t('quality')]: s.quality
  }))

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {!isReadOnly && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
          >
            {showForm ? tc('cancel') : t('logSleep')}
          </button>
        )}
      </div>

      <div className="mb-6">
        <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => { setError(null); fetchData() }} className="text-sm underline">{tc('retry')}</button>
        </div>
      )}

      {showForm && (
        <Card className="mb-6">
          <h2 className="text-lg font-medium mb-4">{t('newSleep')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('duration')} *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('bedTime')} *</label>
                <input
                  type="time"
                  required
                  value={formData.bedTime}
                  onChange={(e) => setFormData({ ...formData, bedTime: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('wakeTime')} *</label>
                <input
                  type="time"
                  required
                  value={formData.wakeTime}
                  onChange={(e) => setFormData({ ...formData, wakeTime: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('quality')} *</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={formData.quality}
                  onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('deepSleep')}</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.deepSleep}
                  onChange={(e) => setFormData({ ...formData, deepSleep: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('remSleep')}</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.remSleep}
                  onChange={(e) => setFormData({ ...formData, remSleep: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('date')}</label>
              <input
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            {submitError && (
              <div className="text-red-600 text-sm">{submitError}</div>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              {tc('save')}
            </button>
          </form>
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('avgDuration')}</div>
            <div className="text-2xl font-bold">{stats.avgDuration?.toFixed(1) || '0'}h</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('avgQuality')}</div>
            <div className="text-2xl font-bold">{stats.avgQuality?.toFixed(1) || '0'}/10</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('avgDeepSleep')}</div>
            <div className="text-2xl font-bold">{stats.avgDeepSleep?.toFixed(1) || '0'}h</div>
          </Card>
        </div>
      )}

      {chartData.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-lg font-medium mb-4">{t('chartTitle')}</h2>
          <ReactECharts
            option={{
              tooltip: { trigger: 'axis' },
              color: ['#34D399', '#f43f5e'],
              legend: { data: [t('duration'), t('quality')] },
              xAxis: { type: 'category', data: chartData.map(d => d.date) },
              yAxis: { type: 'value' },
              series: [
                { type: 'bar', name: t('duration'), data: chartData.map(d => d[t('duration')]) },
                { type: 'bar', name: t('quality'), data: chartData.map(d => d[t('quality')]) }
              ]
            }}
            style={{ height: 256 }}
          />
        </Card>
      )}

      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">{t('recentRecords')}</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {sleeps.map((sleep) => (
            <li key={sleep.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer">
              <Link href={`/dashboard/sleep/${sleep.id}`} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div>
                    <div className="text-lg font-medium text-gray-900">{sleep.duration}h</div>
                    <div className="text-sm text-gray-500">{sleep.bedTime} - {sleep.wakeTime}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">{t('qualityLabel')}: {sleep.quality}/10</div>
                    <div className="text-xs text-gray-400">{formatDateTime(sleep.date)}</div>
                  </div>
                  <span className="text-gray-300">→</span>
                </div>
              </Link>
            </li>
          ))}
          {sleeps.length === 0 && (
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
