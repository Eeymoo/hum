'use client'

import { useState, useEffect, useCallback } from 'react'

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

interface SyncConfig {
  id: string
  sourceId: string
  enabled: boolean
  cron: string
  config: Record<string, unknown>
  lastSyncAt: string | null
  hasToken: boolean
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

export default function SyncSettings() {
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [configs, setConfigs] = useState<SyncConfig[]>([])
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const [loginMessage, setLoginMessage] = useState('')
  const [editConfigs, setEditConfigs] = useState<Record<string, Record<string, string>>>({})
  const [qrState, setQrState] = useState<{ sourceId: string; qrUrl: string; longPollingUrl: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [sourcesRes, configsRes, jobsRes] = await Promise.all([
        fetch('/api/v1/sync/sources'),
        fetch('/api/v1/sync/config'),
        fetch('/api/v1/sync/jobs?limit=5'),
      ])

      if (sourcesRes.ok) {
        const data = await sourcesRes.json()
        setSources(data.sources || [])
      }
      if (configsRes.ok) {
        const data = await configsRes.json()
        const configsData = data.configs || []
        setConfigs(configsData)

        // 初始化编辑状态
        const initialEdits: Record<string, Record<string, string>> = {}
        for (const cfg of configsData) {
          initialEdits[cfg.sourceId] = {
            ...(cfg.config as Record<string, string>),
            cron: cfg.cron,
          }
        }
        setEditConfigs(initialEdits)
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

  const getConfig = (sourceId: string): SyncConfig | undefined => {
    return configs.find(c => c.sourceId === sourceId)
  }

  // Step 1: 获取二维码
  const handleLogin = async (sourceId: string) => {
    setLogging(true)
    setLoginMessage('')
    try {
      const res = await fetch('/api/v1/sync/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      })
      const data = await res.json()
      if (res.ok && data.step === 'scan') {
        setQrState({ sourceId, qrUrl: data.qrUrl, longPollingUrl: data.longPollingUrl })
        setLoginMessage('请使用小米账号 App 扫描二维码')
      } else {
        setLoginMessage(`获取二维码失败: ${data.error}`)
      }
    } catch (error: any) {
      setLoginMessage(`获取二维码失败: ${error.message}`)
    } finally {
      setLogging(false)
    }
  }

  // Step 2: 确认扫码完成（轮询）
  const handleConfirmScan = async () => {
    if (!qrState) return
    setLogging(true)
    try {
      const res = await fetch('/api/v1/sync/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: qrState.sourceId, longPollingUrl: qrState.longPollingUrl }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setLoginMessage(`${qrState.sourceId}: 登录成功`)
        setQrState(null)
        await loadData()
      } else {
        setLoginMessage(`登录失败: ${data.error}，请重试`)
      }
    } catch (error: any) {
      setLoginMessage(`登录失败: ${error.message}`)
    } finally {
      setLogging(false)
    }
  }

  const handleSaveConfig = async (sourceId: string) => {
    const edits = editConfigs[sourceId] || {}
    const { cron, ...config } = edits

    try {
      const res = await fetch('/api/v1/sync/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          enabled: getConfig(sourceId)?.enabled ?? false,
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

  const handleToggleEnabled = async (sourceId: string, enabled: boolean) => {
    const edits = editConfigs[sourceId] || {}
    const { cron, ...config } = edits

    try {
      const res = await fetch('/api/v1/sync/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, enabled, cron: cron || '0 9 * * *', config }),
      })
      if (res.ok) {
        await loadData()
      }
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  const handleTriggerSync = async (sourceId: string) => {
    setSyncing(sourceId)
    try {
      const res = await fetch('/api/v1/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
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
      setSyncing(null)
    }
  }

  if (loading) {
    return <div className="text-gray-500 text-sm">加载中...</div>
  }

  return (
    <div className="space-y-4">
      {loginMessage && (
        <div className={`text-sm p-3 rounded-md ${loginMessage.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {loginMessage}
        </div>
      )}

      {sources.map(source => {
        const config = getConfig(source.id)
        const edits = editConfigs[source.id] || {}

        return (
          <div key={source.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-medium text-gray-900">{source.name}</h3>
                <p className="text-sm text-gray-500">{source.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTriggerSync(source.id)}
                  disabled={!!syncing || !config?.hasToken}
                  className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing === source.id ? '同步中...' : '立即同步'}
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config?.enabled ?? false}
                    onChange={(e) => handleToggleEnabled(source.id, e.target.checked)}
                    disabled={!config?.hasToken}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {!config?.hasToken && !qrState?.sourceId?.startsWith(source.id) ? (
              <div className="mb-3">
                <button
                  onClick={() => handleLogin(source.id)}
                  disabled={logging}
                  className="px-3 py-1.5 text-sm font-medium rounded-md border border-emerald-600 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {logging ? '获取二维码...' : '登录绑定账号'}
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  请先登录绑定账号后才能启用同步
                </p>
              </div>
            ) : !config?.hasToken ? (
              <div className="mb-3 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700 mb-2">{loginMessage}</p>
                {qrState?.qrUrl && (
                  <img src={qrState.qrUrl} alt="QR Code" className="w-48 h-48 mx-auto mb-2" />
                )}
                <button
                  onClick={handleConfirmScan}
                  disabled={logging}
                  className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {logging ? '等待扫码...' : '我已扫码，确认登录'}
                </button>
                <button
                  onClick={() => { setQrState(null); setLoginMessage('') }}
                  className="ml-2 px-3 py-1.5 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  已绑定
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {source.configSchema.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={edits[field.key] || field.defaultValue || ''}
                    onChange={(e) =>
                      setEditConfigs(prev => ({
                        ...prev,
                        [source.id]: { ...prev[source.id], [field.key]: e.target.value },
                      }))
                    }
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => handleSaveConfig(source.id)}
                className="px-3 py-1.5 text-sm font-medium rounded-md text-emerald-600 border border-emerald-600 hover:bg-emerald-50"
              >
                保存配置
              </button>
              {config?.lastSyncAt && (
                <span className="text-xs text-gray-400">
                  最后同步: {new Date(config.lastSyncAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* 同步历史 */}
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

      {sources.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          暂无可用的同步数据源
        </div>
      )}
    </div>
  )
}
