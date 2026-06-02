import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      deviceTitle: 'Device Authorization',
      deviceCodeLabel: 'Device Code',
      deviceDescription: 'Are you trying to authorize a device?',
      deviceApprove: 'Authorize',
      deviceCancel: 'Cancel',
      deviceApproved: 'Device authorized successfully!',
      deviceExpired: 'This device code has expired.',
      deviceInvalid: 'Invalid device code.',
      deviceLoginRequired: 'Please sign in to authorize this device.',
      deviceGoToLogin: 'Go to Login',
    }
    return translations[key] ?? key
  },
}))

// Mock next/navigation
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Must import after mocks
import DeviceLoginPage from '@/app/login/device/page'

describe('DeviceLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete('code')
  })

  it('无 code 参数时显示无效提示', async () => {
    render(<DeviceLoginPage />)

    await waitFor(() => {
      expect(screen.getByText('Invalid device code.')).toBeInTheDocument()
    })
  })

  it('未登录时显示登录引导', async () => {
    mockSearchParams.set('code', 'ABCD-1234')
    mockFetch.mockResolvedValue({ status: 401 })

    render(<DeviceLoginPage />)

    await waitFor(() => {
      expect(screen.getByText('Please sign in to authorize this device.')).toBeInTheDocument()
    })
    expect(screen.getByText('Go to Login')).toBeInTheDocument()
  })

  it('已登录时显示授权界面和 code', async () => {
    mockSearchParams.set('code', 'ABCD-1234')
    mockFetch.mockResolvedValue({ status: 200, ok: true })

    render(<DeviceLoginPage />)

    await waitFor(() => {
      expect(screen.getByText('ABCD-1234')).toBeInTheDocument()
    })
    expect(screen.getByText('Authorize')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('点击授权按钮成功后显示成功信息', async () => {
    mockSearchParams.set('code', 'ABCD-1234')

    // 第一次 fetch: 检查登录状态
    mockFetch.mockResolvedValueOnce({ status: 200, ok: true })
    // 第二次 fetch: 授权请求
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    render(<DeviceLoginPage />)

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Authorize'))

    await waitFor(() => {
      expect(screen.getByText('Device authorized successfully!')).toBeInTheDocument()
    })
  })

  it('授权过期 code 时显示过期错误', async () => {
    mockSearchParams.set('code', 'EXPIRED-0000')

    mockFetch.mockResolvedValueOnce({ status: 200, ok: true })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'expired_token' }),
    })

    render(<DeviceLoginPage />)

    await waitFor(() => {
      expect(screen.getByText('Authorize')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Authorize'))

    await waitFor(() => {
      expect(screen.getByText('This device code has expired.')).toBeInTheDocument()
    })
  })
})
