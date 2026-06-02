'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useTimezone } from '@/app/components/TimezoneProvider'
import Card from '@/app/components/Card'
import { useReadOnly } from '@/app/components/ReadOnlyProvider'
import { useReadOnlyFetch } from '@/app/components/useReadOnlyFetch'

interface RecordDetail {
  id: string
  type: string
  data: any
  tags?: string[]
  note?: string | null
  attachments?: Array<{ filename: string; originalName?: string }>
  date: string
  createdAt: string
  updatedAt: string
}

export default function RecordDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('records')
  const tc = useTranslations('common')
  const { formatDateTime } = useTimezone()
  const readOnlyFetch = useReadOnlyFetch()
  const { isReadOnly } = useReadOnly()
  const [data, setData] = useState<RecordDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await readOnlyFetch(`/api/v1/records/${params.id}`)
        if (res.status === 404) {
          setError('not_found')
          return
        }
        if (!res.ok) {
          setError(tc('errorLoad'))
          return
        }
        const json = await res.json()
        setData(json)
      } catch {
        setError(tc('errorLoad'))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params.id, tc])

  async function handleDelete() {
    if (!confirm(t('deleteConfirm'))) return
    setDeleting(true)
    try {
      const res = await readOnlyFetch(`/api/v1/records/${params.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard/records')
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse bg-gray-200 rounded h-6 w-32 mb-6"></div>
        <div className="animate-pulse bg-gray-200 rounded h-8 w-48 mb-6"></div>
        <Card padding="sm">
          <div className="animate-pulse bg-gray-200 rounded h-4 w-24 mb-2"></div>
          <div className="animate-pulse bg-gray-200 rounded h-20 w-full"></div>
        </Card>
      </div>
    )
  }

  if (error === 'not_found') {
    return (
      <div className="p-6">
        <Link href="/dashboard/records" className="text-emerald-600 hover:text-emerald-800 mb-4 inline-block">← {t('title')}</Link>
        <Card padding="lg" className="text-center">
          <p className="text-gray-500">{t('noRecords')}</p>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Link href="/dashboard/records" className="text-emerald-600 hover:text-emerald-800 mb-4 inline-block">← {t('title')}</Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="text-sm underline">{tc('retry')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <Link href="/dashboard/records" className="text-emerald-600 hover:text-emerald-800 mb-4 inline-block">
        ← {t('title')}
      </Link>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{t('detailTitle')}</h1>
        </div>
        <span className="text-sm text-gray-500">{formatDateTime(data.date)}</span>
      </div>

      <Card padding="sm" className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            {t(data.type) || data.type}
          </span>
          {data.tags && data.tags.map(tag => (
            <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              #{tag}
            </span>
          ))}
        </div>
      </Card>

      {data.data && Object.keys(data.data).length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-2">{t('data')}</h2>
          <pre className="text-sm text-gray-700 bg-gray-50 p-4 rounded overflow-auto">
            {JSON.stringify(data.data, null, 2)}
          </pre>
        </Card>
      )}

      {data.note && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-2">{t('note')}</h2>
          <p className="text-gray-900 whitespace-pre-wrap">{data.note}</p>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-400">
          {tc('created')}: {formatDateTime(data.createdAt)}
          {data.updatedAt !== data.createdAt && ` · ${t('updated')}: ${formatDateTime(data.updatedAt)}`}
        </div>
        {!isReadOnly && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? '...' : tc('delete')}
          </button>
        )}
      </div>
    </div>
  )
}
