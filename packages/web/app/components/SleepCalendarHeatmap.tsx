'use client'

import ReactECharts from 'react-echarts-library'
import { useTranslations } from 'next-intl'
import Card from '@/app/components/Card'

interface DailyScore {
  date: string
  wakeTime: string
  wakeHours: number
}

interface ConsistencyData {
  year: number
  month: number
  weekdayAvg: string | null
  weekendAvg: string | null
  weekdayCount: number
  weekendCount: number
  consistencyScore: number | null
  dailyScores: DailyScore[]
}

interface Props {
  data: ConsistencyData
  year: number
  month: number
  onMonthChange: (year: number, month: number) => void
}

export default function SleepCalendarHeatmap({ data, year, month, onMonthChange }: Props) {
  const t = useTranslations('sleep')

  // 当月天数
  const daysInMonth = new Date(year, month, 0).getDate()

  // 计算工作日平均起床时间（作为基准）
  const weekdayAvg = data.weekdayAvg
    ? data.weekdayAvg.split(':').map(Number).reduce((h, m) => h + m / 60)
    : null

  // 构建热力图数据
  const scoreMap = new Map(data.dailyScores.map(d => [d.date, d]))

  const heatmapData: [number, number, number][] = []

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayData = scoreMap.get(dateStr)
    const dayOfWeek = new Date(year, month - 1, day).getDay()

    // 计算偏差分钟数
    let deviation = -1  // -1 表示无数据
    if (dayData && weekdayAvg !== null) {
      deviation = Math.abs(dayData.wakeHours - weekdayAvg) * 60  // 转为分钟
    }

    // 计算颜色值：0=深绿, 1=浅绿, 2=白, 3=浅红, 4=深红, -1=灰
    let colorValue: number
    if (deviation < 0) {
      colorValue = -1  // 无数据
    } else if (deviation <= 15) {
      colorValue = 0   // 深绿
    } else if (deviation <= 30) {
      colorValue = 1   // 浅绿
    } else if (deviation <= 60) {
      colorValue = 2   // 白色
    } else if (deviation <= 90) {
      colorValue = 3   // 浅红
    } else {
      colorValue = 4   // 深红
    }

    heatmapData.push([day, dayOfWeek, colorValue])
  }

  // ECharts 配置
  const option: import('echarts').EChartsOption = {
    tooltip: {
      formatter: (params: any) => {
        const day = params.value[0]
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const dayData = scoreMap.get(dateStr)
        const dayOfWeek = new Date(year, month - 1, day).getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        if (!dayData) {
          return `${month}月${day}日${isWeekend ? '（周末）' : ''}<br/>无数据`
        }
        const deviation = weekdayAvg !== null
          ? Math.round(Math.abs(dayData.wakeHours - weekdayAvg) * 60)
          : 0
        return `${month}月${day}日${isWeekend ? '（周末）' : ''}<br/>起床: ${dayData.wakeTime}<br/>偏差: ${deviation}分钟`
      }
    },
    grid: { top: 10, right: 20, bottom: 10, left: 30 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      splitArea: { show: true },
      axisLabel: { fontSize: 10 }
    },
    yAxis: {
      type: 'category',
      data: ['日', '一', '二', '三', '四', '五', '六'],
      splitArea: { show: true }
    },
    visualMap: {
      min: -1,
      max: 4,
      categories: ['无数据', '深绿', '浅绿', '白色', '浅红', '深红'],
      inRange: {
        color: ['#e5e7eb', '#22c55e', '#86efac', '#ffffff', '#fca5a5', '#ef4444']
      },
      show: false
    },
    series: [{
      type: 'heatmap',
      data: heatmapData,
      label: {
        show: true,
        formatter: (params: any) => {
          const day = params.value[0]
          return String(day)
        },
        fontSize: 10
      },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' }
      }
    }]
  }

  // 月份导航
  const prevMonth = () => {
    if (month === 1) {
      onMonthChange(year - 1, 12)
    } else {
      onMonthChange(year, month - 1)
    }
  }
  const nextMonth = () => {
    if (month === 12) {
      onMonthChange(year + 1, 1)
    } else {
      onMonthChange(year, month + 1)
    }
  }

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="px-3 py-1 border rounded hover:bg-gray-50">◀</button>
        <h3 className="text-lg font-semibold">{year}年{month}月</h3>
        <button onClick={nextMonth} className="px-3 py-1 border rounded hover:bg-gray-50">▶</button>
      </div>
      <ReactECharts option={option} style={{ height: 300 }} />

      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
        <span className="text-gray-500">{t('legend')}:</span>
        <span className="inline-block w-3 h-3 bg-green-600 rounded" />
        <span>{t('legendDeepGreen')}</span>
        <span className="inline-block w-3 h-3 bg-green-300 rounded" />
        <span>{t('legendLightGreen')}</span>
        <span className="inline-block w-3 h-3 bg-white border rounded" />
        <span>{t('legendWhite')}</span>
        <span className="inline-block w-3 h-3 bg-red-300 rounded" />
        <span>{t('legendLightRed')}</span>
        <span className="inline-block w-3 h-3 bg-red-500 rounded" />
        <span>{t('legendDeepRed')}</span>
        <span className="inline-block w-3 h-3 bg-gray-200 rounded" />
        <span>{t('legendNoData')}</span>
      </div>
    </Card>
  )
}
