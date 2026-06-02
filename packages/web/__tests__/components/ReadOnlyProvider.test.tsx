import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { ReadOnlyProvider, useReadOnly } from '@/app/components/ReadOnlyProvider'

// Mock localStorage for jsdom
const localStorageStore: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value },
  removeItem: (key: string) => { delete localStorageStore[key] },
  clear: () => Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]),
  get length() { return Object.keys(localStorageStore).length },
  key: (i: number) => Object.keys(localStorageStore)[i] ?? null,
})

// Helper component that consumes the ReadOnlyContext
function Consumer() {
  const { isReadOnly, readOnlyUserName, readOnlyToken, exitReadOnly } = useReadOnly()
  return (
    <div>
      <span data-testid="isReadOnly">{String(isReadOnly)}</span>
      <span data-testid="userName">{readOnlyUserName ?? 'null'}</span>
      <span data-testid="token">{readOnlyToken ?? 'null'}</span>
      <button data-testid="exit" onClick={exitReadOnly}>
        Exit
      </button>
    </div>
  )
}

function mockLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { search },
    writable: true,
    configurable: true,
  })
}

describe('ReadOnlyProvider', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k])
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k])
    // Reset location
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
      configurable: true,
    })
  })

  // ── URL token 优先 ──────────────────────────────────────────

  it('uses URL token when localStorage is empty', async () => {
    mockLocationSearch('?token=url-token-123')
    ;(globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, userName: 'URL User' }),
    })

    render(
      <ReadOnlyProvider>
        <Consumer />
      </ReadOnlyProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isReadOnly')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('userName')).toHaveTextContent('URL User')
    expect(screen.getByTestId('token')).toHaveTextContent('url-token-123')
    expect(window.localStorage.getItem('readonly_token')).toBe('url-token-123')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/share/verify?token=url-token-123',
    )
  })

  // ── localStorage 兜底 ───────────────────────────────────────

  it('uses localStorage token when URL has no token', async () => {
    mockLocationSearch('')
    window.localStorage.setItem('readonly_token', 'saved-token-456')
    ;(globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, userName: 'Saved User' }),
    })

    render(
      <ReadOnlyProvider>
        <Consumer />
      </ReadOnlyProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isReadOnly')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('userName')).toHaveTextContent('Saved User')
    expect(screen.getByTestId('token')).toHaveTextContent('saved-token-456')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/share/verify?token=saved-token-456',
    )
  })

  // ── URL token 优先于 localStorage ───────────────────────────

  it('prefers URL token over localStorage token', async () => {
    mockLocationSearch('?token=url-token')
    window.localStorage.setItem('readonly_token', 'saved-token')
    ;(globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, userName: 'URL Priority' }),
    })

    render(
      <ReadOnlyProvider>
        <Consumer />
      </ReadOnlyProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isReadOnly')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('token')).toHaveTextContent('url-token')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/share/verify?token=url-token',
    )
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  // ── 验证成功 ────────────────────────────────────────────────

  it('sets read-only state correctly on successful verification', async () => {
    mockLocationSearch('?token=valid-token')
    ;(globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, userName: 'Test User' }),
    })

    render(
      <ReadOnlyProvider>
        <Consumer />
      </ReadOnlyProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isReadOnly')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('userName')).toHaveTextContent('Test User')
    expect(screen.getByTestId('token')).toHaveTextContent('valid-token')
    expect(window.localStorage.getItem('readonly_token')).toBe('valid-token')
  })

  // ── 验证失败（valid: false）──────────────────────────────────

  it('clears state when API returns valid: false', async () => {
    mockLocationSearch('')
    window.localStorage.setItem('readonly_token', 'bad-token')
    ;(globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: false }),
    })

    render(
      <ReadOnlyProvider>
        <Consumer />
      </ReadOnlyProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isReadOnly')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('userName')).toHaveTextContent('null')
    expect(screen.getByTestId('token')).toHaveTextContent('null')
    expect(window.localStorage.getItem('readonly_token')).toBeNull()
  })

  // ── 验证失败（!res.ok）───────────────────────────────────────

  it('clears state when API returns non-ok response', async () => {
    mockLocationSearch('')
    window.localStorage.setItem('readonly_token', 'expired-token')
    ;(globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
    })

    render(
      <ReadOnlyProvider>
        <Consumer />
      </ReadOnlyProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isReadOnly')).toHaveTextContent('false')
    })
    expect(window.localStorage.getItem('readonly_token')).toBeNull()
  })

  // ── 验证失败（网络错误）───────────────────────────────────────

  it('clears state on fetch error', async () => {
    mockLocationSearch('')
    window.localStorage.setItem('readonly_token', 'error-token')
    ;(globalThis.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    render(
      <ReadOnlyProvider>
        <Consumer />
      </ReadOnlyProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isReadOnly')).toHaveTextContent('false')
    })
    expect(window.localStorage.getItem('readonly_token')).toBeNull()
  })

  // ── 无 token ────────────────────────────────────────────────

  it('renders children immediately with isReadOnly=false when no token exists', async () => {
    mockLocationSearch('')

    render(
      <ReadOnlyProvider>
        <Consumer />
      </ReadOnlyProvider>,
    )

    expect(screen.getByTestId('isReadOnly')).toHaveTextContent('false')
    expect(screen.getByTestId('userName')).toHaveTextContent('null')
    expect(screen.getByTestId('token')).toHaveTextContent('null')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  // ── exitReadOnly ────────────────────────────────────────────

  it('exitReadOnly clears all state and localStorage', async () => {
    mockLocationSearch('?token=active-token')
    ;(globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, userName: 'Active User' }),
    })

    render(
      <ReadOnlyProvider>
        <Consumer />
      </ReadOnlyProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isReadOnly')).toHaveTextContent('true')
    })
    expect(window.localStorage.getItem('readonly_token')).toBe('active-token')

    await act(async () => {
      screen.getByTestId('exit').click()
    })

    expect(screen.getByTestId('isReadOnly')).toHaveTextContent('false')
    expect(screen.getByTestId('userName')).toHaveTextContent('null')
    expect(screen.getByTestId('token')).toHaveTextContent('null')
    expect(window.localStorage.getItem('readonly_token')).toBeNull()
  })

  // ── 初始化中不渲染子组件 ─────────────────────────────────────

  it('does not render children until initialization completes', async () => {
    mockLocationSearch('?token=slow-token')
    let resolveResponse!: (value: unknown) => void
    const pendingResponse = new Promise((resolve) => {
      resolveResponse = resolve
    })
    ;(globalThis.fetch as any).mockReturnValueOnce(pendingResponse)

    const { container } = render(
      <ReadOnlyProvider>
        <Consumer />
      </ReadOnlyProvider>,
    )

    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('isReadOnly')).toBeNull()

    await act(async () => {
      resolveResponse({
        ok: true,
        json: async () => ({ valid: true, userName: 'Delayed User' }),
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('isReadOnly')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('userName')).toHaveTextContent('Delayed User')
  })
})
