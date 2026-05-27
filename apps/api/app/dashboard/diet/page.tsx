'use client'

import { useState, useEffect } from 'react'
import { DonutChart } from '@tremor/react'

interface DietRecord {
  id: string
  mealType: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  foods: Array<{ name: string }>
  date: string
}

interface StatsData {
  avgCaloriesPerDay: number | null
  avgProtein: number | null
  avgCarbs: number | null
  avgFat: number | null
  totalWater: number | null
  count: number
}

export default function DietPage() {
  const [diets, setDiets] = useState<DietRecord[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    mealType: 'breakfast',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    foods: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [dietsRes, statsRes] = await Promise.all([
        fetch('/api/v1/diets?limit=10'),
        fetch('/api/v1/diets/stats?last=7d')
      ])
      
      if (dietsRes.ok) {
        const data = await dietsRes.json()
        setDiets(data.diets || [])
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch diets:', error)
    } finally {
      setLoading(false)
    }
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

    try {
      const res = await fetch('/api/v1/diets', {
        method: 'POST',
        body: formDataToSend
      })
      
      if (res.ok) {
        setFormData({ mealType: 'breakfast', calories: '', protein: '', carbs: '', fat: '', foods: '' })
        setShowForm(false)
        fetchData()
      }
    } catch (error) {
      console.error('Failed to add diet:', error)
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  const mealIcons: Record<string, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    dinner: '🌙',
    snack: '🍪'
  }

  const macroChartData = stats?.avgProtein !== null
    ? [
        { name: 'Protein', value: stats?.avgProtein || 0 },
        { name: 'Carbs', value: stats?.avgCarbs || 0 },
        { name: 'Fat', value: stats?.avgFat || 0 }
      ]
    : []

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Diet Tracking</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : '+ Log Meal'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">Log New Meal</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Meal Type *</label>
                <select
                  value={formData.mealType}
                  onChange={(e) => setFormData({ ...formData, mealType: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Calories</label>
                <input
                  type="number"
                  value={formData.calories}
                  onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Protein (g)</label>
                <input
                  type="number"
                  value={formData.protein}
                  onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Carbs (g)</label>
                <input
                  type="number"
                  value={formData.carbs}
                  onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fat (g)</label>
                <input
                  type="number"
                  value={formData.fat}
                  onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Foods</label>
              <input
                type="text"
                placeholder="e.g., Rice:200g,Chicken:150g"
                value={formData.foods}
                onChange={(e) => setFormData({ ...formData, foods: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
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
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Avg Daily Calories</div>
            <div className="text-2xl font-bold">{stats.avgCaloriesPerDay?.toFixed(0) || '0'} kcal</div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Avg Protein</div>
            <div className="text-2xl font-bold">{stats.avgProtein?.toFixed(1) || '0'}g</div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Avg Carbs</div>
            <div className="text-2xl font-bold">{stats.avgCarbs?.toFixed(1) || '0'}g</div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="text-sm text-gray-500">Avg Fat</div>
            <div className="text-2xl font-bold">{stats.avgFat?.toFixed(1) || '0'}g</div>
          </div>
        </div>
      )}

      {macroChartData.length > 0 && (
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Macro Distribution (Avg per day)</h2>
            <DonutChart
              className="h-64"
              data={macroChartData}
              category="value"
              index="name"
              colors={['indigo', 'rose', 'amber']}
              valueFormatter={(value) => `${value.toFixed(1)}g`}
            />
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Macros Legend</h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-indigo-500 mr-2"></div>
                <span className="text-sm">Protein: {stats?.avgProtein?.toFixed(1) || 0}g</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-rose-500 mr-2"></div>
                <span className="text-sm">Carbs: {stats?.avgCarbs?.toFixed(1) || 0}g</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-amber-500 mr-2"></div>
                <span className="text-sm">Fat: {stats?.avgFat?.toFixed(1) || 0}g</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Meals</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {diets.map((diet) => (
            <li key={diet.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{mealIcons[diet.mealType] || '🍽️'}</span>
                  <div>
                    <div className="text-lg font-medium text-gray-900 capitalize">{diet.mealType}</div>
                    {diet.foods?.length > 0 && (
                      <div className="text-sm text-gray-500">
                        {diet.foods.map(f => f.name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {diet.calories && (
                    <div className="text-sm font-medium">{diet.calories} kcal</div>
                  )}
                  <div className="text-xs text-gray-400">{new Date(diet.date).toLocaleDateString()}</div>
                </div>
              </div>
            </li>
          ))}
          {diets.length === 0 && (
            <li className="px-6 py-4 text-center text-gray-500">No diet records yet</li>
          )}
        </ul>
      </div>
    </div>
  )
}
