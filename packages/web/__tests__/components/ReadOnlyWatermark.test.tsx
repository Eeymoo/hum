import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReadOnlyWatermark } from '@/app/components/ReadOnlyWatermark'
import { useReadOnly } from '@/app/components/ReadOnlyProvider'

// Mock useReadOnly hook
vi.mock('@/app/components/ReadOnlyProvider', () => ({
  useReadOnly: vi.fn(),
  ReadOnlyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      readOnlyBadge: '只读模式',
    }
    return translations[key] ?? key
  },
}))

describe('ReadOnly Watermark', () => {
  it('只读模式下显示水印', () => {
    vi.mocked(useReadOnly).mockReturnValue({
      isReadOnly: true,
      readOnlyUserName: null,
      readOnlyToken: null,
      exitReadOnly: () => {},
    })

    render(<ReadOnlyWatermark />)
    expect(screen.getByText('只读模式')).toBeInTheDocument()
  })

  it('非只读模式下不显示水印', () => {
    vi.mocked(useReadOnly).mockReturnValue({
      isReadOnly: false,
      readOnlyUserName: null,
      readOnlyToken: null,
      exitReadOnly: () => {},
    })

    render(<ReadOnlyWatermark />)
    expect(screen.queryByText('只读模式')).not.toBeInTheDocument()
  })
})
