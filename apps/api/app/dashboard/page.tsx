import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'

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

  const { latestWeight, latestSleep, todayExercises, todayDiets } = await getTodayData(session.user.id)

  const totalExerciseDuration = todayExercises.reduce((sum, e) => sum + e.duration, 0)
  const totalCalories = todayDiets.reduce((sum, d) => sum + (d.calories || 0), 0)

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">⚖️</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Latest Weight</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {latestWeight ? `${latestWeight.weight} kg` : 'No data'}
                  </dd>
                  {latestWeight?.bodyFat && (
                    <dd className="text-sm text-gray-500">BF: {latestWeight.bodyFat}%</dd>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">😴</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Last Sleep</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {latestSleep ? `${latestSleep.duration}h` : 'No data'}
                  </dd>
                  {latestSleep && (
                    <dd className="text-sm text-gray-500">Quality: {latestSleep.quality}/10</dd>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">🏃</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Today Exercise</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {todayExercises.length > 0 ? `${todayExercises.length} sessions` : 'No exercise'}
                  </dd>
                  <dd className="text-sm text-gray-500">{totalExerciseDuration} min total</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">🍽️</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Today Calories</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {totalCalories > 0 ? `${totalCalories} kcal` : 'No data'}
                  </dd>
                  <dd className="text-sm text-gray-500">{todayDiets.length} meals</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <a href="/dashboard/weight" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-xl mb-2">⚖️</div>
              <div className="text-sm font-medium">Log Weight</div>
            </a>
            <a href="/dashboard/exercise" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-xl mb-2">🏃</div>
              <div className="text-sm font-medium">Log Exercise</div>
            </a>
            <a href="/dashboard/diet" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-xl mb-2">🍽️</div>
              <div className="text-sm font-medium">Log Meal</div>
            </a>
            <a href="/dashboard/sleep" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-xl mb-2">😴</div>
              <div className="text-sm font-medium">Log Sleep</div>
            </a>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
          <div className="text-sm text-gray-500">
            <a href="/dashboard/timeline" className="text-indigo-600 hover:text-indigo-900">
              View all activity →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
