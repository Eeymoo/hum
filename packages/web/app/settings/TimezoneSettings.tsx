'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Card from '@/app/components/Card'

const PRESET_FORMATS = [
  { value: 'YYYY-MM-DD HH:mm', label: '2000-02-02 02:02' },
  { value: 'YYYY-MM-DD HH:mm:ss', label: '2000-02-02 02:02:02' },
  { value: 'YYYY/MM/DD HH:mm', label: '2000/02/02 02:02' },
  { value: 'MM-DD HH:mm', label: '02-02 02:02' },
  { value: 'MM/DD HH:mm', label: '02/02 02:02' },
]

export default function TimezoneSettings() {
  const t = useTranslations('settings')
  const [timezone, setTimezone] = useState('')
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD HH:mm')
  const [detectedTz, setDetectedTz] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    setDetectedTz(detected)

    const stored = localStorage.getItem('hum_timezone')
    if (stored) {
      setTimezone(stored)
    } else {
      setTimezone(detected)
    }

    const storedFormat = localStorage.getItem('hum_dateFormat')
    if (storedFormat) {
      setDateFormat(storedFormat)
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      localStorage.setItem('hum_timezone', timezone)
      localStorage.setItem('hum_dateFormat', dateFormat)
      setMessage({ type: 'success', text: t('tzSaved') })
    } catch {
      setMessage({ type: 'error', text: t('tzError') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-gray-900 mb-4">{t('timezone')}</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('tzLabel')}</label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder={detectedTz}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
          />
          {detectedTz && (
            <p className="mt-1 text-xs text-gray-500">
              {t('tzDetected')}: {detectedTz}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('dateFormatLabel')}</label>
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
          >
            {PRESET_FORMATS.map((fmt) => (
              <option key={fmt.value} value={fmt.value}>
                {fmt.value} → {fmt.label}
              </option>
            ))}
          </select>
        </div>
        {message && (
          <div className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? t('tzSaving') : t('tzSave')}
        </button>
      </div>
    </Card>
  )
}
