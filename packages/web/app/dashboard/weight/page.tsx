'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactECharts from 'react-echarts-library'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import TimeRangeSelector from '@/app/components/TimeRangeSelector'
import Card from '@/app/components/Card'
import SourceBadge from '@/app/components/SourceBadge'
import Pagination from '@/app/components/Pagination'
import WeightCalendarHeatmap from '@/app/components/WeightCalendarHeatmap'
import WeightCalendarExplanation from '@/app/components/WeightCalendarExplanation'
import { useTimezone } from '@/app/components/TimezoneProvider'
import { useReadOnlyFetch } from '@/app/components/useReadOnlyFetch'
import { useReadOnly } from '@/app/components/ReadOnlyProvider'

interface TimeRange {
  last?: string
  start?: string
  end?: string
}

interface WeightRecord {
  id: string
  weight: number
  bodyFat?: number
  date: string
  extraData?: any
  sourceId?: string | null
}

interface StatsData {
  trend: Array<{ date: string; weight: number; bodyFat?: number }>
  avgWeight: number | null
  minWeight: number | null
  maxWeight: number | null
  change: number | null
}

export default function WeightPage() {
  const t = useTranslations('weight')
  const tc = useTranslations('common')
  const { formatDateTime, appendTimezoneOffset } = useTimezone()
  const readOnlyFetch = useReadOnlyFetch()
  const { isReadOnly } = useReadOnly()
  const [weights, setWeights] = useState<WeightRecord[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    weight: '',
    bodyFat: '',
    note: '',
    date: ''
  })
  const [timeRange, setTimeRange] = useState<TimeRange>({ last: '7d' })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [targetWeight, setTargetWeight] = useState<number | null>(null)

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

      const [weightsRes, statsRes, settingsRes] = await Promise.all([
        readOnlyFetch(`/api/v1/weights?${params}`),
        readOnlyFetch(`/api/v1/weights/stats?${statsParams}`),
        readOnlyFetch('/api/v1/settings')
      ])

      if (weightsRes.ok) {
        const weightsData = await weightsRes.json()
        setWeights(weightsData.weights || [])
        setTotal(weightsData.total || 0)
        setTotalPages(weightsData.totalPages || 1)
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        const tw = settingsData.settings?.['target-weight']
        setTargetWeight(tw ? parseFloat(tw) : null)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
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
    formDataToSend.append('weight', formData.weight)
    if (formData.bodyFat) formDataToSend.append('bodyFat', formData.bodyFat)
    if (formData.note) formDataToSend.append('note', formData.note)
    if (formData.date) {
      formDataToSend.append('date', appendTimezoneOffset(formData.date))
    }

    try {
      const res = await readOnlyFetch('/api/v1/weights', {
        method: 'POST',
        body: formDataToSend
      })

      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error || tc('errorSave'))
        return
      }

      setFormData({ weight: '', bodyFat: '', note: '', date: '' })
      setShowForm(false)
      fetchData()
    } catch (error) {
      console.error('Failed to add weight:', error)
      setSubmitError(tc('errorSave'))
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="animate-pulse bg-gray-200 rounded h-8 w-48"></div>
          <div className="animate-pulse bg-gray-200 rounded h-10 w-32"></div>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[0, 1, 2, 3].map(i => (
            <Card key={i} padding="sm">
              <div className="animate-pulse bg-gray-200 rounded h-4 w-24 mb-2"></div>
              <div className="animate-pulse bg-gray-200 rounded h-8 w-16"></div>
            </Card>
          ))}
        </div>
        <Card className="mb-6">
          <div className="animate-pulse bg-gray-200 rounded h-6 w-48 mb-4"></div>
          <div className="animate-pulse bg-gray-200 rounded h-64 w-full"></div>
        </Card>
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="animate-pulse bg-gray-200 rounded h-6 w-36"></div>
          </div>
          <ul className="divide-y divide-gray-200">
            {[0, 1, 2, 3, 4].map(i => (
              <li key={i} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="animate-pulse bg-gray-200 rounded h-5 w-20 mb-2"></div>
                    <div className="animate-pulse bg-gray-200 rounded h-4 w-28"></div>
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

  const chartData = stats?.trend?.map(item => ({
    date: item.date,
    [t('seriesWeight')]: item.weight,
    'Body Fat': item.bodyFat
  })) || []

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {!isReadOnly && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
          >
            {showForm ? tc('cancel') : t('addWeight')}
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
          <h2 className="text-lg font-medium mb-4">{t('logWeight')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('weight')}</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('bodyFat')}</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.bodyFat}
                  onChange={(e) => setFormData({ ...formData, bodyFat: e.target.value })}
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
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('note')}</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                rows={3}
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
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('average')}</div>
            <div className="text-2xl font-bold">{stats.avgWeight} kg</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('min')}</div>
            <div className="text-2xl font-bold">{stats.minWeight} kg</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('max')}</div>
            <div className="text-2xl font-bold">{stats.maxWeight} kg</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('change30d')}</div>
            <div className={`text-2xl font-bold ${(stats.change || 0) < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.change !== null ? `${stats.change > 0 ? '+' : ''}${stats.change} kg` : 'N/A'}
            </div>
          </Card>
        </div>
      )}

      <WeightCalendarHeatmap year={new Date().getFullYear()} targetWeight={targetWeight} />
      <WeightCalendarExplanation />

      {chartData.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-lg font-medium mb-4">{t('trendTitle')}</h2>
          <ReactECharts
            option={{
              tooltip: { trigger: 'axis', formatter: '{b}: {c} kg' },
              color: ['#34D399'],
              xAxis: { type: 'category', data: chartData.map(d => d.date) },
              yAxis: { type: 'value' },
              series: [{
                type: 'line',
                name: t('seriesWeight'),
                data: chartData.map(d => d[t('seriesWeight')])
              }]
            }}
            style={{ height: 256 }}
          />
        </Card>
      )}

      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">{t('recentEntries')}</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {weights.map((weight) => (
            <li key={weight.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer">
              <Link href={`/dashboard/weight/${weight.id}`} className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-medium text-gray-900">{weight.weight} kg</div>
                    <SourceBadge sourceId={weight.sourceId} />
                  </div>
                  <div className="text-sm text-gray-500">{formatDateTime(weight.date)}</div>
                </div>
                <div className="flex items-center gap-4">
                  {weight.bodyFat && (
                    <div className="text-sm text-gray-500">{t('bodyFat')}: {weight.bodyFat}%</div>
                  )}
                  <span className="text-gray-300">→</span>
                </div>
              </Link>
            </li>
          ))}
          {weights.length === 0 && (
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
