'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ReadOnlyContextType {
  isReadOnly: boolean
  readOnlyUserName: string | null
  readOnlyToken: string | null
  exitReadOnly: () => void
}

const ReadOnlyContext = createContext<ReadOnlyContextType>({
  isReadOnly: false,
  readOnlyUserName: null,
  readOnlyToken: null,
  exitReadOnly: () => {}
})

export function useReadOnly() {
  return useContext(ReadOnlyContext)
}

export function ReadOnlyProvider({ children }: { children: ReactNode }) {
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [readOnlyUserName, setReadOnlyUserName] = useState<string | null>(null)
  const [readOnlyToken, setReadOnlyToken] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    // Check localStorage for saved token
    const savedToken = localStorage.getItem('readonly_token')
    if (savedToken) {
      verifyAndSetToken(savedToken)
    } else {
      setInitialized(true)
    }
  }, [])

  async function verifyAndSetToken(token: string) {
    try {
      const res = await fetch(`/api/v1/share/verify?token=${encodeURIComponent(token)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.valid) {
          setIsReadOnly(true)
          setReadOnlyUserName(data.userName)
          setReadOnlyToken(token)
          localStorage.setItem('readonly_token', token)
        } else {
          localStorage.removeItem('readonly_token')
        }
      } else {
        localStorage.removeItem('readonly_token')
      }
    } catch {
      localStorage.removeItem('readonly_token')
    } finally {
      setInitialized(true)
    }
  }

  function exitReadOnly() {
    setIsReadOnly(false)
    setReadOnlyUserName(null)
    setReadOnlyToken(null)
    localStorage.removeItem('readonly_token')
  }

  // Don't render children until we know the read-only state
  if (!initialized) {
    return null
  }

  return (
    <ReadOnlyContext.Provider value={{ isReadOnly, readOnlyUserName, readOnlyToken, exitReadOnly }}>
      {children}
    </ReadOnlyContext.Provider>
  )
}
