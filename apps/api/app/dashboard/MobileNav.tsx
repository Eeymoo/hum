'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function MobileNav() {
  const t = useTranslations('nav')
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  const navLinks = [
    { href: '/dashboard', label: t('dashboard') },
    { href: '/dashboard/weight', label: t('weight') },
    { href: '/dashboard/exercise', label: t('exercise') },
    { href: '/dashboard/diet', label: t('diet') },
    { href: '/dashboard/sleep', label: t('sleep') },
    { href: '/dashboard/timeline', label: t('timeline') },
    { href: '/dashboard/records', label: t('records') },
    { href: '/dashboard/api-keys', label: t('apiKeys') },
    { href: '/settings', label: t('settings') },
  ]

  // Close on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="sm:hidden" ref={menuRef}>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-colors"
        aria-expanded={isOpen}
        aria-label="Toggle navigation menu"
      >
        <svg
          className="h-6 w-6"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Dropdown panel */}
      <div
        className={`absolute left-0 right-0 bg-white shadow-lg border-t border-gray-200 overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                pathname === href
                  ? 'text-gray-900 bg-gray-50'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
