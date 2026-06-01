import { describe, it, expect } from 'vitest'
import { parseDateRange, parseActivities, parseFoods } from '@/lib/utils'

describe('parseDateRange', () => {
  it('last=7d 应返回不含今天的前 7 天', () => {
    const { startDate, endDate } = parseDateRange('7d')
    expect(startDate).toBeDefined()
    expect(endDate).toBeDefined()
    // endDate 应为今天 00:00:00
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    expect(endDate!.getTime()).toBe(now.getTime())
    // startDate 应为 7 天前
    const expectedStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    expect(startDate!.getTime()).toBe(expectedStart.getTime())
  })

  it('last=30d 应返回不含今天的前 30 天', () => {
    const { startDate, endDate } = parseDateRange('30d')
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    expect(endDate!.getTime()).toBe(now.getTime())
    const expectedStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    expect(startDate!.getTime()).toBe(expectedStart.getTime())
  })

  it('start+end 自定义范围', () => {
    const { startDate, endDate } = parseDateRange(null, '2024-01-01', '2024-01-31')
    // parseDateRange 会设置 startDate 为 00:00:00，endDate 为 23:59:59.999
    expect(startDate).toBeDefined()
    expect(endDate).toBeDefined()
    expect(startDate!.getHours()).toBe(0)
    expect(startDate!.getMinutes()).toBe(0)
    expect(startDate!.getSeconds()).toBe(0)
    expect(endDate!.getHours()).toBe(23)
    expect(endDate!.getMinutes()).toBe(59)
    expect(endDate!.getSeconds()).toBe(59)
  })

  it('无参数返回 undefined', () => {
    const { startDate, endDate } = parseDateRange()
    expect(startDate).toBeUndefined()
    expect(endDate).toBeUndefined()
  })
})

describe('parseActivities', () => {
  it('应正确解析活动字符串', () => {
    const result = parseActivities('Jogging:duration=30,distance=5km')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'Jogging',
      duration: 30,
      distance: 5  // parseActivities 会尝试将数值字符串转为数字
    })
  })

  it('空字符串返回空数组', () => {
    expect(parseActivities('')).toEqual([])
    expect(parseActivities(null)).toEqual([])
  })
})

describe('parseFoods', () => {
  it('应正确解析食物字符串', () => {
    const result = parseFoods('Rice:200g,Chicken:150g')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'Rice', amount: '200g' })
    expect(result[1]).toEqual({ name: 'Chicken', amount: '150g' })
  })

  it('空字符串返回空数组', () => {
    expect(parseFoods('')).toEqual([])
    expect(parseFoods(null)).toEqual([])
  })
})
