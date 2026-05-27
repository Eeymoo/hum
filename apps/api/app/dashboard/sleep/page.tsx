'use client'

import { useState, useEffect } from 'react'
import { BarChart } from '@tremor/react'

interface SleepRecord {
  id: string
  duration: number
  bedTime: string
  wakeTime: string
  quality: number
  deepSleep?: number
  remSleep?: number
  date: string
}

interface StatsData {
  avgDuration: number | null
  avgQuality: number | null
  avgDeepSleep: number | null
  count: number
}

export default function SleepPage() {
  const [sleeps, setSleeps] = useState<SleepRecord[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    duration: '',
    bedTime: '22:00',
    wakeTime: '06:00',
    quality: '7',
    deepSleep: '',
    remSleep: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [sleepsRes, statsRes] = await Promise.all([
        fetch('/api/v1/sleeps?limit=10'),
        fetch('/api/v1/sleeps/stats?last=7d')
      ])
      
      if (sleepsRes.ok) {
        const data = await sleepsRes.json()
        setSleeps(data.sleeps || [])
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch sleeps:', error)
    } finally {
      setLoading(false)
    }
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

    try {
      const res = await fetch('/api/v1/sleeps', {
        method: 'POST',
        body: formDataToSend
      })
      
      if (res.ok) {
        setFormData({ duration: '', bedTime: '22:00', wakeTime: '06:00', quality: '7', deepSleep: '', remSleep: '' })
        setShowForm(false)
        fetchData()
      }
    } catch (error) {
      console.error('Failed to add sleep:', error)
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  const chartData = sleeps.slice(0, 7).reverse().map(s => ({
    date: new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' }),
    Duration: s.duration,
    Quality: s.quality
  }))

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sleep Tracking</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : '+ Log Sleep'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Log Sleep</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Duration (hours) *</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bed Time *</label>
                <input
                  type="time"
                  required
                  value={formData.bedTime}
                  onChange={(e) => setFormData({ ...formData, bedTime: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Wake Time *</label>
                <input
                  type="time"
                  required
                  value={formData.wakeTime}
                  onChange={(e) => setFormData({ ...formData, wakeTime: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Quality (1-10) *</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={formData.quality}
                  onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Deep Sleep (hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.deepSleep}
                  onChange={(e) => setFormData({ ...formData, deepSleep: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">REM Sleep (hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.remSleep}
                  onChange={(e) => setFormData({ ...formData, remSleep: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
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
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Avg Duration</div>
            <div className="text-2xl font-bold">{stats.avgDuration?.toFixed(1) || '0'}h</div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Avg Quality</div>
            <div className="text-2xl font-bold">{stats.avgQuality?.toFixed(1) || '0'}/10</div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Avg Deep Sleep</div>
            <div className="text-2xl font-bold">{stats.avgDeepSleep?.toFixed(1) || '0'}h</div>
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Sleep Duration & Quality (Last 7 Days)</h2>
          <BarChart
            className="h-64"
            data={chartData}
            index="date"
            categories={['Duration', 'Quality']}
            colors={['indigo', 'rose']}
            valueFormatter={(value, category) => category === 'Quality' ? `${value}/10` : `${value}h`}
          />
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Sleep Records</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {sleeps.map((sleep) => (
            <li key={sleep.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">😴</span>
                  <div>
                    <div className="text-lg font-medium text-gray-900">{sleep.duration}h</div>
                    <div className="text-sm text-gray-500">{sleep.bedTime} - {sleep.wakeTime}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">Quality: {sleep.quality}/10</div>
                  {sleep.deepSleep && (
                    <div className="text-sm text-gray-500">Deep: {sleep.deepSleep}h</div>
                  )}
                  {sleep.remSleep && (
                    <div className="text-sm text-gray-500">REM: {sleep.remSleep}h</div>
                  )}
                  <div className="text-xs text-gray-400">{new Date(sleep.date).toLocaleDateString()}</div>
                </div>
              </div>
            </li>
          ))}
          {sleeps.length === 0 && (
            <li className="px-6 py-4 text-center text-gray-500">No sleep records yet</li>
          )}
        </ul>
      </div>
    </div>
  )
}
