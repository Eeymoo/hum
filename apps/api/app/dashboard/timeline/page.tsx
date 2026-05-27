'use client'

import { useState, useEffect } from 'react'

interface TimelineItem {
  type: 'weight' | 'exercise' | 'diet' | 'sleep' | 'record'
  id: string
  date: string
  data: any
}

export default function TimelinePage() {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/v1/timeline')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  const typeIcons: Record<string, string> = {
    weight: '⚖️',
    exercise: '🏃',
    diet: '🍽️',
    sleep: '😴',
    record: '📝'
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Timeline</h1>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">All Activity</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`} className="px-6 py-4">
              <div className="flex items-start">
                <span className="text-2xl mr-3">{typeIcons[item.type] || '📝'}</span>
                <div className="flex-1">
                  <div className="text-sm text-gray-500 capitalize mb-1">{item.type}</div>
                  <div className="text-sm text-gray-900">
                    {item.type === 'weight' && `${item.data.weight} kg`}
                    {item.type === 'exercise' && `${item.data.duration} min ${item.data.type}`}
                    {item.type === 'diet' && `${item.data.calories || 0} kcal (${item.data.mealType})`}
                    {item.type === 'sleep' && `${item.data.duration}h, Quality: ${item.data.quality}/10`}
                    {item.type === 'record' && item.data.type}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(item.date).toLocaleString()}
                  </div>
                </div>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-6 py-4 text-center text-gray-500">No activity records yet</li>
          )}
        </ul>
      </div>
    </div>
  )
}
