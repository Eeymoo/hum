'use client'

import { useState, useEffect, useCallback } from 'react'
import { useReadOnlyFetch } from '@/app/components/useReadOnlyFetch'
import { useReadOnly } from '@/app/components/ReadOnlyProvider'
import ReactECharts from 'react-echarts-library'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import TimeRangeSelector from '@/app/components/TimeRangeSelector'
import Pagination from '@/app/components/Pagination'
import { useTimezone } from '@/app/components/TimezoneProvider'
import Card from '@/app/components/Card'

interface TimeRange {
  last?: string
  start?: string
  end?: string
}

interface ExerciseRecord {
  id: string
  type: string
  duration: number
  caloriesBurned?: number
  activities: Array<{ name: string }>
  feeling?: number
  date: string
  extraData?: any
}

interface StatsData {
  totalDuration: number
  totalCalories: number
  avgDuration: number | null
  avgCalories: number | null
  frequencyByType: Record<string, number>
  count: number
}

export default function ExercisePage() {
  const t = useTranslations('exercise')
  const tc = useTranslations('common')
  const { formatDateTime, appendTimezoneOffset } = useTimezone()
  const readOnlyFetch = useReadOnlyFetch()
  const { isReadOnly } = useReadOnly()
  const [exercises, setExercises] = useState<ExerciseRecord[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    type: 'running',
    duration: '',
    caloriesBurned: '',
    activities: '',
    feeling: '',
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

      const [exercisesRes, statsRes] = await Promise.all([
        readOnlyFetch(`/api/v1/exercises?${params}`),
        readOnlyFetch(`/api/v1/exercises/stats?${statsParams}`)
      ])

      if (exercisesRes.ok) {
        const data = await exercisesRes.json()
        setExercises(data.exercises || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch exercises:', error)
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
    formDataToSend.append('type', formData.type)
    formDataToSend.append('duration', formData.duration)
    if (formData.caloriesBurned) formDataToSend.append('caloriesBurned', formData.caloriesBurned)
    if (formData.activities) formDataToSend.append('activities', formData.activities)
    if (formData.feeling) formDataToSend.append('feeling', formData.feeling)
    if (formData.date) {
      formDataToSend.append('date', appendTimezoneOffset(formData.date))
    }

    try {
      const res = await readOnlyFetch('/api/v1/exercises', {
        method: 'POST',
        body: formDataToSend
      })

      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error || tc('errorSave'))
        return
      }

      setFormData({ type: 'running', duration: '', caloriesBurned: '', activities: '', feeling: '', date: '' })
      setShowForm(false)
      fetchData()
    } catch (error) {
      console.error('Failed to add exercise:', error)
      setSubmitError(tc('errorSave'))
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="animate-pulse bg-gray-200 rounded h-8 w-52"></div>
          <div className="animate-pulse bg-gray-200 rounded h-10 w-36"></div>
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
            <div className="animate-pulse bg-gray-200 rounded h-6 w-40"></div>
          </div>
          <ul className="divide-y divide-gray-200">
            {[0, 1, 2, 3, 4].map(i => (
              <li key={i} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="animate-pulse bg-gray-200 rounded h-8 w-8 mr-3"></div>
                    <div>
                      <div className="animate-pulse bg-gray-200 rounded h-5 w-24 mb-2"></div>
                      <div className="animate-pulse bg-gray-200 rounded h-4 w-16"></div>
                    </div>
                  </div>
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-20"></div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  const chartData = stats?.frequencyByType
    ? Object.entries(stats.frequencyByType).map(([type, count]) => ({
        type: t(type),
        sessions: count
      }))
    : []

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {!isReadOnly && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
          >
            {showForm ? tc('cancel') : t('logExercise')}
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
          <h2 className="text-lg font-medium mb-4">{t('newExercise')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('type')} *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="running">{t('running')}</option>
                  <option value="strength">{t('strength')}</option>
                  <option value="cycling">{t('cycling')}</option>
                  <option value="swimming">{t('swimming')}</option>
                  <option value="other">{t('other')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('duration')} *</label>
                <input
                  type="number"
                  required
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('caloriesBurned')}</label>
                <input
                  type="number"
                  value={formData.caloriesBurned}
                  onChange={(e) => setFormData({ ...formData, caloriesBurned: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('feeling')}</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.feeling}
                  onChange={(e) => setFormData({ ...formData, feeling: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('activities')}</label>
              <input
                type="text"
                placeholder={t('activitiesPlaceholder')}
                value={formData.activities}
                onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
              />
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
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('totalSessions')}</div>
            <div className="text-2xl font-bold">{stats.count}</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('totalDuration')}</div>
            <div className="text-2xl font-bold">{stats.totalDuration} {t('min')}</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('totalCalories')}</div>
            <div className="text-2xl font-bold">{stats.totalCalories} {t('kcal')}</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('avgDuration')}</div>
            <div className="text-2xl font-bold">{stats.avgDuration?.toFixed(1) || '0'} {t('min')}</div>
          </Card>
        </div>
      )}

      {chartData.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-lg font-medium mb-4">{t('frequencyTitle')}</h2>
          <ReactECharts
            option={{
              tooltip: { trigger: 'axis', formatter: `{b}: {c} ${t('sessions')}` },
              color: ['#34D399'],
              xAxis: { type: 'category', data: chartData.map(d => d.type) },
              yAxis: { type: 'value' },
              series: [{
                type: 'bar',
                data: chartData.map(d => d.sessions)
              }]
            }}
            style={{ height: 256 }}
          />
        </Card>
      )}

      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">{t('recentExercises')}</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {exercises.map((exercise) => (
            <li key={exercise.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer">
              <Link href={`/dashboard/exercise/${exercise.id}`} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div>
                    <div className="text-lg font-medium text-gray-900 capitalize">{t(exercise.type)}</div>
                    <div className="text-sm text-gray-500">{exercise.duration} {t('min')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {exercise.caloriesBurned && (
                      <div className="text-sm text-gray-500">{exercise.caloriesBurned} {t('kcal')}</div>
                    )}
                    <div className="text-xs text-gray-400">{formatDateTime(exercise.date)}</div>
                  </div>
                  <span className="text-gray-300">→</span>
                </div>
              </Link>
            </li>
          ))}
          {exercises.length === 0 && (
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
