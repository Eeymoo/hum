'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Card from '@/app/components/Card'
import Pagination from '@/app/components/Pagination'

interface ShareToken {
  id: string
  name: string
  token: string
  isActive: boolean
  createdAt: string
  lastUsed: string | null
  _count?: { viewLogs: number }
}

interface ViewLogEntry {
  id: string
  ip: string | null
  userAgent: string | null
  path: string | null
  createdAt: string
}

export default function ShareSettings() {
  const t = useTranslations('share')
  const tc = useTranslations('common')
  const [tokens, setTokens] = useState<ShareToken[]>([])
  const [loading, setLoading] = useState(true)
  const [newTokenName, setNewTokenName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<ShareToken | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedToken, setExpandedToken] = useState<string | null>(null)
  const [viewLogs, setViewLogs] = useState<ViewLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotalPages, setLogsTotalPages] = useState(1)

  useEffect(() => {
    fetchTokens()
  }, [])

  async function fetchTokens() {
    try {
      const res = await fetch('/api/v1/share')
      if (res.ok) {
        const data = await res.json()
        setTokens(data.tokens || [])
      }
    } catch (error) {
      console.error('Failed to fetch share tokens:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      const res = await fetch('/api/v1/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName || 'Read-only Share' })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('created'))
        setCreating(false)
        return
      }

      setNewToken(data.shareToken)
      setNewTokenName('')
      fetchTokens()
    } catch (err) {
      setError(t('created'))
    } finally {
      setCreating(false)
    }
  }

  async function toggleToken(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/v1/share/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      })
      if (res.ok) {
        fetchTokens()
      }
    } catch (error) {
      console.error('Failed to toggle token:', error)
    }
  }

  async function deleteToken(id: string) {
    if (!confirm(t('deleteConfirm'))) return

    try {
      const res = await fetch(`/api/v1/share/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTokens(tokens.filter(t => t.id !== id))
        if (expandedToken === id) setExpandedToken(null)
      }
    } catch (error) {
      console.error('Failed to delete token:', error)
    }
  }

  async function loadViewLogs(tokenId: string, page: number = 1) {
    if (expandedToken === tokenId) {
      setExpandedToken(null)
      return
    }

    setExpandedToken(tokenId)
    setLogsLoading(true)
    setLogsPage(page)

    try {
      const res = await fetch(`/api/v1/share/${tokenId}/logs?page=${page}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setViewLogs(data.logs || [])
        setLogsTotalPages(data.totalPages || 1)
      }
    } catch (error) {
      console.error('Failed to load view logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  function getShareLink(token: string) {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/dashboard?token=${token}`
    }
    return `/dashboard?token=${token}`
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function maskToken(token: string) {
    if (token.length <= 12) return '****'
    return token.slice(0, 8) + '...' + token.slice(-4)
  }

  function parseUserAgent(ua: string | null): string {
    if (!ua) return '-'
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome'
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
    if (ua.includes('Edg')) return 'Edge'
    return 'Other'
  }

  if (loading) {
    return <div className="animate-pulse bg-gray-200 rounded h-48"></div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-medium text-gray-900 mb-2">{t('title')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('description')}</p>

        {newToken && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-medium text-green-800">{t('created')}</h3>
                <p className="text-sm text-green-600 mt-1">{t('copyWarning')}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="bg-white px-3 py-1 rounded text-sm font-mono border">
                    {newToken.token}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newToken.token, 'new-token')}
                    className="text-sm text-green-700 hover:text-green-800 font-medium"
                  >
                    {copied === 'new-token' ? t('copied') : tc('copy')}
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="bg-white px-3 py-1 rounded text-xs font-mono border max-w-md truncate">
                    {getShareLink(newToken.token)}
                  </code>
                  <button
                    onClick={() => copyToClipboard(getShareLink(newToken.token), 'new-link')}
                    className="text-sm text-green-700 hover:text-green-800 font-medium"
                  >
                    {copied === 'new-link' ? t('copied') : t('copyLink')}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setNewToken(null)}
                className="text-green-600 hover:text-green-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <form onSubmit={createToken} className="flex gap-4">
          <input
            type="text"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder={t('tokenNamePlaceholder')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? t('creating') : t('createToken')}
          </button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </Card>

      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">{t('yourTokens')}</h2>
        </div>

        {tokens.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <p>{t('noTokens')}</p>
            <p className="text-sm">{t('createHint')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {tokens.map((token) => (
              <li key={token.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{token.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        token.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {token.isActive ? t('active') : t('inactive')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 font-mono mt-1">
                      {maskToken(token.token)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {tc('created')}: {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsed && (
                        <span> · {t('lastUsed')}: {new Date(token.lastUsed).toLocaleDateString()}</span>
                      )}
                      {token._count && (
                        <span> · {t('viewLogs')}: {token._count.viewLogs}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(getShareLink(token.token), `link-${token.id}`)}
                      className="px-3 py-1 text-sm text-emerald-600 hover:text-emerald-800 border border-emerald-200 rounded hover:bg-emerald-50"
                    >
                      {copied === `link-${token.id}` ? t('copied') : t('copyLink')}
                    </button>
                    <button
                      onClick={() => toggleToken(token.id, token.isActive)}
                      className="px-3 py-1 text-sm text-amber-600 hover:text-amber-800 border border-amber-200 rounded hover:bg-amber-50"
                    >
                      {t('toggleActive')}
                    </button>
                    <button
                      onClick={() => loadViewLogs(token.id)}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:bg-blue-50"
                    >
                      {t('viewLogs')}
                    </button>
                    <button
                      onClick={() => deleteToken(token.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50"
                    >
                      {tc('delete')}
                    </button>
                  </div>
                </div>

                {/* View Logs Panel */}
                {expandedToken === token.id && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">{t('viewLogTitle')}</h4>
                    <p className="text-xs text-gray-500 mb-3">{t('viewLogDesc')}</p>

                    {logsLoading ? (
                      <div className="animate-pulse space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="bg-gray-200 rounded h-8"></div>
                        ))}
                      </div>
                    ) : viewLogs.length === 0 ? (
                      <p className="text-sm text-gray-400">{t('noLogs')}</p>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500 border-b border-gray-200">
                                <th className="pb-2 pr-4 font-medium">{t('viewerTime')}</th>
                                <th className="pb-2 pr-4 font-medium">{t('viewerIp')}</th>
                                <th className="pb-2 pr-4 font-medium">{t('viewerPath')}</th>
                                <th className="pb-2 font-medium">{t('viewerAgent')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {viewLogs.map((log) => (
                                <tr key={log.id}>
                                  <td className="py-2 pr-4 text-gray-600">
                                    {new Date(log.createdAt).toLocaleString()}
                                  </td>
                                  <td className="py-2 pr-4 text-gray-600 font-mono text-xs">
                                    {log.ip || '-'}
                                  </td>
                                  <td className="py-2 pr-4 text-gray-600">
                                    {log.path || '-'}
                                  </td>
                                  <td className="py-2 text-gray-600">
                                    {parseUserAgent(log.userAgent)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {logsTotalPages > 1 && (
                          <div className="flex justify-center mt-3 gap-2">
                            <button
                              onClick={() => loadViewLogs(token.id, logsPage - 1)}
                              disabled={logsPage <= 1}
                              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                            >
                              ←
                            </button>
                            <span className="px-3 py-1 text-sm text-gray-500">
                              {logsPage} / {logsTotalPages}
                            </span>
                            <button
                              onClick={() => loadViewLogs(token.id, logsPage + 1)}
                              disabled={logsPage >= logsTotalPages}
                              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                            >
                              →
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
