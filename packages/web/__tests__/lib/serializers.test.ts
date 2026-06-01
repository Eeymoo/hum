import { describe, it, expect } from 'vitest'
import { deserializeDiet, deserializeExercise, deserializeSleep, deserializeWeight } from '@/lib/serializers'

describe('deserializeDiet', () => {
  it('应正确解析 foods 和 extraData', () => {
    const diet = {
      id: '1',
      foods: JSON.stringify([{ name: 'Rice', amount: '200g' }]),
      extraData: JSON.stringify({ source: 'app' }),
      attachments: JSON.stringify(['file1.jpg']),
    } as any

    const result = deserializeDiet(diet)
    expect(result.foods).toEqual([{ name: 'Rice', amount: '200g' }])
    expect(result.extraData).toEqual({ source: 'app' })
    expect(result.attachments).toEqual(['file1.jpg'])
  })

  it('空字段应返回默认值', () => {
    const diet = { id: '1', foods: null, extraData: null, attachments: null } as any
    const result = deserializeDiet(diet)
    expect(result.foods).toEqual([])
    expect(result.extraData).toBeNull()
    expect(result.attachments).toEqual([])
  })
})

describe('deserializeExercise', () => {
  it('应正确解析 activities 和 extraData', () => {
    const exercise = {
      id: '1',
      activities: JSON.stringify([{ name: 'Run', duration: 30 }]),
      extraData: JSON.stringify({ location: 'park' }),
      attachments: JSON.stringify(['file1.jpg']),
    } as any

    const result = deserializeExercise(exercise)
    expect(result.activities).toEqual([{ name: 'Run', duration: 30 }])
    expect(result.extraData).toEqual({ location: 'park' })
    expect(result.attachments).toEqual(['file1.jpg'])
  })
})

describe('deserializeSleep', () => {
  it('应正确解析 extraData', () => {
    const sleep = {
      id: '1',
      extraData: JSON.stringify({ device: 'watch' }),
      attachments: JSON.stringify(['file1.jpg']),
    } as any

    const result = deserializeSleep(sleep)
    expect(result.extraData).toEqual({ device: 'watch' })
    expect(result.attachments).toEqual(['file1.jpg'])
  })
})

describe('deserializeWeight', () => {
  it('应正确解析 attachments 和 extraData', () => {
    const weight = {
      id: '1',
      attachments: JSON.stringify(['file1.jpg']),
      extraData: JSON.stringify({ scale: 'smart' }),
    } as any

    const result = deserializeWeight(weight)
    expect(result.attachments).toEqual(['file1.jpg'])
    expect(result.extraData).toEqual({ scale: 'smart' })
  })
})
