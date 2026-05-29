# Hum v0.1.16 最终计划

> **版本目标**：修复数据计算错误，建立拍照录入基础设施，零冗余 Schema 扩展。  
> **场景**：个人使用 + OpenClaw 拍照识别 + CLI 自动录入  
> **工期**：1 天  
> **API**：0.1.15 → 0.1.16 | **CLI**：0.1.6 → 0.1.16

---

## 一、必须修复（P0）

### B2: `parseDateRange` 同日查询返回 0 条

**问题**：`--start 2026-05-20 --end 2026-05-20` 解析为 `00:00:00` 到 `00:00:00`，匹配不到含时间部分的记录。

**修复**：`endDate` 设为当天 `23:59:59.999`。

```typescript
// apps/api/lib/utils.ts
if (end) {
  endDate = new Date(end)
  endDate.setHours(23, 59, 59, 999)
}
```

**影响**：所有模块的同日查询（weight/diet/exercise/sleep/record）。

---

### B1 + B3: Stats 均值计算错误

**原则**：`sum(非空值) / count(非空记录数)`

| 模块 | 修复内容 | 文件 |
|------|----------|------|
| Sleep | `avgDeepSleep` 只除以 `deepSleep !== null` 的记录数 | `apps/api/app/api/v1/sleeps/stats/route.ts` |
| Diet | 日均不按 `daysInRange` 算，按有数据的记录数算 | `apps/api/app/api/v1/diets/stats/route.ts` |
| Exercise | 新增 `avgDuration`、`avgCalories` | `apps/api/app/api/v1/exercises/stats/route.ts` |

**Sleep Stats 修复后逻辑**：

```typescript
let totalDuration = 0, totalQuality = 0, totalDeepSleep = 0
let count = 0, deepSleepCount = 0

sleeps.forEach(s => {
  totalDuration += s.duration
  totalQuality += s.quality
  if (s.deepSleep !== null) {
    totalDeepSleep += s.deepSleep
    deepSleepCount++
  }
  count++
})

return {
  avgDuration: count > 0 ? totalDuration / count : null,
  avgQuality: count > 0 ? totalQuality / count : null,
  avgDeepSleep: deepSleepCount > 0 ? totalDeepSleep / deepSleepCount : null,
  count
}
```

**Diet Stats 修复后逻辑**：

```typescript
let caloriesCount = 0, proteinCount = 0, carbsCount = 0, fatCount = 0

diets.forEach(d => {
  if (d.calories !== null) { totalCalories += d.calories; caloriesCount++ }
  if (d.protein !== null) { totalProtein += d.protein; proteinCount++ }
  if (d.carbs !== null) { totalCarbs += d.carbs; carbsCount++ }
  if (d.fat !== null) { totalFat += d.fat; fatCount++ }
  if (d.water !== null) totalWater += d.water
})

return {
  avgCalories: caloriesCount > 0 ? totalCalories / caloriesCount : null,
  avgProtein: proteinCount > 0 ? totalProtein / proteinCount : null,
  avgCarbs: carbsCount > 0 ? totalCarbs / carbsCount : null,
  avgFat: fatCount > 0 ? totalFat / fatCount : null,
  totalWater: totalWater > 0 ? totalWater : null,
  count: diets.length
}
```

> Dashboard `diet/page.tsx` 同步：`avgDailyCalories` → `avgCalories`，标签同步调整。

---

### F1: Sleep Add 自动计算 Duration

**问题**：AI 从手环截图提取 `bedtime`/`waketime` 后，还需心算 `duration`，易出错。

**修复**：`--duration` 降为可选，有 `bedtime` + `waketime` 时自动推导。

```javascript
// packages/cli/src/commands/sleep.js
let duration = options.duration
if (!duration && options.bedtime && options.waketime) {
  const [bh, bm] = options.bedtime.split(':').map(Number)
  const [wh, wm] = options.waketime.split(':').map(Number)
  let diff = (wh * 60 + wm) - (bh * 60 + bm)
  if (diff < 0) diff += 24 * 60
  duration = (diff / 60).toFixed(1)
}
if (!duration) {
  console.error('需要 --duration 或同时提供 --bedtime 和 --waketime')
  process.exit(1)
}
```

---

## 二、必须新增（P1）

### F5: `extraData` JSON 通用字段（拍照录入核心）

**理由**：AI 从体脂秤/手环截图提取的字段（身体年龄、蛋白质率、骨骼肌量、血氧等）随时变化，不能每换个设备就改 Schema。

**Schema 变更**：

```prisma
// prisma/schema.prisma
model Weight {
  // ... existing fields ...
  extraData Json?
}

model Sleep {
  // ... existing fields ...
  extraData Json?
}

model Diet {
  // ... existing fields ...
  extraData Json?
}

model Exercise {
  // ... existing fields ...
  extraData Json?
}
```

> 使用 Prisma `Json?` 类型，API 直接存取 JSON object，无需 parse/stringify。

**API 行为**：
- POST/PATCH：接收 `extraData`（JSON object），直接存入
- GET：原样返回 JSON object

**CLI 用法**：

```bash
hum weight add --value 70.5 \
  --extra-data '{"bodyAge":28,"proteinRate":13.1,"boneMass":3.2}'

hum sleep add --duration 7.5 \
  --extra-data '{"heartRateAvg":62,"spo2Avg":98}'
```

**Dashboard**：列表页增加 `extraData` 折叠展示（JSON 预览或"查看详情"按钮），**不需要为每个字段做输入框**。

---

### F10 + B4: Exercise Stats 均值 + CLI 展示增强

**API 新增**：`avgDuration`、`avgCalories`

```typescript
// apps/api/app/api/v1/exercises/stats/route.ts
return {
  totalDuration,
  totalCalories,
  avgDuration: exercises.length > 0 ? totalDuration / exercises.length : null,
  avgCalories: caloriesCount > 0 ? totalCalories / caloriesCount : null,
  frequencyByType,
  count: exercises.length
}
```

**CLI `output.js` 同步**：

```javascript
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
```

---

## 三、明确不做（本次迭代）

| 项 | 理由 |
|----|------|
| F4 具体字段转正（`leftArmMuscle`、`bodyAge`、`spo2Avg` 等） | AI 识别的设备字段全部走 `extraData`，Schema 永不膨胀 |
| F6 Drink 独立类型 | `mealType=snack --note "水 500ml"` 或塞 `extraData`，5 秒解决 |
| F7 批量导入 | 逐条拍照录入，无批量场景；真有历史数据用脚本调 API |
| F8 Trend 命令 | `hum weight stats --last 30d` 已返回均值/极值/变化量 |
| Dashboard 表单扩展新字段 | `extraData` 不需要表单输入框，AI 直接 CLI 录入 |

---

## 四、实施顺序

### Phase 1：Bug 修复（2–3 小时）

| # | 任务 | 文件 |
|---|------|------|
| 1 | 修复 `parseDateRange` end 边界 | `apps/api/lib/utils.ts` |
| 2 | 修复 sleep stats 均值计算 | `apps/api/app/api/v1/sleeps/stats/route.ts` |
| 3 | 修复 diet stats 均值计算 | `apps/api/app/api/v1/diets/stats/route.ts` |
| 4 | 增强 exercise stats 返回值 | `apps/api/app/api/v1/exercises/stats/route.ts` |
| 5 | Sleep add 自动计算 duration | `packages/cli/src/commands/sleep.js` |
| 6 | Dashboard diet stats 标签同步 | `apps/api/app/dashboard/diet/page.tsx` |

### Phase 2：`extraData` 基础设施（3–4 小时）

| # | 任务 | 文件 |
|---|------|------|
| 7 | Prisma Schema 增加 `extraData Json?` | `prisma/schema.prisma` |
| 8 | 生成并执行迁移 | `prisma migrate dev` |
| 9 | Weight API 支持 `extraData` | `apps/api/app/api/v1/weights/route.ts`, `[id]/route.ts` |
| 10 | Sleep API 支持 `extraData` | `apps/api/app/api/v1/sleeps/route.ts`, `[id]/route.ts` |
| 11 | Diet API 支持 `extraData` | `apps/api/app/api/v1/diets/route.ts`, `[id]/route.ts` |
| 12 | Exercise API 支持 `extraData` | `apps/api/app/api/v1/exercises/route.ts`, `[id]/route.ts` |
| 13 | CLI 各模块增加 `--extra-data` | `packages/cli/src/commands/{weight,sleep,diet,exercise}.js` |
| 14 | CLI output 展示 `extraData` | `packages/cli/src/lib/output.js` |
| 15 | Dashboard 列表页展示 `extraData` | `apps/api/app/dashboard/{weight,sleep,diet,exercise}/page.tsx` |

### Phase 3：验证（1 小时）

| # | 验证项 | 命令 |
|---|--------|------|
| 16 | 同日查询 | `hum diet list --start 2026-05-20 --end 2026-05-20` |
| 17 | Sleep 自动计算 | `hum sleep add --bedtime 23:00 --waketime 07:00 --quality 8` |
| 18 | extraData 存储 | `hum weight add --value 70 --extra-data '{"bodyAge":25}'` |
| 19 | Exercise stats 均值 | `hum exercise stats --last 30d` |
| 20 | Stats 均值正确性 | 对比有 null 字段时的平均值 |

---

## 五、验收标准

- [ ] `hum X list --start YYYY-MM-DD --end YYYY-MM-DD` 正确返回当天数据（所有模块）
- [ ] `hum sleep stats --last 7d` 的 `avgDeepSleep` 只计算有 `deepSleep` 的记录
- [ ] `hum diet stats --last 7d` 均值按有数据的记录数算，不按 7 天算
- [ ] `hum exercise stats --last 30d` 返回 `avgDuration` 和 `avgCalories`
- [ ] `hum sleep add --bedtime 23:00 --waketime 07:00 --quality 8` 自动 `duration=8.0`
- [ ] `hum weight add --value 70 --extra-data '{"a":1}'` 成功存储，`get` 时原样返回
- [ ] Dashboard 列表页能查看 `extraData` 原始 JSON

---

## 六、版本号

| 包 | 当前 | 新版本 |
|---|------|--------|
| `@hum/api` | 0.1.15 | 0.1.16 |
| `@eeymoo/hum` (CLI) | 0.1.6 | 0.1.16 |

---

## 七、一句话总结

> **修 Bug + 加 `extraData`，其他全部砍掉。**  
> 拍照录入场景下，Schema 只保留核心字段，AI 识别的所有设备原始数据走 JSON 字段，既保留完整信息，又永远不因换设备而改数据库。
