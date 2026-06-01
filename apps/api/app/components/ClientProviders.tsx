'use client'

import { TimezoneProvider } from '@/app/components/TimezoneProvider'
import { ReadOnlyProvider } from '@/app/components/ReadOnlyProvider'
import { ReactNode } from 'react'

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <TimezoneProvider>
      <ReadOnlyProvider>
        {children}
      </ReadOnlyProvider>
    </TimezoneProvider>
  )
}
