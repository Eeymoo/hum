import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import MobileNav from './MobileNav'
import ClientProviders from '@/app/components/ClientProviders'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const t = await getTranslations('nav')

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
                  Hum
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/dashboard" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">
                  {t('dashboard')}
                </Link>
                <Link href="/dashboard/weight" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('weight')}
                </Link>
                <Link href="/dashboard/exercise" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('exercise')}
                </Link>
                <Link href="/dashboard/diet" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('diet')}
                </Link>
                <Link href="/dashboard/sleep" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('sleep')}
                </Link>
                <Link href="/dashboard/timeline" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('timeline')}
                </Link>
                <Link href="/dashboard/records" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('records')}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MobileNav />
              <Link href="/dashboard/api-keys" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                {t('apiKeys')}
              </Link>
              <Link href="/settings" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                {t('settings')}
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <ClientProviders>{children}</ClientProviders>
      </main>
    </div>
  )
}
