'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

export function ExportButton() {
  const t = useTranslations('settings')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleExport() {
    setStatus('loading')

    try {
      const endpoints = [
        { key: 'weights', url: '/api/v1/weights?limit=1000' },
        { key: 'exercises', url: '/api/v1/exercises?limit=1000' },
        { key: 'diets', url: '/api/v1/diets?limit=1000' },
        { key: 'sleeps', url: '/api/v1/sleeps?limit=1000' },
        { key: 'records', url: '/api/v1/records?limit=1000' },
      ]

      const results = await Promise.allSettled(
        endpoints.map(async ({ key, url }) => {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`Failed to fetch ${key}`)
          const data = await res.json()
          return { key, data }
        })
      )

      const exportData: Record<string, unknown> = {}
      for (const result of results) {
        if (result.status === 'fulfilled') {
          exportData[result.value.key] = result.value.data
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hum-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setStatus('success')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleExport}
        disabled={status === 'loading'}
        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? t('exporting') : t('exportButton')}
      </button>
      {status === 'success' && (
        <span className="text-sm text-green-600">{t('exportSuccess')}</span>
      )}
      {status === 'error' && (
        <span className="text-sm text-red-600">{t('exportError')}</span>
      )}
    </div>
  )
}
