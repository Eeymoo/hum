'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

export default function WeightCalendarExplanation() {
  const t = useTranslations('weight')
  const [showExplanation, setShowExplanation] = useState(false)

  return (
    <div className="mt-2 mb-6">
      <button
        onClick={() => setShowExplanation(!showExplanation)}
        className="text-sm text-blue-500 hover:underline"
      >
        {t('calendarExplanationToggle')}
      </button>

      {showExplanation && (
        <div className="mt-2 p-4 bg-gray-50 rounded-lg text-sm space-y-2">
          <h4 className="font-semibold">{t('calendarTitle')}</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('calendarRule1')}</li>
            <li>{t('calendarRule2')}</li>
            <li>{t('calendarRule3')}</li>
            <li>{t('calendarRule4')}</li>
            <li>{t('calendarRule5')}</li>
            <li>{t('calendarRule6')}</li>
          </ul>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs text-gray-500">{t('legend')}:</span>
            <span className="inline-block w-4 h-4 bg-green-700 rounded" />
            <span className="text-xs">{t('legendDeepGreen')}</span>
            <span className="inline-block w-4 h-4 bg-green-300 rounded" />
            <span className="text-xs">{t('legendLightGreen')}</span>
            <span className="inline-block w-4 h-4 bg-white border rounded" />
            <span className="text-xs">{t('legendWhite')}</span>
            <span className="inline-block w-4 h-4 bg-red-300 rounded" />
            <span className="text-xs">{t('legendLightRed')}</span>
            <span className="inline-block w-4 h-4 bg-red-500 rounded" />
            <span className="text-xs">{t('legendDeepRed')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
