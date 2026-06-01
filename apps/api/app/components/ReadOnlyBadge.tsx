'use client'

import { useReadOnly } from '@/app/components/ReadOnlyProvider'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

export default function ReadOnlyBadge() {
  const { isReadOnly, readOnlyUserName, exitReadOnly } = useReadOnly()
  const t = useTranslations('share')
  const router = useRouter()

  if (!isReadOnly) return null

  function handleExit() {
    exitReadOnly()
    router.push('/login')
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            👁 {t('readOnlyBadge')}
          </span>
          <span className="text-sm text-amber-700">
            {t('readOnlyNotice')}
          </span>
        </div>
        <button
          onClick={handleExit}
          className="text-sm text-amber-700 hover:text-amber-900 font-medium underline"
        >
          {t('backToFull')}
        </button>
      </div>
    </div>
  )
}
