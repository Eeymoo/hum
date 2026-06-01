'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useTimezone } from '@/app/components/TimezoneProvider'
import Card from '@/app/components/Card'
import { useReadOnly } from '@/app/components/ReadOnlyProvider'

interface WeightDetail {
  id: string
  weight: number
  bodyFat?: number | null
  muscleMass?: number | null
  bmi?: number | null
  water?: number | null
  boneMass?: number | null
  visceralFat?: number | null
  note?: string | null
  attachments?: Array<{ filename: string; originalName?: string }>
  extraData?: any
  date: string
  createdAt: string
  updatedAt: string
}

export default function WeightDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('weight')
  const tc = useTranslations('common')
  const { formatDateTime } = useTimezone()
  const { isReadOnly } = useReadOnly()
  const [data, setData] = useState<WeightDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/v1/weights/${params.id}`)
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
      const res = await fetch(`/api/v1/weights/${params.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard/weight')
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[0, 1, 2, 3].map(i => (
            <Card key={i} padding="sm">
              <div className="animate-pulse bg-gray-200 rounded h-4 w-20 mb-2"></div>
              <div className="animate-pulse bg-gray-200 rounded h-8 w-16"></div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error === 'not_found') {
    return (
      <div className="p-6">
        <Link href="/dashboard/weight" className="text-emerald-600 hover:text-emerald-800 mb-4 inline-block">← {t('title')}</Link>
        <Card padding="lg" className="text-center">
          <p className="text-gray-500">{t('noRecords')}</p>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Link href="/dashboard/weight" className="text-emerald-600 hover:text-emerald-800 mb-4 inline-block">← {t('title')}</Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="text-sm underline">{tc('retry')}</button>
        </div>
      </div>
    )
  }

  const stats = [
    { label: t('weight'), value: `${data.weight} kg`, always: true },
    { label: t('bodyFat'), value: data.bodyFat != null ? `${data.bodyFat}%` : null },
    { label: t('muscleMass'), value: data.muscleMass != null ? `${data.muscleMass} kg` : null },
    { label: t('bmi'), value: data.bmi != null ? `${data.bmi}` : null },
    { label: t('water'), value: data.water != null ? `${data.water}%` : null },
    { label: t('boneMass'), value: data.boneMass != null ? `${data.boneMass} kg` : null },
    { label: t('visceralFat'), value: data.visceralFat != null ? `${data.visceralFat}` : null },
  ]

  return (
    <div className="p-6">
      <Link href="/dashboard/weight" className="text-emerald-600 hover:text-emerald-800 mb-4 inline-block">
        ← {t('title')}
      </Link>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('detailTitle')}</h1>
        <span className="text-sm text-gray-500">{formatDateTime(data.date)}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.filter(s => s.value).map(stat => (
          <Card key={stat.label} padding="sm">
            <div className="text-sm text-gray-500">{stat.label}</div>
            <div className="text-2xl font-bold">{stat.value}</div>
          </Card>
        ))}
      </div>

      {data.note && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-2">{t('note')}</h2>
          <p className="text-gray-900 whitespace-pre-wrap">{data.note}</p>
        </Card>
      )}

      {data.attachments && data.attachments.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-2">{t('attachments')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.attachments.map((att, i) => (
              <a key={i} href={`/api/v1/files/weights/${att.filename}`} target="_blank" rel="noopener noreferrer">
                <img
                  src={`/api/v1/files/weights/${att.filename}`}
                  alt={att.originalName || att.filename}
                  className="w-full h-32 object-cover rounded-lg border border-gray-200"
                />
              </a>
            ))}
          </div>
        </Card>
      )}

      {data.extraData && Object.keys(data.extraData).length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-2">{t('extraData')}</h2>
          <pre className="text-sm text-gray-700 bg-gray-50 p-4 rounded overflow-auto">
            {JSON.stringify(data.extraData, null, 2)}
          </pre>
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
