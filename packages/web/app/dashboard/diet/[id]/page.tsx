'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useTimezone } from '@/app/components/TimezoneProvider'
import Card from '@/app/components/Card'
import { useReadOnly } from '@/app/components/ReadOnlyProvider'
import { useReadOnlyFetch } from '@/app/components/useReadOnlyFetch'

interface DietDetail {
  id: string
  mealType: string
  calories?: number | null
  protein?: number | null
  carbs?: number | null
  fat?: number | null
  fiber?: number | null
  sodium?: number | null
  foods?: Array<{ name: string; [key: string]: any }>
  water?: number | null
  note?: string | null
  attachments?: Array<{ filename: string; originalName?: string }>
  extraData?: any
  date: string
  createdAt: string
  updatedAt: string
}

export default function DietDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('diet')
  const tc = useTranslations('common')
  const { formatDateTime } = useTimezone()
  const readOnlyFetch = useReadOnlyFetch()
  const { isReadOnly } = useReadOnly()
  const [data, setData] = useState<DietDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await readOnlyFetch(`/api/v1/diets/${params.id}`)
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
      const res = await readOnlyFetch(`/api/v1/diets/${params.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard/diet')
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Link href="/dashboard/diet" className="text-emerald-600 hover:text-emerald-800 mb-4 inline-block">← {t('title')}</Link>
        <Card padding="lg" className="text-center">
          <p className="text-gray-500">{t('noRecords')}</p>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Link href="/dashboard/diet" className="text-emerald-600 hover:text-emerald-800 mb-4 inline-block">← {t('title')}</Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} className="text-sm underline">{tc('retry')}</button>
        </div>
      </div>
    )
  }

  const stats = [
    { label: t('mealType'), value: t(data.mealType) },
    { label: t('calories'), value: data.calories != null ? `${data.calories} ${t('kcal')}` : null },
    { label: t('protein'), value: data.protein != null ? `${data.protein}g` : null },
    { label: t('carbs'), value: data.carbs != null ? `${data.carbs}g` : null },
    { label: t('fat'), value: data.fat != null ? `${data.fat}g` : null },
    { label: t('fiber'), value: data.fiber != null ? `${data.fiber}g` : null },
    { label: t('sodium'), value: data.sodium != null ? `${data.sodium}mg` : null },
    { label: t('water'), value: data.water != null ? `${data.water}ml` : null },
  ]

  return (
    <div className="p-6">
      <Link href="/dashboard/diet" className="text-emerald-600 hover:text-emerald-800 mb-4 inline-block">
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

      {data.foods && data.foods.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-2">{t('foods')}</h2>
          <div className="space-y-2">
            {data.foods.map((food, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {food.name}
                </span>
                {Object.entries(food).filter(([k]) => k !== 'name').map(([k, v]) => (
                  <span key={k} className="text-sm text-gray-500">{k}: {String(v)}</span>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

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
              <a key={i} href={`/api/v1/files/diets/${att.filename}`} target="_blank" rel="noopener noreferrer">
                <img
                  src={`/api/v1/files/diets/${att.filename}`}
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
