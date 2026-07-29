import { useTranslations } from 'next-intl'

interface SourceBadgeProps {
  sourceId: string | null | undefined
  className?: string
}

export default function SourceBadge({ sourceId, className = '' }: SourceBadgeProps) {
  const t = useTranslations('common')

  if (!sourceId) return null

  const prefix = sourceId.split('_')[0]
  const label = prefix === 'miapi' ? t('sourceXiaomi') : t('sourceSynced')

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 ${className}`}
      title={sourceId}
    >
      {label}
    </span>
  )
}
