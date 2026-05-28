'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface TimelineItem {
  type: 'weight' | 'exercise' | 'diet' | 'sleep' | 'record'
  id: string
  date: string
  data: any
}

export default function TimelinePage() {
  const t = useTranslations('timeline')
  const tc = useTranslations('common')
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setError(null)
      const res = await fetch('/api/v1/timeline')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch timeline:', error)
      setError(tc('errorLoad'))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse bg-gray-200 rounded h-8 w-28 mb-6"></div>
        <div className="bg-white shadow rounded-lg">
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
        </div>
      </div>
    )
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('title')}</h1>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => { setError(null); fetchData() }} className="text-sm underline">{tc('retry')}</button>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">{t('allActivity')}</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`} className="px-6 py-4">
              <div className="flex items-start">
                <span className="text-2xl mr-3">{typeIcons[item.type] || '📝'}</span>
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
                    {new Date(item.date).toLocaleString()}
                  </div>
                </div>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-6 py-4 text-center text-gray-500">{t('noRecords')}</li>
          )}
        </ul>
      </div>
    </div>
  )
}
