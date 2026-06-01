'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Card from '@/app/components/Card'

export default function TargetWeightSettings() {
  const t = useTranslations('settings')
  const tw = useTranslations('weight')
  const [targetWeight, setTargetWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/v1/settings')
        if (res.ok) {
          const data = await res.json()
          if (data.settings?.['target-weight']) {
            setTargetWeight(data.settings['target-weight'])
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
    load()
  }, [])

  async function handleSave() {
    if (!targetWeight) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/v1/settings/target-weight', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: targetWeight })
      })
      if (res.ok) {
        setMessage({ type: 'success', text: t('targetWeightSaved') })
      } else {
        setMessage({ type: 'error', text: t('tzError') })
      }
    } catch {
      setMessage({ type: 'error', text: t('tzError') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-gray-900 mb-4">{t('healthGoals')}</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tw('weight')} ({t('targetWeight')})
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="65"
              className="block w-32 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
            />
            <span className="text-sm text-gray-500">kg</span>
            <button
              onClick={handleSave}
              disabled={saving || !targetWeight}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 text-sm"
            >
              {saving ? t('tzSaving') : t('tzSave')}
            </button>
            {message?.type === 'success' && (
              <span className="text-sm text-green-600">OK</span>
            )}
          </div>
        </div>
        {message?.type === 'error' && (
          <div className="text-sm text-red-600">{message.text}</div>
        )}
      </div>
    </Card>
  )
}
