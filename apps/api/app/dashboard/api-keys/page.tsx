'use client'

import { useState, useEffect } from 'react'

interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed: string | null
}

export default function ApiKeysPage() {
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
        setError(data.error || 'Failed to create API key')
        setCreating(false)
        return
      }

      setNewKey(data.apiKey)
      setNewKeyName('')
      fetchKeys()
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  async function deleteKey(id: string) {
    if (!confirm('Are you sure you want to delete this API key?')) {
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
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage API keys for CLI and third-party access.
          </p>
        </div>
      </div>

      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-green-800">API Key Created</h3>
              <p className="text-sm text-green-600 mt-1">
                Copy this key now. You won't be able to see it again!
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="bg-white px-3 py-1 rounded text-sm font-mono border">
                  {newKey.key}
                </code>
                <button
                  onClick={() => copyToClipboard(newKey.key)}
                  className="text-sm text-green-700 hover:text-green-800 font-medium"
                >
                  Copy
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

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Create New API Key</h2>
        <form onSubmit={createKey} className="flex gap-4">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., CLI, Mobile App)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Key'}
          </button>
        </form>
        {error && (
          <p className="text-red-500 text-sm mt-2">{error}</p>
        )}
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Your API Keys</h2>
        </div>

        {keys.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <div className="text-4xl mb-2">🔑</div>
            <p>No API keys yet.</p>
            <p className="text-sm">Create one above to get started.</p>
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
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsed && (
                        <span> · Last used: {new Date(key.lastUsed).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(key.key)}
                      className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded hover:bg-indigo-50"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => deleteKey(key.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Usage Example</h3>
        <pre className="text-xs text-gray-600 bg-white p-3 rounded border overflow-x-auto">
{`curl http://localhost:3000/api/v1/exercises \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
        </pre>
      </div>
    </div>
  )
}
