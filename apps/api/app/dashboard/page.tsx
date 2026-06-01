import { auth } from '@/auth'
import Card from '@/app/components/Card'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

async function getTodayData(userId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [latestWeight, latestSleep, todayExercises, todayDiets] = await Promise.all([
    prisma.weight.findFirst({
      where: { userId, deleteAt: 0 },
      orderBy: { date: 'desc' }
    }),
    prisma.sleep.findFirst({
      where: { userId, deleteAt: 0 },
      orderBy: { date: 'desc' }
    }),
    prisma.exercise.findMany({
      where: {
        userId,
        deleteAt: 0,
        date: { gte: today, lt: tomorrow }
      }
    }),
    prisma.diet.findMany({
      where: {
        userId,
        deleteAt: 0,
        date: { gte: today, lt: tomorrow }
      }
    })
  ])

  return {
    latestWeight,
    latestSleep,
    todayExercises,
    todayDiets
  }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const t = await getTranslations('dashboard')
  const { latestWeight, latestSleep, todayExercises, todayDiets } = await getTodayData(session.user.id)

  const totalExerciseDuration = todayExercises.reduce((sum, e) => sum + e.duration, 0)
  const totalCalories = todayDiets.reduce((sum, d) => sum + (d.calories || 0), 0)

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('title')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="sm">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{t('latestWeight')}</dt>
            <dd className="text-lg font-medium text-gray-900">
              {latestWeight ? `${latestWeight.weight} kg` : t('noData')}
            </dd>
            {latestWeight?.bodyFat && (
              <dd className="text-sm text-gray-500">BF: {latestWeight.bodyFat}%</dd>
            )}
          </dl>
        </Card>

        <Card padding="sm">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{t('lastSleep')}</dt>
            <dd className="text-lg font-medium text-gray-900">
              {latestSleep ? `${latestSleep.duration}h` : t('noData')}
            </dd>
            {latestSleep && (
              <dd className="text-sm text-gray-500">{t('qualityLabel') || 'Quality'}: {latestSleep.quality}/10</dd>
            )}
          </dl>
        </Card>

        <Card padding="sm">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{t('todayExercise')}</dt>
            <dd className="text-lg font-medium text-gray-900">
              {todayExercises.length > 0 ? `${todayExercises.length} ${t('sessions')}` : t('noExercise')}
            </dd>
            <dd className="text-sm text-gray-500">{totalExerciseDuration} {t('minTotal')}</dd>
          </dl>
        </Card>

        <Card padding="sm">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{t('todayCalories')}</dt>
            <dd className="text-lg font-medium text-gray-900">
              {totalCalories > 0 ? `${totalCalories} kcal` : t('noData')}
            </dd>
            <dd className="text-sm text-gray-500">{todayDiets.length} {t('meals')}</dd>
          </dl>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('quickActions')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/dashboard/weight" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-sm font-medium">{t('logWeight')}</div>
            </Link>
            <Link href="/dashboard/exercise" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-sm font-medium">{t('logExercise')}</div>
            </Link>
            <Link href="/dashboard/diet" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-sm font-medium">{t('logMeal')}</div>
            </Link>
            <Link href="/dashboard/sleep" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-sm font-medium">{t('logSleep')}</div>
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('recentActivity')}</h2>
          <div className="text-sm text-gray-500">
            <Link href="/dashboard/timeline" className="text-emerald-600 hover:text-emerald-900">
              {t('viewAll')}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
