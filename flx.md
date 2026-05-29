# Stats 逻辑问题与修复方案

## 一、核心问题：时间范围计算错误

### 涉及文件

- `apps/api/lib/utils.ts` — `parseDateRange()` 函数

### 当前行为

```typescript
case 'd':
  startDate = new Date(now.getTime() - n * 24 * 60 * 60 * 1000)
  break
// endDate 未设置（undefined），即无上界，查到当前时刻
```

- `1d` → `now - 1天` ~ `now`（包含今天）
- `7d` → `now - 7天` ~ `now`（包含今天）
- `30d` → `now - 30天` ~ `now`（包含今天）

### 期望行为

| 选择 | 期望范围 | 含义 |
|------|---------|------|
| `1d` | T-2 ~ T-1 | 昨天往前 1 天（不含今天） |
| `7d` | T-8 ~ T-1 | 昨天往前 7 天（不含今天） |
| `30d` | T-31 ~ T-1 | 昨天往前 30 天（不含今天） |
| `90d` | T-91 ~ T-1 | 昨天往前 90 天（不含今天） |

> T = 今天，T-1 = 昨天，以此类推。

### 修复方案

```typescript
export function parseDateRange(last?: string | null, start?: string | null, end?: string | null) {
  let startDate: Date | undefined
  let endDate: Date | undefined

  if (last) {
    // endDate 统一设为昨天 23:59:59（排除今天）
    endDate = new Date()
    endDate.setHours(0, 0, 0, 0) // 今天 00:00:00
    // 作为上界，用 < 即可，所以 endDate 指向今天 00:00 等价于"到昨天为止"

    const match = last.match(/^(\d+)(d|w|m|y)$/)
    if (match) {
      const [, num, unit] = match
      const n = parseInt(num, 10)
      switch (unit) {
        case 'd':
          startDate = new Date(endDate.getTime() - n * 24 * 60 * 60 * 1000)
          break
        case 'w':
          startDate = new Date(endDate.getTime() - n * 7 * 24 * 60 * 60 * 1000)
          break
        case 'm':
          startDate = new Date(endDate)
          startDate.setMonth(startDate.getMonth() - n)
          break
        case 'y':
          startDate = new Date(endDate)
          startDate.setFullYear(startDate.getFullYear() - n)
          break
      }
    } else {
      const num = parseInt(last, 10)
      if (!isNaN(num)) {
        startDate = new Date(endDate.getTime() - num * 24 * 60 * 60 * 1000)
      }
    }
  }

  if (start) {
    startDate = new Date(start)
    startDate.setHours(0, 0, 0, 0)
  }
  if (end) {
    endDate = new Date(end)
    endDate.setHours(23, 59, 59, 999)
  }

  return { startDate, endDate }
}
```

**关键变更**：
1. `last` 模式下，`endDate` 设为今天 00:00:00（配合 `lte` 查询即为昨天及之前）
2. `startDate` 基于 `endDate`（而非 `now`）往前推，确保范围是 T-(n+1) ~ T-1
3. `start`/`end` 自定义模式不受影响

---

## 二、Stats 聚合逻辑错误：按记录平均 vs 按天平均

### 问题描述

当前所有 stats 端点的平均值（avg）都是 **按记录条数** 计算的，而非 **按天数** 计算。

例如饮食：如果 T-1 有 3 条记录（早/午/晚），当前逻辑是 `avgCalories = 3条热量之和 / 3`，这实际上还是一条记录的平均。正确的「日均热量」应该是 `每天总热量之和 / 天数`。

### 涉及文件与指标

| 文件 | 指标 | 当前逻辑 | 正确逻辑 |
|------|------|---------|---------|
| `diets/stats` | avgCalories | `totalCalories / caloriesCount`（按记录） | 先按天汇总每天总热量，再 `sum / 天数` |
| `diets/stats` | avgProtein | `totalProtein / proteinCount` | 同上，按天汇总再求平均 |
| `diets/stats` | avgCarbs | `totalCarbs / carbsCount` | 同上 |
| `diets/stats` | avgFat | `totalFat / fatCount` | 同上 |
| `diets/stats` | totalWater | 直接求和 | ✅ 无需改（总量求和合理） |
| `exercises/stats` | avgDuration | `totalDuration / exercises.length` | 先按天汇总每天总时长，再 `sum / 天数` |
| `exercises/stats` | avgCalories | `totalCalories / caloriesCount` | 先按天汇总每天总消耗，再 `sum / 天数` |
| `sleeps/stats` | avgDuration | `totalDuration / count` | 先按天汇总每天总睡眠，再 `sum / 天数` |
| `sleeps/stats` | avgQuality | `totalQuality / count` | 先按天汇总每天质量，再 `sum / 天数` |
| `sleeps/stats` | avgDeepSleep | `totalDeepSleep / deepSleepCount` | 同上 |
| `weights/stats` | avgWeight | 所有记录平均 | ✅ 体重一般一天一次，可不改 |

---

## 三、各模块修复方案

### 3.1 Diet Stats 修复

**文件**：`apps/api/app/api/v1/diets/stats/route.ts`

**修复思路**：按日期分组汇总，再求日均值。

```typescript
// 1. 按日期分组
const dailyMap = new Map<string, {
  calories: number; protein: number; carbs: number; fat: number; water: number
  caloriesCount: number; proteinCount: number; carbsCount: number; fatCount: number
}>()

diets.forEach(d => {
  const dateKey = d.date.toISOString().split('T')[0]
  const day = dailyMap.get(dateKey) || {
    calories: 0, protein: 0, carbs: 0, fat: 0, water: 0,
    caloriesCount: 0, proteinCount: 0, carbsCount: 0, fatCount: 0
  }
  if (d.calories !== null) { day.calories += d.calories; day.caloriesCount++ }
  if (d.protein !== null) { day.protein += d.protein; day.proteinCount++ }
  if (d.carbs !== null) { day.carbs += d.carbs; day.carbsCount++ }
  if (d.fat !== null) { day.fat += d.fat; day.fatCount++ }
  if (d.water !== null) day.water += d.water
  dailyMap.set(dateKey, day)
})

// 2. 按天求平均
const days = Array.from(dailyMap.values())
const dayCount = days.length

return NextResponse.json({
  avgCalories: dayCount > 0
    ? Math.round(days.reduce((s, d) => s + d.calories, 0) / dayCount)
    : null,
  avgProtein: dayCount > 0
    ? Math.round(days.reduce((s, d) => s + d.protein, 0) / dayCount * 10) / 10
    : null,
  avgCarbs: dayCount > 0
    ? Math.round(days.reduce((s, d) => s + d.carbs, 0) / dayCount * 10) / 10
    : null,
  avgFat: dayCount > 0
    ? Math.round(days.reduce((s, d) => s + d.fat, 0) / dayCount * 10) / 10
    : null,
  totalWater: totalWater > 0 ? totalWater : null,
  count: dayCount  // 改为返回天数而非记录数
})
```

> **注意**：前端 `DietPage` 中的 `stats.count` 展示也会受到影响，从"记录数"变为"天数"。如果前端需要同时展示记录数和天数，需要额外返回字段。

---

### 3.2 Exercise Stats 修复

**文件**：`apps/api/app/api/v1/exercises/stats/route.ts`

**修复思路**：同上，按日期分组汇总。

```typescript
const dailyMap = new Map<string, { duration: number; calories: number; caloriesCount: number }>()

exercises.forEach(ex => {
  const dateKey = ex.date.toISOString().split('T')[0]
  const day = dailyMap.get(dateKey) || { duration: 0, calories: 0, caloriesCount: 0 }
  day.duration += ex.duration
  if (ex.caloriesBurned) { day.calories += ex.caloriesBurned; day.caloriesCount++ }
  dailyMap.set(dateKey, day)
})

// frequencyByType 仍按记录数统计（这个语义本身就是"次数"）
const frequencyByType: Record<string, number> = {}
exercises.forEach(ex => {
  frequencyByType[ex.type] = (frequencyByType[ex.type] || 0) + 1
})

const days = Array.from(dailyMap.values())
const dayCount = days.length

return NextResponse.json({
  totalDuration,       // 总时长不变
  totalCalories,       // 总消耗不变
  avgDuration: dayCount > 0
    ? Math.round(days.reduce((s, d) => s + d.duration, 0) / dayCount)
    : null,
  avgCalories: dayCount > 0
    ? Math.round(days.reduce((s, d) => s + d.calories, 0) / dayCount)
    : null,
  frequencyByType,
  count: exercises.length  // 保留记录数（运动次数语义合理）
})
```

---

### 3.3 Sleep Stats 修复

**文件**：`apps/api/app/api/v1/sleeps/stats/route.ts`

**修复思路**：同上，按日期分组汇总。

```typescript
const dailyMap = new Map<string, { duration: number; quality: number; deepSleep: number; deepSleepCount: number; count: number }>()

sleeps.forEach(s => {
  const dateKey = s.date.toISOString().split('T')[0]
  const day = dailyMap.get(dateKey) || { duration: 0, quality: 0, deepSleep: 0, deepSleepCount: 0, count: 0 }
  day.duration += s.duration
  day.quality += s.quality
  if (s.deepSleep !== null) { day.deepSleep += s.deepSleep; day.deepSleepCount++ }
  day.count++
  dailyMap.set(dateKey, day
})

const days = Array.from(dailyMap.values())
const dayCount = days.length

return NextResponse.json({
  avgDuration: dayCount > 0
    ? Math.round(days.reduce((s, d) => s + d.duration, 0) / dayCount * 10) / 10
    : null,
  avgQuality: dayCount > 0
    ? Math.round(days.reduce((s, d) => s + d.quality / d.count, 0) / dayCount * 10) / 10
    : null,
  avgDeepSleep: dayCount > 0
    ? Math.round(days.reduce((s, d) => s + d.deepSleep, 0) / dayCount * 10) / 10
    : null,
  count: dayCount  // 改为天数
})
```

> **注意**：睡眠质量（quality）每天可能有多条，应先求当天平均质量，再求多天平均。

---

### 3.4 Weight Stats — 无需修改

`avgWeight`、`minWeight`、`maxWeight`、`change` 逻辑正确。体重一般一天只记录一次，按记录平均与按天平均等价。仅受 `parseDateRange` 时间范围修正的影响。

---

## 四、影响范围总结

| 修改项 | 影响的 API 端点 | 影响的前端页面 |
|-------|---------------|--------------|
| `parseDateRange` 时间范围修正 | 所有使用 `last` 参数的端点 | 所有使用 TimeRangeSelector 的页面（diet/exercise/weight/sleep/timeline/records） |
| Diet Stats 按天聚合 | `GET /api/v1/diets/stats` | `app/dashboard/diet/page.tsx` |
| Exercise Stats 按天聚合 | `GET /api/v1/exercises/stats` | `app/dashboard/exercise/page.tsx` |
| Sleep Stats 按天聚合 | `GET /api/v1/sleeps/stats` | `app/dashboard/sleep/page.tsx` |

---

## 五、前端是否需要同步修改？

前端仅消费 stats 接口返回的数据并展示，字段名未发生变化，因此 **前端无需修改**。

唯一需要注意的是 `count` 字段语义变化：
- Diet Stats：从「记录数」变为「天数」
- Sleep Stats：从「记录数」变为「天数」
- Exercise Stats：保留「记录数」（运动次数语义合理）

如果前端页面中有用到 `stats.count` 展示为"记录数"的地方，需要确认展示文案是否需要调整为"天数"。

---

## 六、修改优先级

1. **P0** — `parseDateRange` 时间范围修正（影响所有 stats）
2. **P1** — Diet Stats 按天聚合
3. **P1** — Exercise Stats 按天聚合
4. **P1** — Sleep Stats 按天聚合
