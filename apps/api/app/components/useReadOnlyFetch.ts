'use client'

import { useCallback } from 'react'
import { useReadOnly } from '@/app/components/ReadOnlyProvider'
import { useSearchParams } from 'next/navigation'

/**
 * A fetch wrapper that automatically appends the read-only share token
 * to API requests when in read-only mode.
 */
export function useReadOnlyFetch() {
  const { readOnlyToken } = useReadOnly()
  const searchParams = useSearchParams()
  const token = readOnlyToken || searchParams.get('token')

  const readOnlyFetch = useCallback(
    (input: string, init?: RequestInit) => {
      if (!token) return fetch(input, init)

      const url = new URL(input, window.location.origin)
      url.searchParams.set('token', token)
      return fetch(url.toString(), init)
    },
    [token]
  )

  return readOnlyFetch
}
