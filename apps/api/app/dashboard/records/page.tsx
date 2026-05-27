'use client'

import { useState, useEffect } from 'react'

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
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    type: 'note',
    data: '',
    tags: '',
    note: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/v1/records?limit=20')
      if (res.ok) {
        const data = await res.json()
        setRecords(data.records || [])
      }
    } catch (error) {
      console.error('Failed to fetch records:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const res = await fetch('/api/v1/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          data: formData.data ? JSON.parse(formData.data) : {},
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          note: formData.note
        })
      })

      if (res.ok) {
        setFormData({ type: 'note', data: '', tags: '', note: '' })
        setShowForm(false)
        fetchData()
      }
    } catch (error) {
      console.error('Failed to add record:', error)
    }
  }

  async function deleteRecord(id: string) {
    if (!confirm('Delete this record?')) return

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
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Records</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : '+ New Record'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">New Record</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                >
                  <option value="note">Note</option>
                  <option value="mood">Mood</option>
                  <option value="symptom">Symptom</option>
                  <option value="medication">Medication</option>
                  <option value="measurement">Measurement</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tags (comma separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="tag1, tag2"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Data (JSON)</label>
              <textarea
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                placeholder='{"key": "value"}'
                rows={3}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Note</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={2}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Save
            </button>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">All Records</h2>
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
                    {new Date(record.date).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => deleteRecord(record.id)}
                  className="ml-4 text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {records.length === 0 && (
            <li className="px-6 py-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📝</div>
              <p>No records yet.</p>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
