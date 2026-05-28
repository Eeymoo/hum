'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

interface TimezoneContextType {
  timezone: string
  dateFormat: string
  formatDate: (date: string | Date) => string
  formatDateTime: (date: string | Date) => string
  appendTimezoneOffset: (dateStr: string) => string
}

const TimezoneContext = createContext<TimezoneContextType | null>(null)

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezone] = useState('UTC')
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD HH:mm')

  useEffect(() => {
    const storedTz = localStorage.getItem('hum_timezone')
    const storedFormat = localStorage.getItem('hum_dateFormat')
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

    setTimezone(storedTz || detectedTz)
    setDateFormat(storedFormat || 'YYYY-MM-DD HH:mm')
  }, [])

  // Listen for storage changes (e.g. settings page saves)
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === 'hum_timezone') {
        setTimezone(e.newValue || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
      }
      if (e.key === 'hum_dateFormat') {
        setDateFormat(e.newValue || 'YYYY-MM-DD HH:mm')
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const formatDate = useCallback((date: string | Date) => {
    return dayjs(date).tz(timezone).format('YYYY-MM-DD')
  }, [timezone])

  const formatDateTime = useCallback((date: string | Date) => {
    return dayjs(date).tz(timezone).format(dateFormat)
  }, [timezone, dateFormat])

  const appendTimezoneOffset = useCallback((dateStr: string) => {
    if (!dateStr) return dateStr
    // Pure date like "2026-05-28" - no offset needed
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr
    }
    // Already has timezone offset
    if (/[+-]\d{2}:\d{2}$/.test(dateStr) || /Z$/.test(dateStr)) {
      return dateStr
    }
    // Datetime without offset - append user's timezone
    const offset = dayjs().tz(timezone).format('Z')
    return `${dateStr}${offset}`
  }, [timezone])

  return (
    <TimezoneContext.Provider value={{ timezone, dateFormat, formatDate, formatDateTime, appendTimezoneOffset }}>
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone() {
  const ctx = useContext(TimezoneContext)
  if (!ctx) {
    throw new Error('useTimezone must be used within a TimezoneProvider')
  }
  return ctx
}
