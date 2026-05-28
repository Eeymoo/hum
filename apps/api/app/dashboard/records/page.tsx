'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import TimeRangeSelector from '@/app/components/TimeRangeSelector'
import Pagination from '@/app/components/Pagination'
import { useTimezone } from '@/app/components/TimezoneProvider'

interface TimeRange {
  last?: string
  start?: string
  end?: string
}

interface Record {
  id: string
  type: string
  data: any
  tags: string[]
  note: string
  date: string
  createdAt: string
}

export default function RecordsPage() {
  const t = useTranslations('records')
  const tc = useTranslations('common')
  const { formatDateTime, appendTimezoneOffset } = useTimezone()
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    type: 'note',
    data: '',
    tags: '',
    note: '',
    date: ''
  })
  const [timeRange, setTimeRange] = useState<TimeRange>({ last: '7d' })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (timeRange.last) params.set('last', timeRange.last)
      if (timeRange.start) params.set('start', timeRange.start)
      if (timeRange.end) params.set('end', timeRange.end)

      const res = await fetch(`/api/v1/records?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRecords(data.records || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      }
    } catch (error) {
      console.error('Failed to fetch records:', error)
      setError(tc('errorLoad'))
    } finally {
      setLoading(false)
    }
  }, [page, limit, timeRange, tc])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleTimeRangeChange(range: TimeRange) {
    setTimeRange(range)
    setPage(1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const body: any = {
        type: formData.type,
        data: formData.data ? JSON.parse(formData.data) : {},
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        note: formData.note
      }
      if (formData.date) {
        body.date = appendTimezoneOffset(formData.date)
      }

      const res = await fetch('/api/v1/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error || tc('errorSave'))
        return
      }

      setFormData({ type: 'note', data: '', tags: '', note: '', date: '' })
      setShowForm(false)
      fetchData()
    } catch (error) {
      console.error('Failed to add record:', error)
      setSubmitError(tc('errorSave'))
    }
  }

  async function deleteRecord(id: string) {
    if (!confirm(t('deleteConfirm'))) return

    try {
      const res = await fetch(`/api/v1/records/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRecords(records.filter(r => r.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete record:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="animate-pulse bg-gray-200 rounded h-8 w-28"></div>
          <div className="animate-pulse bg-gray-200 rounded h-10 w-32"></div>
        </div>
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="animate-pulse bg-gray-200 rounded h-6 w-32"></div>
          </div>
          <ul className="divide-y divide-gray-200">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <li key={i} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="animate-pulse bg-gray-200 rounded-full h-5 w-16"></div>
                      <div className="animate-pulse bg-gray-200 rounded h-4 w-12"></div>
                    </div>
                    <div className="animate-pulse bg-gray-200 rounded h-4 w-3/4 mb-2"></div>
                    <div className="animate-pulse bg-gray-200 rounded h-3 w-24"></div>
                  </div>
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-12 ml-4"></div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => { setShowForm(!showForm); setSubmitError(null) }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? tc('cancel') : t('newRecord')}
        </button>
      </div>

      <div className="mb-6">
        <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => { setError(null); fetchData() }} className="text-sm underline">{tc('retry')}</button>
        </div>
      )}

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">{t('newRecordTitle')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('type')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                >
                  <option value="note">{t('noteType')}</option>
                  <option value="mood">{t('mood')}</option>
                  <option value="symptom">{t('symptom')}</option>
                  <option value="medication">{t('medication')}</option>
                  <option value="measurement">{t('measurement')}</option>
                  <option value="other">{t('other')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('tags')}</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder={t('tagsPlaceholder')}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('data')}</label>
              <textarea
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                placeholder={t('dataPlaceholder')}
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('note')}</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={2}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('date')}</label>
              <input
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            {submitError && (
              <div className="text-red-600 text-sm">{submitError}</div>
            )}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              {tc('save')}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">{t('allRecords')}</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {records.map((record) => (
            <li key={record.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {record.type}
                    </span>
                    {record.tags?.map((tag: string) => (
                      <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                    ))}
                  </div>
                  {record.note && (
                    <p className="text-sm text-gray-700 mt-1">{record.note}</p>
                  )}
                  {record.data && Object.keys(record.data).length > 0 && (
                    <pre className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded">
                      {JSON.stringify(record.data, null, 2)}
                    </pre>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {formatDateTime(record.date)}
                  </div>
                </div>
                <button
                  onClick={() => deleteRecord(record.id)}
                  className="ml-4 text-red-600 hover:text-red-800 text-sm"
                >
                  {tc('delete')}
                </button>
              </div>
            </li>
          ))}
          {records.length === 0 && (
            <li className="px-6 py-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📝</div>
              <p>{t('noRecords')}</p>
            </li>
          )}
        </ul>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1) }}
        />
      </div>
    </div>
  )
}
