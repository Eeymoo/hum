import Table from 'cli-table3'
import { encode } from '@toon-format/toon'
import { formatDate, getConfigDateFormat } from './timezone.js'

function outputJson(data) {
  console.log(JSON.stringify(data, null, 2))
}

function outputTable(headers, rows) {
  const table = new Table({
    head: headers,
    style: { head: ['cyan'], border: ['gray'] }
  })
  for (const row of rows) {
    table.push(row)
  }
  console.log(table.toString())
}

function outputToon(data) {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    console.log('(无数据)')
    return
  }
  console.log(encode(data))
}

function formatPaginationHint(page, totalPages, total, format) {
  if (format !== 'table') return null
  if (totalPages <= 1) return null
  const nextPage = page + 1
  return `第 ${page} 页，共 ${totalPages} 页（共 ${total} 条）— 使用 --page ${nextPage} 查看下一页`
}

function extractItems(data, type) {
  const keyMap = {
    'weight-list': 'weights',
    'exercise-list': 'exercises',
    'diet-list': 'diets',
    'sleep-list': 'sleeps',
    'record-list': 'records',
    'food-list': 'foods',
    'timeline': 'items'
  }
  const key = keyMap[type]
  if (key && Array.isArray(data[key])) return data[key]
  if (Array.isArray(data)) return data
  return []
}

function buildRows(items, type) {
  const df = getConfigDateFormat()
  switch (type) {
    case 'weight-list':
      return items.map((item, idx) => [
        idx + 1,
        item.id,
        item.weight,
        item.bodyFat ?? '-',
        item.bmi ?? '-',
        item.date ? formatDate(item.date, df) : '-',
        item.note || '-'
      ])
    case 'exercise-list':
      return items.map((item, idx) => [
        idx + 1,
        item.id,
        item.type,
        item.duration,
        item.caloriesBurned ?? '-',
        item.heartRateAvg ?? '-',
        item.date ? formatDate(item.date, df) : '-'
      ])
    case 'diet-list':
      return items.map((item, idx) => [
        idx + 1,
        item.id,
        item.mealType,
        item.calories ?? '-',
        item.protein ?? '-',
        item.carbs ?? '-',
        item.fat ?? '-',
        item.date ? formatDate(item.date, df) : '-'
      ])
    case 'sleep-list':
      return items.map((item, idx) => [
        idx + 1,
        item.id,
        item.duration,
        item.quality,
        item.bedTime ?? '-',
        item.wakeTime ?? '-',
        item.deepSleep ?? '-',
        item.date ? formatDate(item.date, df) : '-'
      ])
    case 'record-list':
      return items.map((item, idx) => [
        idx + 1,
        item.id,
        item.type,
        (item.tags || []).join(', ') || '-',
        item.date ? formatDate(item.date, df) : '-',
        item.note || '-'
      ])
    case 'food-list':
      return items.map((item, idx) => [
        idx + 1,
        item.name,
        item.energyKcal ?? '-',
        item.protein ?? '-',
        item.carbs ?? '-',
        item.fat ?? '-'
      ])
    case 'timeline':
      return items.map((item, idx) => {
        let summary = ''
        if (item.type === 'weight') summary = `${item.data?.weight} kg`
        else if (item.type === 'exercise') summary = `${item.data?.duration} min ${item.data?.type || ''}`
        else if (item.type === 'diet') summary = `${item.data?.calories || 0} kcal (${item.data?.mealType || ''})`
        else if (item.type === 'sleep') summary = `${item.data?.duration}h, 质量: ${item.data?.quality}/10`
        else if (item.type === 'record') summary = item.data?.type || ''
        return [
          idx + 1,
          item.date ? formatDate(item.date, df) : '-',
          item.type,
          summary
        ]
      })
    default:
      return []
  }
}

function getHeaders(type) {
  switch (type) {
    case 'weight-list': return ['#', 'ID', '体重(kg)', '体脂(%)', 'BMI', '日期', '备注']
    case 'exercise-list': return ['#', 'ID', '类型', '时长(分)', '热量', '心率', '日期']
    case 'diet-list': return ['#', 'ID', '餐别', '热量', '蛋白质', '碳水', '脂肪', '日期']
    case 'sleep-list': return ['#', 'ID', '时长(h)', '质量', '入睡', '醒来', '深睡(h)', '日期']
    case 'record-list': return ['#', 'ID', '类型', '标签', '日期', '备注']
    case 'food-list': return ['#', '名称', '热量(kcal)', '蛋白质(g)', '碳水(g)', '脂肪(g)']
    case 'timeline': return ['#', '时间', '类型', '摘要']
    default: return []
  }
}

function outputStats(data, type, format) {
  if (format === 'json') {
    outputJson(data)
    return
  }
  if (format === 'toon') {
    outputToon(data)
    return
  }

  const rows = []
  switch (type) {
    case 'weight-stats':
      if (data.avgWeight !== undefined) rows.push(['平均体重', `${data.avgWeight} kg`])
      if (data.minWeight !== undefined) rows.push(['最低体重', `${data.minWeight} kg`])
      if (data.maxWeight !== undefined) rows.push(['最高体重', `${data.maxWeight} kg`])
      if (data.change !== undefined && data.change !== null) rows.push(['变化量', `${data.change > 0 ? '+' : ''}${data.change} kg`])
      break
    case 'exercise-stats':
      if (data.count !== undefined) rows.push(['总次数', data.count])
      if (data.totalDuration !== undefined) rows.push(['总时长', `${data.totalDuration} min`])
      if (data.avgDuration !== null) rows.push(['平均时长', `${data.avgDuration.toFixed(1)} min`])
      if (data.totalCalories !== undefined) rows.push(['总热量', `${data.totalCalories} kcal`])
      if (data.avgCalories !== null) rows.push(['平均热量', `${data.avgCalories.toFixed(0)} kcal`])
      if (data.frequencyByType) {
        for (const [t, c] of Object.entries(data.frequencyByType)) {
          rows.push([`频率 (${t})`, c])
        }
      }
      break
    case 'diet-stats':
      if (data.avgCalories !== undefined) rows.push(['平均热量', `${data.avgCalories?.toFixed?.(0) || data.avgCalories} kcal`])
      if (data.avgProtein !== undefined) rows.push(['平均蛋白质', `${data.avgProtein?.toFixed?.(1) || data.avgProtein}g`])
      if (data.avgCarbs !== undefined) rows.push(['平均碳水', `${data.avgCarbs?.toFixed?.(1) || data.avgCarbs}g`])
      if (data.avgFat !== undefined) rows.push(['平均脂肪', `${data.avgFat?.toFixed?.(1) || data.avgFat}g`])
      if (data.totalWater !== undefined && data.totalWater !== null) rows.push(['总饮水量', `${data.totalWater}ml`])
      if (data.count !== undefined) rows.push(['记录数', data.count])
      break
    case 'sleep-stats':
      if (data.avgDuration !== undefined) rows.push(['平均时长', `${data.avgDuration?.toFixed?.(1) || data.avgDuration}h`])
      if (data.avgQuality !== undefined) rows.push(['平均质量', `${data.avgQuality?.toFixed?.(1) || data.avgQuality}/10`])
      if (data.avgDeepSleep !== undefined) rows.push(['平均深睡', `${data.avgDeepSleep?.toFixed?.(1) || data.avgDeepSleep}h`])
      if (data.count !== undefined) rows.push(['记录数', data.count])
      break
    default:
      rows.push(...Object.entries(data).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v]))
  }
  outputTable(['指标', '数值'], rows)
}

function outputGet(data, type, format) {
  if (format === 'json') {
    outputJson(data)
    return
  }
  if (format === 'toon') {
    outputToon(data)
    return
  }

  const df = getConfigDateFormat()
  const rows = Object.entries(data).map(([k, v]) => {
    let val = v
    if (k === 'date' && v) val = formatDate(v, df)
    else if (typeof v === 'object' && v !== null) val = JSON.stringify(v)
    return [k, val]
  })
  outputTable(['字段', '值'], rows)
}

export function outputData(data, options = {}) {
  const { format = 'json', type, page = 1 } = options

  if (type && type.endsWith('-stats')) {
    outputStats(data, type, format)
    return
  }

  if (type && type.endsWith('-get')) {
    outputGet(data, type, format)
    return
  }

  if (format === 'toon') {
    outputToon(data)
    return
  }

  const items = extractItems(data, type)
  const headers = getHeaders(type)
  const rows = buildRows(items, type)

  if (format === 'json') {
    outputJson(data)
    return
  }

  if (format === 'table') {
    if (rows.length > 0) {
      outputTable(headers, rows)
    } else {
      console.log('(无数据)')
    }
    const hint = formatPaginationHint(page, data.totalPages, data.total, 'table')
    if (hint) console.log('\n' + hint)
    return
  }

  // fallback
  outputJson(data)
}
