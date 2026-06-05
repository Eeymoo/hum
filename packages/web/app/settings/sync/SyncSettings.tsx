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
      const res = await fetch('/api/v1/sync/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: 'miapi',
          credentials: {
            username: editConfig.username,
            password: editConfig.password,
          },
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setLoginMessage('登录成功')
        await loadData()
      } else {
        setLoginMessage(`登录失败: ${data.error}`)
      }
    } catch (error: any) {
      setLoginMessage(`登录失败: ${error.message}`)
    } finally {
      setLogging(false)
    }
  }

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
            <p className="text-xs text-gray-400 mb-4">
              请先登录并保存配置
            </p>
          )}

          {/* 配置字段 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentSource.configSchema.map(field => (
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

          {/* 登录 + 保存按钮 */}
          <div className="mt-4 flex items-center gap-3">
            {!currentSourceConfig?.hasToken && (
              <button
                onClick={handleLogin}
                disabled={logging}
                className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {logging ? '登录中...' : '登录'}
              </button>
            )}
            <button
              onClick={handleSaveConfig}
              className="px-3 py-1.5 text-sm font-medium rounded-md text-emerald-600 border border-emerald-600 hover:bg-emerald-50"
            >
              保存配置
            </button>
            {currentSourceConfig?.lastSyncAt && (
              <span className="text-xs text-gray-400 ml-auto">
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
