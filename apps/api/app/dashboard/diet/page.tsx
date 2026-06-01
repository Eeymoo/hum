'use client'

import { useState, useEffect, useCallback } from 'react'
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

interface DietRecord {
  id: string
  mealType: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  foods: Array<{ name: string }>
  date: string
  extraData?: any
}

interface StatsData {
  avgCalories: number | null
  avgProtein: number | null
  avgCarbs: number | null
  avgFat: number | null
  totalWater: number | null
  count: number
}

export default function DietPage() {
  const t = useTranslations('diet')
  const tc = useTranslations('common')
  const { formatDateTime, appendTimezoneOffset } = useTimezone()
  const [diets, setDiets] = useState<DietRecord[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    mealType: 'breakfast',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    foods: '',
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

      const [dietsRes, statsRes] = await Promise.all([
        fetch(`/api/v1/diets?${params}`),
        fetch(`/api/v1/diets/stats?${statsParams}`)
      ])

      if (dietsRes.ok) {
        const data = await dietsRes.json()
        setDiets(data.diets || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch diets:', error)
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
    formDataToSend.append('mealType', formData.mealType)
    if (formData.calories) formDataToSend.append('calories', formData.calories)
    if (formData.protein) formDataToSend.append('protein', formData.protein)
    if (formData.carbs) formDataToSend.append('carbs', formData.carbs)
    if (formData.fat) formDataToSend.append('fat', formData.fat)
    if (formData.foods) formDataToSend.append('foods', formData.foods)
    if (formData.date) {
      formDataToSend.append('date', appendTimezoneOffset(formData.date))
    }

    try {
      const res = await fetch('/api/v1/diets', {
        method: 'POST',
        body: formDataToSend
      })

      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error || tc('errorSave'))
        return
      }

      setFormData({ mealType: 'breakfast', calories: '', protein: '', carbs: '', fat: '', foods: '', date: '' })
      setShowForm(false)
      fetchData()
    } catch (error) {
      console.error('Failed to add diet:', error)
      setSubmitError(tc('errorSave'))
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="animate-pulse bg-gray-200 rounded h-8 w-40"></div>
          <div className="animate-pulse bg-gray-200 rounded h-10 w-28"></div>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[0, 1, 2, 3].map(i => (
            <Card key={i} padding="sm">
              <div className="animate-pulse bg-gray-200 rounded h-4 w-28 mb-2"></div>
              <div className="animate-pulse bg-gray-200 rounded h-8 w-20"></div>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <Card>
            <div className="animate-pulse bg-gray-200 rounded h-6 w-56 mb-4"></div>
            <div className="animate-pulse bg-gray-200 rounded h-64 w-full"></div>
          </Card>
          <Card>
            <div className="animate-pulse bg-gray-200 rounded h-6 w-36 mb-4"></div>
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="animate-pulse bg-gray-200 rounded h-5 w-3/4"></div>
              ))}
            </div>
          </Card>
        </div>
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="animate-pulse bg-gray-200 rounded h-6 w-32"></div>
          </div>
          <ul className="divide-y divide-gray-200">
            {[0, 1, 2, 3, 4].map(i => (
              <li key={i} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="animate-pulse bg-gray-200 rounded h-8 w-8 mr-3"></div>
                    <div>
                      <div className="animate-pulse bg-gray-200 rounded h-5 w-24 mb-2"></div>
                      <div className="animate-pulse bg-gray-200 rounded h-4 w-40"></div>
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

  const macroChartData = stats?.avgProtein !== null
    ? [
        { name: t('protein'), value: stats?.avgProtein || 0 },
        { name: t('carbs'), value: stats?.avgCarbs || 0 },
        { name: t('fat'), value: stats?.avgFat || 0 }
      ]
    : []

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
        >
          {showForm ? tc('cancel') : t('logMeal')}
        </button>
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
          <h2 className="text-lg font-medium mb-4">{t('newMeal')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('mealType')} *</label>
                <select
                  value={formData.mealType}
                  onChange={(e) => setFormData({ ...formData, mealType: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="breakfast">{t('breakfast')}</option>
                  <option value="lunch">{t('lunch')}</option>
                  <option value="dinner">{t('dinner')}</option>
                  <option value="snack">{t('snack')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('calories')}</label>
                <input
                  type="number"
                  value={formData.calories}
                  onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('protein')}</label>
                <input
                  type="number"
                  value={formData.protein}
                  onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('carbs')}</label>
                <input
                  type="number"
                  value={formData.carbs}
                  onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('fat')}</label>
                <input
                  type="number"
                  value={formData.fat}
                  onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('foods')}</label>
              <input
                type="text"
                placeholder={t('foodsPlaceholder')}
                value={formData.foods}
                onChange={(e) => setFormData({ ...formData, foods: e.target.value })}
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
            <div className="text-sm text-gray-500">{t('avgCalories')}</div>
            <div className="text-2xl font-bold">{stats.avgCalories?.toFixed(0) || '0'} {t('kcal')}</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('avgProtein')}</div>
            <div className="text-2xl font-bold">{stats.avgProtein?.toFixed(1) || '0'}g</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('avgCarbs')}</div>
            <div className="text-2xl font-bold">{stats.avgCarbs?.toFixed(1) || '0'}g</div>
          </Card>
          <Card padding="sm">
            <div className="text-sm text-gray-500">{t('avgFat')}</div>
            <div className="text-2xl font-bold">{stats.avgFat?.toFixed(1) || '0'}g</div>
          </Card>
        </div>
      )}

      {macroChartData.length > 0 && (
        <div className="grid grid-cols-2 gap-6 mb-6">
          <Card>
            <h2 className="text-lg font-medium mb-4">{t('macroTitle')}</h2>
            <ReactECharts
              option={{
                tooltip: { trigger: 'item', formatter: '{b}: {c}g ({d}%)' },
                color: ['#34D399', '#f43f5e', '#f59e0b'],
                series: [{
                  type: 'pie',
                  radius: ['40%', '70%'],
                  data: macroChartData,
                  label: { formatter: '{b}: {c}g' }
                }]
              }}
              style={{ height: 256 }}
            />
          </Card>
          <Card>
            <h2 className="text-lg font-medium mb-4">{t('macroLegend')}</h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-emerald-500 mr-2"></div>
                <span className="text-sm">{t('protein')}: {stats?.avgProtein?.toFixed(1) || 0}g</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-rose-500 mr-2"></div>
                <span className="text-sm">{t('carbs')}: {stats?.avgCarbs?.toFixed(1) || 0}g</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-amber-500 mr-2"></div>
                <span className="text-sm">{t('fat')}: {stats?.avgFat?.toFixed(1) || 0}g</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">{t('recentMeals')}</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {diets.map((diet) => (
            <li key={diet.id} className="px-6 py-4 hover:bg-gray-50 cursor-pointer">
              <Link href={`/dashboard/diet/${diet.id}`} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div>
                    <div className="text-lg font-medium text-gray-900 capitalize">{t(diet.mealType)}</div>
                    {diet.foods?.length > 0 && (
                      <div className="text-sm text-gray-500">
                        {diet.foods.map(f => f.name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {diet.calories && (
                      <div className="text-sm font-medium">{diet.calories} {t('kcal')}</div>
                    )}
                    <div className="text-xs text-gray-400">{formatDateTime(diet.date)}</div>
                  </div>
                  <span className="text-gray-300">→</span>
                </div>
              </Link>
            </li>
          ))}
          {diets.length === 0 && (
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
