'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

function DeviceAuthContent() {
  const t = useTranslations('login')
  const searchParams = useSearchParams()
  const userCode = searchParams.get('code')

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userCode) return

    fetch('/api/v1/auth/device')
      .then((res) => {
        if (res.status === 401) {
          setIsLoggedIn(false)
        } else {
          setIsLoggedIn(true)
        }
      })
      .catch(() => setIsLoggedIn(false))
  }, [userCode])

  const handleApprove = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/v1/auth/device/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'expired_token') {
          setError(t('deviceExpired'))
        } else if (data.error === 'invalid_code') {
          setError(t('deviceInvalid'))
        } else {
          setError(data.error_description || data.error || 'Error')
        }
        return
      }

      setApproved(true)
    } catch {
      setError(t('deviceInvalid'))
    } finally {
      setLoading(false)
    }
  }

  if (!userCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-gray-900">{t('deviceTitle')}</h2>
            <p className="mt-4 text-red-500">{t('deviceInvalid')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <div className="text-center text-gray-500">{t('deviceTitle')}</div>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-gray-900">{t('deviceTitle')}</h2>
            <p className="mt-4 text-gray-600">{t('deviceLoginRequired')}</p>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/login/device?code=${userCode}`)}`}
              className="mt-6 inline-flex justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              {t('deviceGoToLogin')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (approved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-extrabold text-gray-900">{t('deviceTitle')}</h2>
            <p className="mt-4 text-emerald-600">{t('deviceApproved')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            {t('deviceTitle')}
          </h2>
          <p className="mt-2 text-center text-gray-600">
            {t('deviceDescription')}
          </p>
        </div>

        <div className="text-center">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('deviceCodeLabel')}
          </label>
          <div className="text-4xl font-mono font-bold tracking-widest text-gray-900 py-4 px-6 bg-gray-50 rounded-lg border border-gray-200">
            {userCode}
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>
        )}

        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {t('deviceCancel')}
          </Link>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : t('deviceApprove')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DeviceLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
            <div className="text-center text-gray-500">Loading...</div>
          </div>
        </div>
      }
    >
      <DeviceAuthContent />
    </Suspense>
  )
}
