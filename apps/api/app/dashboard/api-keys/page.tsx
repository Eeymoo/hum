'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Card from '@/app/components/Card'

interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed: string | null
}

export default function ApiKeysPage() {
  const t = useTranslations('apiKeys')
  const tc = useTranslations('common')
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<ApiKey | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchKeys()
  }, [])

  async function fetchKeys() {
    try {
      const res = await fetch('/api/v1/api-keys')
      if (res.ok) {
        const data = await res.json()
        setKeys(data.keys || [])
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'API Key' })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('createError'))
        setCreating(false)
        return
      }

      setNewKey(data.apiKey)
      setNewKeyName('')
      fetchKeys()
    } catch (err) {
      setError(t('error'))
    } finally {
      setCreating(false)
    }
  }

  async function deleteKey(id: string) {
    if (!confirm(t('deleteConfirm'))) {
      return
    }

    try {
      const res = await fetch(`/api/v1/api-keys/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setKeys(keys.filter(k => k.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete API key:', error)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  function maskKey(key: string) {
    if (key.length <= 8) return '****'
    return key.slice(0, 4) + '...' + key.slice(-4)
  }

  if (loading) {
    return <div className="p-6">{tc('loading')}</div>
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('description')}
          </p>
        </div>
      </div>

      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-green-800">{t('created')}</h3>
              <p className="text-sm text-green-600 mt-1">
                {t('copyWarning')}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="bg-white px-3 py-1 rounded text-sm font-mono border">
                  {newKey.key}
                </code>
                <button
                  onClick={() => copyToClipboard(newKey.key)}
                  className="text-sm text-green-700 hover:text-green-800 font-medium"
                >
                  {tc('copy')}
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="text-green-600 hover:text-green-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <Card className="mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">{t('createTitle')}</h2>
        <form onSubmit={createKey} className="flex gap-4">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t('namePlaceholder')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? t('creating') : t('createButton')}
          </button>
        </form>
        {error && (
          <p className="text-red-500 text-sm mt-2">{error}</p>
        )}
      </Card>

      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">{t('yourKeys')}</h2>
        </div>

        {keys.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <p>{t('noKeys')}</p>
            <p className="text-sm">{t('createHint')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {keys.map((key) => (
              <li key={key.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{key.name}</div>
                    <div className="text-sm text-gray-500 font-mono mt-1">
                      {maskKey(key.key)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {tc('created')}: {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsed && (
                        <span> · {tc('lastUsed')}: {new Date(key.lastUsed).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(key.key)}
                      className="px-3 py-1 text-sm text-emerald-600 hover:text-emerald-800 border border-emerald-200 rounded hover:bg-emerald-50"
                    >
                      {tc('copy')}
                    </button>
                    <button
                      onClick={() => deleteKey(key.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50"
                    >
                      {tc('delete')}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">{t('usageExample')}</h3>
        <pre className="text-xs text-gray-600 bg-white p-3 rounded border overflow-x-auto">
{`curl http://localhost:3000/api/v1/exercises \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
        </pre>
      </div>
    </div>
  )
}
