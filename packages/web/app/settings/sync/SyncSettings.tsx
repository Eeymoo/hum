'use client'

import { useState, useEffect, useCallback } from 'react'

// === 类型定义 ===

interface SourceInfo {
  id: string
  name: string
  description: string
  configSchema: {
    key: string
    label: string
    type: string
    placeholder?: string
    required?: boolean
    options?: { label: string; value: string }[]
    defaultValue?: string
  }[]
}

interface UserSyncConfig {
  enabled: boolean
  provider: string | null
  providerConfig: {
    sourceId?: string
    cron?: string
    config?: Record<string, unknown>
  }
}

interface SourceConfig {
  id: string
  sourceId: string
  cron: string
  config: Record<string, unknown>
  lastSyncAt: string | null
  hasToken: boolean
  createdAt: string
}

interface SyncJob {
  id: string
  sourceId: string
  status: string
  result: {
    syncedRecords: { exercise: number; sleep: number; weight: number; diet: number }
    errors: { type: string; message: string }[]
  } | null
  error: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

type LoginMode = 'password' | 'qrcode' | 'token'

export default function SyncSettings() {
  const [userConfig, setUserConfig] = useState<UserSyncConfig>({
    enabled: false,
    provider: null,
    providerConfig: {},
  })
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [sourceConfigs, setSourceConfigs] = useState<SourceConfig[]>([])
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [logging, setLogging] = useState(false)
  const [loginMessage, setLoginMessage] = useState('')
  const [editConfig, setEditConfig] = useState<Record<string, string>>({})
  const [loginMode, setLoginMode] = useState<LoginMode>('qrcode')
  const [manualToken, setManualToken] = useState({
    service_token: '',
    c_user_id: '',
    pass_token: '',
    user_id: '',
    device_id: '',
  })

  // QR code login state
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [qrSessionId, setQrSessionId] = useState('')
  const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'waiting' | 'scanned' | 'expired' | 'error'>('idle')
  const [qrError, setQrError] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [sourcesRes, configRes, jobsRes] = await Promise.all([
        fetch('/api/v1/sync/sources'),
        fetch('/api/v1/sync/config'),
        fetch('/api/v1/sync/jobs?limit=5'),
      ])

      if (sourcesRes.ok) {
        const data = await sourcesRes.json()
        setSources(data.sources || [])
      }
      if (configRes.ok) {
        const data = await configRes.json()
        setUserConfig(data.userConfig || { enabled: false, provider: null, providerConfig: {} })
        setSourceConfigs(data.sourceConfigs || [])

        // 初始化编辑状态
        const sc = (data.sourceConfigs || []).find((s: SourceConfig) => s.sourceId === 'miapi')
        const initial: Record<string, string> = {
          ...(sc?.config as Record<string, string> || {}),
          cron: sc?.cron || '0 9 * * *',
        }
        setEditConfig(initial)
      }
      if (jobsRes.ok) {
        const data = await jobsRes.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('加载同步配置失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // === 获取当前 sourceId 和 source 信息 ===

  const currentSourceId = 'miapi'

  const currentSource = sources.find(s => s.id === currentSourceId)

  const currentSourceConfig = sourceConfigs.find(sc => sc.sourceId === currentSourceId)

  // === 操作处理 ===

  const handleToggle = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/v1/sync/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', enabled }),
      })
      if (res.ok) {
        await loadData()
        if (!enabled) {
          setLoginMessage('')
        }
      }
    } catch (error) {
      console.error('切换同步开关失败:', error)
    }
  }

  const handleSaveConfig = async () => {
    const { cron, ...config } = editConfig

    try {
      const res = await fetch('/api/v1/sync/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          sourceId: 'miapi',
          cron: cron || '0 9 * * *',
          config,
        }),
      })
      if (res.ok) {
        await loadData()
      }
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  }

  const handleLogin = async () => {
    setLogging(true)
    setLoginMessage('')
    try {
      const credentials =
        loginMode === 'token'
          ? {
              service_token: manualToken.service_token,
              c_user_id: manualToken.c_user_id,
              ...(manualToken.pass_token ? { pass_token: manualToken.pass_token } : {}),
              ...(manualToken.user_id ? { user_id: manualToken.user_id } : {}),
              ...(manualToken.device_id ? { device_id: manualToken.device_id } : {}),
            }
          : { username: editConfig.username, password: editConfig.password }

      const res = await fetch('/api/v1/sync/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: 'miapi', credentials }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setLoginMessage(loginMode === 'token' ? 'Token 导入成功' : '登录成功')
        await loadData()
      } else {
        setLoginMessage(`操作失败: ${data.error}`)
      }
    } catch (error: any) {
      setLoginMessage(`操作失败: ${error.message}`)
    } finally {
      setLogging(false)
    }
  }

  // QR code login handlers
  const handleQrInit = async () => {
    setQrStatus('loading')
    setQrError('')
    setQrImageUrl('')
    setLoginMessage('')
    try {
      const res = await fetch('/api/v1/sync/login/qr', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setQrStatus('error')
        setQrError(data.error || '获取二维码失败')
        return
      }
      setQrImageUrl(data.qrImageUrl)
      setQrSessionId(data.sessionId)
      setQrStatus('waiting')
    } catch (error: any) {
      setQrStatus('error')
      setQrError(error.message)
    }
  }

  const handleQrPoll = useCallback(async () => {
    if (!qrSessionId || qrStatus !== 'waiting') return

    try {
      const res = await fetch('/api/v1/sync/login/qr-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: qrSessionId }),
      })
      const data = await res.json()

      if (data.status === 'scanned') {
        setQrStatus('scanned')
        setLoginMessage('二维码登录成功')
        await loadData()
      } else if (data.status === 'expired') {
        setQrStatus('expired')
        setQrError('二维码已过期，请重新获取')
      } else if (data.status === 'error') {
        setQrStatus('error')
        setQrError(data.error || '扫码失败')
      }
      // 'waiting' → 继续轮询
    } catch {
      // 网络错误，继续轮询
    }
  }, [qrSessionId, qrStatus, loadData])

  // QR poll interval
  useEffect(() => {
    if (qrStatus !== 'waiting' || !qrSessionId) return

    // 首次立即 poll（启动后台长轮询）
    handleQrPoll()

    const timer = setInterval(handleQrPoll, 3000)
    return () => clearInterval(timer)
  }, [qrStatus, qrSessionId, handleQrPoll])

  const handleTriggerSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/v1/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok) {
        const r = data.syncedRecords
        alert(`同步完成: 运动=${r.exercise}, 睡眠=${r.sleep}, 体重=${r.weight}`)
      } else {
        alert(`同步失败: ${data.error}`)
      }
      await loadData()
    } catch (error: any) {
      alert(`同步失败: ${error.message}`)
    } finally {
      setSyncing(false)
    }
  }

  // === 渲染 ===

  if (loading) {
    return <div className="text-gray-500 text-sm">加载中...</div>
  }

  return (
    <div className="space-y-5">
      {/* 消息提示 */}
      {loginMessage && (
        <div className={`text-sm p-3 rounded-md ${
          loginMessage.includes('成功')
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700'
        }`}>
          {loginMessage}
        </div>
      )}

      {/* === 第一段：总开关 === */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-gray-900">启用数据同步</h3>
          <p className="text-sm text-gray-500">开启后可从小米健康同步步数、心率、睡眠、体重等数据</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={userConfig.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* enabled=false 时到此为止 */}
      {!userConfig.enabled && (
        <p className="text-sm text-gray-400 text-center py-4">
          请先开启数据同步开关
        </p>
      )}

      {/* === MiApi 配置表单 === */}
      {userConfig.enabled && currentSource && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-medium text-gray-900">{currentSource.name}</h3>
              <p className="text-sm text-gray-500">{currentSource.description}</p>
            </div>
            <button
              onClick={handleTriggerSync}
              disabled={syncing || !currentSourceConfig?.hasToken}
              className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? '同步中...' : '立即同步'}
            </button>
          </div>

          {/* 认证状态 */}
          {currentSourceConfig?.hasToken ? (
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                已绑定
              </span>
            </div>
          ) : (
            <>
              {/* 登录模式切换 */}
              <div className="mb-4">
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setLoginMode('qrcode')}
                    className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                      loginMode === 'qrcode'
                        ? 'border-emerald-600 text-emerald-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    二维码登录
                  </button>
                  <button
                    onClick={() => setLoginMode('password')}
                    className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                      loginMode === 'password'
                        ? 'border-emerald-600 text-emerald-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    密码登录
                  </button>
                  <button
                    onClick={() => setLoginMode('token')}
                    className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                      loginMode === 'token'
                        ? 'border-emerald-600 text-emerald-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    手动导入 Token
                  </button>
                </div>
              </div>

              {loginMode === 'qrcode' ? (
                /* 二维码登录 */
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-3">
                    使用小米运动 App 或微信扫描二维码登录，无需输入密码。
                  </p>

                  {qrStatus === 'idle' && (
                    <button
                      onClick={handleQrInit}
                      className="w-full py-3 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      获取二维码
                    </button>
                  )}

                  {qrStatus === 'loading' && (
                    <div className="flex flex-col items-center py-6">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                      <p className="mt-3 text-sm text-gray-500">正在获取二维码...</p>
                    </div>
                  )}

                  {qrStatus === 'waiting' && qrImageUrl && (
                    <div className="flex flex-col items-center">
                      <div className="border-2 border-gray-200 rounded-lg p-2 bg-white">
                        <img
                          src={qrImageUrl}
                          alt="小米账号登录二维码"
                          className="w-48 h-48"
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
                        等待扫码中...
                      </div>
                      <p className="text-xs text-gray-400 mt-1">请使用小米运动 App 扫描上方二维码</p>
                    </div>
                  )}

                  {qrStatus === 'scanned' && (
                    <div className="flex flex-col items-center py-4">
                      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
                        <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="mt-2 text-sm text-emerald-600 font-medium">登录成功</p>
                    </div>
                  )}

                  {(qrStatus === 'expired' || qrStatus === 'error') && (
                    <div className="flex flex-col items-center py-4">
                      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <p className="mt-2 text-sm text-red-600">
                        {qrError || '发生错误'}
                      </p>
                      <button
                        onClick={handleQrInit}
                        className="mt-3 px-4 py-1.5 text-sm font-medium rounded-md text-emerald-600 border border-emerald-600 hover:bg-emerald-50"
                      >
                        重新获取二维码
                      </button>
                    </div>
                  )}
                </div>
              ) : loginMode === 'password' ? (
                /* 密码登录字段 */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {currentSource.configSchema
                    .filter(f => f.key !== 'cron')
                    .map(field => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type={field.type === 'password' ? 'password' : 'text'}
                          value={editConfig[field.key] || field.defaultValue || ''}
                          onChange={(e) =>
                            setEditConfig(prev => ({ ...prev, [field.key]: e.target.value }))
                          }
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                    ))}
                </div>
              ) : (
                /* 手动导入 Token 字段 */
                <div className="mb-4">
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded mb-3">
                    如果密码登录被风控拦截，可在本地使用{' '}
                    <code className="bg-amber-100 px-1 rounded">curl</code> 或{' '}
                    <code className="bg-amber-100 px-1 rounded">python</code> 脚本获取 Token 后粘贴到此处。
                    参考 miapi.md 中的 cURL 示例。
                  </p>
                  <div className="space-y-3">
                    {/* 必填字段 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          serviceToken <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={manualToken.service_token}
                          onChange={(e) =>
                            setManualToken(prev => ({ ...prev, service_token: e.target.value }))
                          }
                          placeholder="SERVICE_TOKEN"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          cUserId <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={manualToken.c_user_id}
                          onChange={(e) =>
                            setManualToken(prev => ({ ...prev, c_user_id: e.target.value }))
                          }
                          placeholder="CUSER_ID"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    {/* 可选字段（折叠） */}
                    <details className="group">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                        可选字段（填入后支持 Token 自动刷新）
                        <span className="ml-1 inline-block transition-transform group-open:rotate-90">▶</span>
                      </summary>
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-3">
                        <p className="text-xs text-gray-400">
                          填入 passToken 和 userId 后，serviceToken 过期时系统会自动刷新，无需重新导入。
                          这些值都可以从 cURL 脚本输出中获取。
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              passToken
                            </label>
                            <input
                              type="text"
                              value={manualToken.pass_token}
                              onChange={(e) =>
                                setManualToken(prev => ({ ...prev, pass_token: e.target.value }))
                              }
                              placeholder="PASS_TOKEN"
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              userId
                            </label>
                            <input
                              type="text"
                              value={manualToken.user_id}
                              onChange={(e) =>
                                setManualToken(prev => ({ ...prev, user_id: e.target.value }))
                              }
                              placeholder="USER_ID"
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              deviceId
                            </label>
                            <input
                              type="text"
                              value={manualToken.device_id}
                              onChange={(e) =>
                                setManualToken(prev => ({ ...prev, device_id: e.target.value }))
                              }
                              placeholder="DEVICE_ID"
                              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              )}

              {/* 登录/导入按钮（二维码模式不需要） */}
              {loginMode !== 'qrcode' && (
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={handleLogin}
                    disabled={logging}
                    className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {logging
                      ? (loginMode === 'token' ? '导入中...' : '登录中...')
                      : (loginMode === 'token' ? '导入 Token' : '登录')}
                </button>
              </div>
              )}
            </>
          )}

          {/* cron 配置 */}
          <div className="border-t border-gray-100 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  同步频率 (cron)
                </label>
                <input
                  type="text"
                  value={editConfig.cron || '0 9 * * *'}
                  onChange={(e) =>
                    setEditConfig(prev => ({ ...prev, cron: e.target.value }))
                  }
                  placeholder="0 9 * * *"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 保存按钮 + 最后同步时间 */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={handleSaveConfig}
              className="px-3 py-1.5 text-sm font-medium rounded-md text-emerald-600 border border-emerald-600 hover:bg-emerald-50"
            >
              保存配置
            </button>
            {currentSourceConfig?.lastSyncAt && (
              <span className="text-xs text-gray-400">
                最后同步: {new Date(currentSourceConfig.lastSyncAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* === 同步历史 === */}
      {jobs.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-medium text-gray-900 mb-3">同步历史</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">数据源</th>
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">状态</th>
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">同步记录</th>
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{job.sourceId}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        job.status === 'success' ? 'bg-green-100 text-green-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        job.status === 'running' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {job.result ? (
                        <>
                          运动:{job.result.syncedRecords.exercise} ·
                          睡眠:{job.result.syncedRecords.sleep} ·
                          体重:{job.result.syncedRecords.weight}
                        </>
                      ) : '-'}
                    </td>
                    <td className="py-2 pr-4 text-gray-400">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
