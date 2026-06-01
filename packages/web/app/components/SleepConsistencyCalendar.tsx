'use client'

import SleepCalendarHeatmap from './SleepCalendarHeatmap'

export default function SleepConsistencyCalendar() {
  return <SleepCalendarHeatmap year={new Date().getFullYear()} />
}
