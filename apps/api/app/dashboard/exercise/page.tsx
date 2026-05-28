'use client'

import { useState, useEffect } from 'react'
import ReactECharts from 'react-echarts-library'

interface ExerciseRecord {
  id: string
  type: string
  duration: number
  caloriesBurned?: number
  activities: Array<{ name: string }>
  feeling?: number
  date: string
}

interface StatsData {
  totalDuration: number
  totalCalories: number
  frequencyByType: Record<string, number>
  count: number
}

export default function ExercisePage() {
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
    feeling: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setError(null)
      const [exercisesRes, statsRes] = await Promise.all([
        fetch('/api/v1/exercises?limit=10'),
        fetch('/api/v1/exercises/stats?last=30d')
      ])
      
      if (exercisesRes.ok) {
        const data = await exercisesRes.json()
        setExercises(data.exercises || [])
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch exercises:', error)
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const formDataToSend = new FormData()
    formDataToSend.append('type', formData.type)
    formDataToSend.append('duration', formData.duration)
    if (formData.caloriesBurned) formDataToSend.append('caloriesBurned', formData.caloriesBurned)
    if (formData.activities) formDataToSend.append('activities', formData.activities)
    if (formData.feeling) formDataToSend.append('feeling', formData.feeling)

    try {
      const res = await fetch('/api/v1/exercises', {
        method: 'POST',
        body: formDataToSend
      })
      
      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error || 'Failed to save. Please try again.')
        return
      }

      setFormData({ type: 'running', duration: '', caloriesBurned: '', activities: '', feeling: '' })
      setShowForm(false)
      fetchData()
    } catch (error) {
      console.error('Failed to add exercise:', error)
      setSubmitError('Failed to save. Please try again.')
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
            <div key={i} className="bg-white shadow rounded-lg p-4">
              <div className="animate-pulse bg-gray-200 rounded h-4 w-24 mb-2"></div>
              <div className="animate-pulse bg-gray-200 rounded h-8 w-16"></div>
            </div>
          ))}
        </div>
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="animate-pulse bg-gray-200 rounded h-6 w-64 mb-4"></div>
          <div className="animate-pulse bg-gray-200 rounded h-64 w-full"></div>
        </div>
        <div className="bg-white shadow rounded-lg">
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
        </div>
      </div>
    )
  }

  const typeIcons: Record<string, string> = {
    running: '🏃',
    strength: '💪',
    cycling: '🚴',
    swimming: '🏊',
    other: '🎯'
  }

  const chartData = stats?.frequencyByType 
    ? Object.entries(stats.frequencyByType).map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        sessions: count
      }))
    : []

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Exercise Tracking</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : '+ Log Exercise'}
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
          <h2 className="text-lg font-medium mb-4">Log New Exercise</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="running">Running</option>
                  <option value="strength">Strength</option>
                  <option value="cycling">Cycling</option>
                  <option value="swimming">Swimming</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Duration (min) *</label>
                <input
                  type="number"
                  required
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Calories Burned</label>
                <input
                  type="number"
                  value={formData.caloriesBurned}
                  onChange={(e) => setFormData({ ...formData, caloriesBurned: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Feeling (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.feeling}
                  onChange={(e) => setFormData({ ...formData, feeling: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Activities</label>
              <input
                type="text"
                placeholder="e.g., Jogging:duration=30,distance=5km"
                value={formData.activities}
                onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Total Sessions</div>
            <div className="text-2xl font-bold">{stats.count}</div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Total Duration</div>
            <div className="text-2xl font-bold">{stats.totalDuration} min</div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Total Calories</div>
            <div className="text-2xl font-bold">{stats.totalCalories} kcal</div>
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Exercise Frequency by Type (30 days)</h2>
          <ReactECharts
            option={{
              tooltip: { trigger: 'axis', formatter: '{b}: {c} sessions' },
              color: ['#6366f1'],
              xAxis: { type: 'category', data: chartData.map(d => d.type) },
              yAxis: { type: 'value' },
              series: [{
                type: 'bar',
                data: chartData.map(d => d.sessions)
              }]
            }}
            style={{ height: 256 }}
          />
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Exercises</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {exercises.map((exercise) => (
            <li key={exercise.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{typeIcons[exercise.type] || '🎯'}</span>
                  <div>
                    <div className="text-lg font-medium text-gray-900 capitalize">{exercise.type}</div>
                    <div className="text-sm text-gray-500">{exercise.duration} min</div>
                  </div>
                </div>
                <div className="text-right">
                  {exercise.caloriesBurned && (
                    <div className="text-sm text-gray-500">{exercise.caloriesBurned} kcal</div>
                  )}
                  {exercise.feeling && (
                    <div className="text-sm text-gray-500">Feeling: {exercise.feeling}/10</div>
                  )}
                  <div className="text-xs text-gray-400">{new Date(exercise.date).toLocaleDateString()}</div>
                </div>
              </div>
            </li>
          ))}
          {exercises.length === 0 && (
            <li className="px-6 py-4 text-center text-gray-500">No exercise records yet</li>
          )}
        </ul>
      </div>
    </div>
  )
}
