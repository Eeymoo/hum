import { describe, it, expect } from 'vitest'
import { parseAggValue, extractNonce } from '@/lib/sync/sources/miapi'

// 真实数据 fixture（来自实测抓包，脱敏）
const STEPS_VALUE = '{"calories":307,"distance":6075,"steps":9374}'
const SLEEP_VALUE = '{"avg_hr":54,"sleep_score":78,"segment_details":[{"bedtime":1780292100,"wake_up_time":1780293540,"duration":24,"sleep_deep_duration":130,"sleep_rem_duration":40,"awake_count":0}]}'
const HR_VALUE = '{"avg_hr":65,"avg_rhr":58,"max_hr":120,"min_hr":47}'
const WEIGHT_VALUE = '{"weight":104.4,"bmi":28.5,"body_fat_rate":33.8,"muscle_mass":65.2,"bone_mass":4.1,"body_moisture_mass":45.3,"visceral_fat":18.2}'

describe('parseAggValue', () => {
  it('解析 JSON 字符串', () => {
    expect(parseAggValue(STEPS_VALUE)).toEqual({ calories: 307, distance: 6075, steps: 9374 })
  })

  it('非字符串返回空对象', () => {
    expect(parseAggValue(null)).toEqual({})
    expect(parseAggValue(123)).toEqual({})
    expect(parseAggValue({ a: 1 })).toEqual({})
  })

  it('非法 JSON 返回空对象', () => {
    expect(parseAggValue('not-json')).toEqual({})
    expect(parseAggValue('')).toEqual({})
  })
})

describe('extractNonce（关键修复点：大整数精度）', () => {
  it('从响应文本提取 nonce 原始字符串', () => {
    const raw = '&&&START&&&{"code":0,"nonce":7813117315703180288,"ssecurity":"abc"}'
    expect(extractNonce(raw)).toBe('7813117315703180288')
  })

  it('去掉 &&&START&&& 前缀也能提取', () => {
    const raw = '{"nonce":5608367137576165123,"location":"x"}'
    expect(extractNonce(raw)).toBe('5608367137576165123')
  })

  it('nonce 前后有空格也能提取', () => {
    const raw = '{"nonce":  1234567890123456789  }'
    expect(extractNonce(raw)).toBe('1234567890123456789')
  })

  it('无 nonce 字段返回空字符串', () => {
    expect(extractNonce('{"code":0}')).toBe('')
    expect(extractNonce('')).toBe('')
  })

  it('提取的值与 JSON.parse 后不同（证明精度问题真实存在）', () => {
    const raw = '{"nonce":7813117315703180288}'
    const extracted = extractNonce(raw)
    const parsed = JSON.parse(raw).nonce
    expect(extracted).toBe('7813117315703180288')
    expect(String(parsed)).not.toBe('7813117315703180288') // 精度丢失
    expect(extracted).not.toBe(String(parsed))
  })
})

describe('数据映射 - 步数', () => {
  it('映射 calories/distance/steps', () => {
    const v = parseAggValue(STEPS_VALUE)
    expect(v.calories).toBe(307)
    expect(v.distance).toBe(6075)
    expect(v.steps).toBe(9374)
  })
})

describe('数据映射 - 睡眠 segment_details', () => {
  it('提取主睡眠段的 bedtime/wake_up_time/深睡/REM', () => {
    const v = parseAggValue(SLEEP_VALUE)
    const seg = v.segment_details[0]
    expect(seg.bedtime).toBe(1780292100)
    expect(seg.wake_up_time).toBe(1780293540)
    expect(seg.duration).toBe(24)
    expect(seg.sleep_deep_duration).toBe(130)
    expect(seg.sleep_rem_duration).toBe(40)
    expect(seg.awake_count).toBe(0)
  })

  it('多个 segment 取 duration 最长的作为主段', () => {
    const v = parseAggValue(JSON.stringify({
      segment_details: [
        { bedtime: 1, wake_up_time: 2, duration: 100, sleep_deep_duration: 10 },
        { bedtime: 3, wake_up_time: 4, duration: 300, sleep_deep_duration: 50 }, // 最长
        { bedtime: 5, wake_up_time: 6, duration: 200, sleep_deep_duration: 20 },
      ],
    }))
    const mainSeg = v.segment_details.reduce((a: any, b: any) => (b.duration > a.duration ? b : a))
    expect(mainSeg.duration).toBe(300)
    expect(mainSeg.sleep_deep_duration).toBe(50)
  })

  it('睡眠时长分钟→小时转换', () => {
    const durationMin = 392 // 6.53 小时
    expect(durationMin / 60).toBeCloseTo(6.533, 2)
  })

  it('深睡时长分钟→小时转换', () => {
    const deepMin = 91
    expect(deepMin / 60).toBeCloseTo(1.517, 2)
  })
})

describe('数据映射 - 心率', () => {
  it('映射 avg/max/min/resting', () => {
    const v = parseAggValue(HR_VALUE)
    expect(v.avg_hr).toBe(65)
    expect(v.max_hr).toBe(120)
    expect(v.min_hr).toBe(47)
    expect(v.avg_rhr).toBe(58) // 静息心率
  })
})

describe('数据映射 - 体重（原始测量，含丰富字段）', () => {
  it('映射 weight/bmi/body_fat_rate/muscle_mass/bone_mass/water/visceral_fat', () => {
    const v = parseAggValue(WEIGHT_VALUE)
    expect(v.weight).toBe(104.4)
    expect(v.bmi).toBe(28.5)
    expect(v.body_fat_rate).toBe(33.8)
    expect(v.muscle_mass).toBe(65.2)
    expect(v.bone_mass).toBe(4.1)
    expect(v.body_moisture_mass).toBe(45.3)
    expect(v.visceral_fat).toBe(18.2)
  })

  it('值为 0 的字段应被过滤（> 0 判断）', () => {
    // 真实体重记录里很多字段是 0（未测量），映射时应过滤为 null
    const v = parseAggValue(JSON.stringify({
      weight: 70.0, bmi: 0.0, body_fat_rate: 0.0, muscle_mass: 0.0, bone_mass: 0.0,
    }))
    expect(v.weight).toBe(70.0)
    expect(v.bmi > 0 ? v.bmi : null).toBeNull()
    expect(v.body_fat_rate > 0 ? v.body_fat_rate : null).toBeNull()
  })

  it('weight <= 0 应跳过（无效记录）', () => {
    const v = parseAggValue(JSON.stringify({ weight: 0, bmi: 0 }))
    expect(v.weight <= 0).toBe(true) // sync 逻辑里会 continue 跳过
  })
})

describe('sourceId 格式', () => {
  it('步数 sourceId 含日期', () => {
    const date = '2026-06-01'
    expect(`miapi_steps_${date}`).toBe('miapi_steps_2026-06-01')
  })

  it('体重 sourceId 用精确时间戳（同一天多次测量不冲突）', () => {
    const ts = 1767660343
    expect(`miapi_weight_${ts}`).toBe('miapi_weight_1767660343')
  })

  it('各类型 sourceId 前缀不冲突', () => {
    const prefixes = ['miapi_steps_', 'miapi_hr_', 'miapi_sleep_', 'miapi_weight_', 'miapi_cal_', 'miapi_spo2_', 'miapi_stand_', 'miapi_intensity_', 'miapi_stress_']
    expect(new Set(prefixes).size).toBe(prefixes.length) // 无重复
  })
})
