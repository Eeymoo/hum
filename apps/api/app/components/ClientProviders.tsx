'use client'

import { TimezoneProvider } from '@/app/components/TimezoneProvider'
import { ReactNode } from 'react'

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <TimezoneProvider>
      {children}
    </TimezoneProvider>
  )
}
