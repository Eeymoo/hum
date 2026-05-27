import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Profile</h2>
          <div className="flex items-center">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt="Profile"
                className="w-16 h-16 rounded-full mr-4"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
                <span className="text-2xl text-indigo-600">
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
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">API Keys</h2>
          <p className="text-sm text-gray-500 mb-4">
            Manage your API keys for CLI access.
          </p>
          <a
            href="/api/auth/keys"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Manage API Keys
          </a>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Data Export</h2>
          <p className="text-sm text-gray-500 mb-4">
            Export all your health data.
          </p>
          <button
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Export Data
          </button>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Account</h2>
          <form action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
