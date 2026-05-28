import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import config from './config.js'

dayjs.extend(utc)
dayjs.extend(timezone)

export function getConfigTimezone() {
  return config.get('timezone') || dayjs.tz.guess() || 'UTC'
}

export function getConfigDateFormat() {
  return config.get('dateFormat') || 'YYYY-MM-DD HH:mm'
}

export function formatDate(date, format) {
  const tz = getConfigTimezone()
  const fmt = format || getConfigDateFormat()
  return dayjs(date).tz(tz).format(fmt)
}

export function appendTimezoneOffset(dateStr) {
  if (!dateStr) return dateStr
  // Pure date like "2026-05-28" - no offset needed
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  // Already has timezone offset
  if (/[+-]\d{2}:\d{2}$/.test(dateStr) || /Z$/.test(dateStr)) {
    return dateStr
  }
  // Datetime without offset - append user's timezone
  const tz = getConfigTimezone()
  const offset = dayjs().tz(tz).format('Z')
  return `${dateStr}${offset}`
}

export function getDefaultLast() {
  return '7d'
}

export function getDefaultLimit() {
  return 20
}

export function buildQueryParams(options, defaults = {}) {
  const params = new URLSearchParams()

  const hasTimeFilter = options.last || options.start || options.end
  if (!hasTimeFilter && defaults.last !== false) {
    params.append('last', getDefaultLast())
  }

  if (options.last) params.append('last', options.last)
  if (options.start) params.append('start', options.start)
  if (options.end) params.append('end', options.end)

  const page = options.page || defaults.page || 1
  const limit = options.limit || defaults.limit || getDefaultLimit()
  params.append('page', String(page))
  params.append('limit', String(limit))

  if (options.includeDeleted) {
    params.append('includeDeleted', 'true')
  }

  // Pass through other known filter options
  const filterKeys = ['type', 'tag', 'meal', 'query']
  for (const key of filterKeys) {
    if (options[key]) {
      const paramKey = key === 'meal' ? 'mealType' : key === 'query' ? 'q' : key
      params.append(paramKey, options[key])
    }
  }

  return { params, page: parseInt(String(page), 10), limit: parseInt(String(limit), 10) }
}
