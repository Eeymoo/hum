'use client'

import { useState, useEffect } from 'react'
import ReactECharts from 'react-echarts-library'

interface WeightRecord {
  id: string
  weight: number
  bodyFat?: number
  date: string
}

interface StatsData {
  trend: Array<{ date: string; weight: number; bodyFat?: number }>
  avgWeight: number | null
  minWeight: number | null
  maxWeight: number | null
  change: number | null
}

export default function WeightPage() {
  const [weights, setWeights] = useState<WeightRecord[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    weight: '',
    bodyFat: '',
    note: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setError(null)
      const [weightsRes, statsRes] = await Promise.all([
        fetch('/api/v1/weights?limit=10'),
        fetch('/api/v1/weights/stats?last=30d')
      ])
      
      if (weightsRes.ok) {
        const weightsData = await weightsRes.json()
        setWeights(weightsData.weights || [])
      }
      
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const formDataToSend = new FormData()
    formDataToSend.append('weight', formData.weight)
    if (formData.bodyFat) formDataToSend.append('bodyFat', formData.bodyFat)
    if (formData.note) formDataToSend.append('note', formData.note)

    try {
      const res = await fetch('/api/v1/weights', {
        method: 'POST',
        body: formDataToSend
      })
      
      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error || 'Failed to save. Please try again.')
        return
      }

      setFormData({ weight: '', bodyFat: '', note: '' })
      setShowForm(false)
      fetchData()
    } catch (error) {
      console.error('Failed to add weight:', error)
      setSubmitError('Failed to save. Please try again.')
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
            <div key={i} className="bg-white shadow rounded-lg p-4">
              <div className="animate-pulse bg-gray-200 rounded h-4 w-24 mb-2"></div>
              <div className="animate-pulse bg-gray-200 rounded h-8 w-16"></div>
            </div>
          ))}
        </div>
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="animate-pulse bg-gray-200 rounded h-6 w-48 mb-4"></div>
          <div className="animate-pulse bg-gray-200 rounded h-64 w-full"></div>
        </div>
        <div className="bg-white shadow rounded-lg">
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
        </div>
      </div>
    )
  }

  const chartData = stats?.trend?.map(t => ({
    date: t.date,
    Weight: t.weight,
    'Body Fat': t.bodyFat
  })) || []

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Weight Tracking</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : '+ Add Weight'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => { setError(null); fetchData() }} className="text-sm underline">Retry</button>
        </div>
      )}

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Log New Weight</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Weight (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Body Fat (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.bodyFat}
                  onChange={(e) => setFormData({ ...formData, bodyFat: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Note</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
              />
            </div>
            {submitError && (
              <div className="text-red-600 text-sm">{submitError}</div>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Save
            </button>
          </form>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Average</div>
            <div className="text-2xl font-bold">{stats.avgWeight} kg</div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Min</div>
            <div className="text-2xl font-bold">{stats.minWeight} kg</div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Max</div>
            <div className="text-2xl font-bold">{stats.maxWeight} kg</div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Change (30d)</div>
            <div className={`text-2xl font-bold ${(stats.change || 0) < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.change !== null ? `${stats.change > 0 ? '+' : ''}${stats.change} kg` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Weight Trend (30 days)</h2>
          <ReactECharts
            option={{
              tooltip: { trigger: 'axis', formatter: '{b}: {c} kg' },
              color: ['#6366f1'],
              xAxis: { type: 'category', data: chartData.map(d => d.date) },
              yAxis: { type: 'value' },
              series: [{
                type: 'line',
                name: 'Weight',
                data: chartData.map(d => d.Weight)
              }]
            }}
            style={{ height: 256 }}
          />
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Entries</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {weights.map((weight) => (
            <li key={weight.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-medium text-gray-900">{weight.weight} kg</div>
                  <div className="text-sm text-gray-500">{new Date(weight.date).toLocaleDateString()}</div>
                </div>
                {weight.bodyFat && (
                  <div className="text-sm text-gray-500">Body Fat: {weight.bodyFat}%</div>
                )}
              </div>
            </li>
          ))}
          {weights.length === 0 && (
            <li className="px-6 py-4 text-center text-gray-500">No weight records yet</li>
          )}
        </ul>
      </div>
    </div>
  )
}
