import { getRequestConfig } from 'next-intl/server'

const locales = ['en', 'zh'] as const
type Locale = (typeof locales)[number]

function getLocale(headers: Headers): Locale {
  const acceptLanguage = headers.get('accept-language') || ''
  const preferred = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase()
  return locales.includes(preferred as Locale) ? (preferred as Locale) : 'en'
}

export default getRequestConfig(async () => {
  const { headers } = await import('next/headers')
  const h = await headers()
  const locale = getLocale(h)

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
