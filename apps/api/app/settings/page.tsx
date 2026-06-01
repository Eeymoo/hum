import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import Card from '@/app/components/Card'
import { ExportButton } from './ExportButton'
import TimezoneSettings from './TimezoneSettings'
import TargetWeightSettings from './TargetWeightSettings'

export default async function SettingsPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const t = await getTranslations('settings')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('title')}</h1>

      <div className="space-y-6">
        <Card>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('profile')}</h2>
          <div className="flex items-center">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt="Profile"
                width={64}
                height={64}
                className="w-16 h-16 rounded-full mr-4"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mr-4">
                <span className="text-2xl text-emerald-600">
                  {session.user?.name?.[0] || session.user?.email?.[0] || '?'}
                </span>
              </div>
            )}
            <div>
              <div className="text-lg font-medium text-gray-900">
                {session.user?.name || 'User'}
              </div>
              <div className="text-sm text-gray-500">{session.user?.email}</div>
            </div>
          </div>
        </Card>

        <TimezoneSettings />

        <TargetWeightSettings />

        <Card>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('apiKeys')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {t('apiKeysDesc')}
          </p>
          <a
            href="/dashboard/api-keys"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
          >
            {t('manageKeys')}
          </a>
        </Card>

        <Card>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('dataExport')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {t('exportDesc')}
          </p>
          <ExportButton />
        </Card>

        <Card>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('account')}</h2>
          <form action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
            >
              {t('signOut')}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}
