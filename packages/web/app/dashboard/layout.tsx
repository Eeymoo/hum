import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import MobileNav from './MobileNav'
import ClientProviders from '@/app/components/ClientProviders'
import ReadOnlyBadge from '@/app/components/ReadOnlyBadge'
import { ReadOnlyWatermark } from '@/app/components/ReadOnlyWatermark'
import prisma from '@/lib/prisma'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const headersList = await headers()
  const shareToken = headersList.get('x-share-token') || undefined

  // Check for read-only share token
  let readOnlyUserId: string | null = null

  if (shareToken && !session) {
    const token = await prisma.shareToken.findUnique({
      where: { token: shareToken, deleteAt: 0 },
      include: { user: { select: { id: true, name: true } } }
    })

    if (token && token.isActive) {
      readOnlyUserId = token.userId
    }
  }

  // If no session and no valid read-only token, redirect to login
  if (!session && !readOnlyUserId) {
    redirect('/login')
  }

  const t = await getTranslations('nav')
  const isReadOnly = !!readOnlyUserId

  return (
    <div className="min-h-screen bg-gray-100">
      {isReadOnly && <ReadOnlyBadge />}
      {isReadOnly && <ReadOnlyWatermark />}
      <nav className={`bg-white shadow-sm ${isReadOnly ? 'border-b-2 border-amber-200' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href={isReadOnly ? `/dashboard?token=${shareToken}` : '/dashboard'} className="text-xl font-bold text-emerald-600">
                  Hum
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href={isReadOnly ? `/dashboard?token=${shareToken}` : '/dashboard'} className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">
                  {t('dashboard')}
                </Link>
                <Link href={isReadOnly ? `/dashboard/weight?token=${shareToken}` : '/dashboard/weight'} className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('weight')}
                </Link>
                <Link href={isReadOnly ? `/dashboard/exercise?token=${shareToken}` : '/dashboard/exercise'} className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('exercise')}
                </Link>
                <Link href={isReadOnly ? `/dashboard/diet?token=${shareToken}` : '/dashboard/diet'} className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('diet')}
                </Link>
                <Link href={isReadOnly ? `/dashboard/sleep?token=${shareToken}` : '/dashboard/sleep'} className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('sleep')}
                </Link>
                <Link href={isReadOnly ? `/dashboard/timeline?token=${shareToken}` : '/dashboard/timeline'} className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('timeline')}
                </Link>
                <Link href={isReadOnly ? `/dashboard/records?token=${shareToken}` : '/dashboard/records'} className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
                  {t('records')}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MobileNav readOnlyToken={isReadOnly ? shareToken : undefined} />
              {!isReadOnly && (
                <>
                  <Link href="/dashboard/api-keys" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                    {t('apiKeys')}
                  </Link>
                  <Link href="/settings" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                    {t('settings')}
                  </Link>
                </>
              )}
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
