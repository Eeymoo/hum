'use client'
import { useReadOnly } from '@/app/components/ReadOnlyProvider'
import { useTranslations } from 'next-intl'

export function ReadOnlyWatermark() {
  const { isReadOnly } = useReadOnly()
  const t = useTranslations('share')

  if (!isReadOnly) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" aria-hidden="true">
      <div className="select-none whitespace-nowrap text-[120px] font-bold text-gray-400/5 -rotate-12">
        {t('readOnlyBadge')}
      </div>
    </div>
  )
}
