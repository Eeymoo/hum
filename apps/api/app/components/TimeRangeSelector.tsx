'use client'

import { useTranslations } from 'next-intl'

interface TimeRange {
  last?: string
  start?: string
  end?: string
}

interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
}

export default function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const t = useTranslations('timeRange')

  function getActivePreset(): string | null {
    if (value.start || value.end) return 'custom'
    if (value.last === '7d') return '7d'
    if (value.last === '30d') return '30d'
    if (value.last === '90d') return '90d'
    if (!value.last) return 'all'
    return null
  }

  const active = getActivePreset()

  function handlePreset(preset: string) {
    switch (preset) {
      case '7d':
      case '30d':
      case '90d':
        onChange({ last: preset })
        break
      case 'all':
        onChange({})
        break
    }
  }

  function handleCustom(field: 'start' | 'end', val: string) {
    onChange({
      ...value,
      last: undefined,
      [field]: val || undefined,
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md overflow-hidden border border-gray-300">
        {(['7d', '30d', '90d', 'all'] as const).map((preset) => (
          <button
            key={preset}
            onClick={() => handlePreset(preset)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              active === preset
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t(preset)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-sm">
        <input
          type="date"
          value={value.start || ''}
          onChange={(e) => handleCustom('start', e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <span className="text-gray-400">~</span>
        <input
          type="date"
          value={value.end || ''}
          onChange={(e) => handleCustom('end', e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
    </div>
  )
}
