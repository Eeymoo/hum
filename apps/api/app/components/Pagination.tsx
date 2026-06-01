'use client'

import { useTranslations } from 'next-intl'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  limitOptions?: number[]
}

export default function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const t = useTranslations('pagination')

  if (totalPages <= 1 && total === 0) return null

  function getPageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)

      let start = Math.max(2, page - 1)
      let end = Math.min(totalPages - 1, page + 1)

      if (page <= 3) {
        start = 2
        end = Math.min(4, totalPages - 1)
      } else if (page >= totalPages - 2) {
        start = Math.max(totalPages - 3, 2)
        end = totalPages - 1
      }

      if (start > 2) pages.push('...')
      for (let i = start; i <= end; i++) pages.push(i)
      if (end < totalPages - 1) pages.push('...')

      pages.push(totalPages)
    }

    return pages
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2">
        {onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {limitOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / {t('page')}
              </option>
            ))}
          </select>
        )}
        <span className="text-sm text-gray-500">
          {t('total', { count: total })}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-2 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('prev')}
        </button>

        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-sm text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`px-2.5 py-1 text-sm rounded border ${
                p === page
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-2 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('next')}
        </button>
      </div>
    </div>
  )
}
