# 体重日力图 — 实施计划

> **目标**：在体重追踪页添加"日力图"（ECharts 日历热力图），展示每日体重变化，运动日叠加水平红色标记
> **版本**：v0.1.18
> **日期**：2026-05-29

---

## 一、视觉效果

```
       2026 年 体重日力图
 ┌─────────────────────────────────────────────┐
 │  一月          二月          三月      ...    │
 │ 日 一 二 ...   日 一 二 ...   日 一 二 ...     │
 │  ·  ·  ·       🟢 ·  ·       ·  ·  ·        │
 │  ·  🟢 ·       ·  ·  🔴      ·  ·  ·        │
 │  ·  ·  🔴      ·  🔴 ·       ·  ·  ·        │
 │  ·  ·  ·       ·  ·  ·       █  ·  ·        │
 │                              ↑ 运动标记      │
 ├─────────────────────────────────────────────┤
 │  🟢 下降    🔴 上升    ⬜ 无记录               │
 │  █ 运动日（红深 = 消耗多）                     │
 └─────────────────────────────────────────────┘
```

### 颜色规则

| 含义 | 颜色 | 规则 |
|------|------|------|
| 体重下降 | 🟢 绿色 | 相比上次记录减少，降幅越大绿色越深 |
| 体重上升 | 🔴 红色 | 相比上次记录增加，涨幅越大红色越深 |
| 持平 | ⚪ 浅灰 | 差值在 ±0.1kg 以内 |
| 无记录 | ⬜ 空白 | 当天未测量体重 |
| 运动标记 | █ 红色短线 | 水平标记，颜色深浅 = 当日消耗热量 |

---

## 二、数据模型

### 2.1 新建 `UserSetting` — 用户设置

```prisma
model UserSetting {
  id     String @id @default(uuid())
  userId String
  key    String
  value  String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, key])
  @@map("user_settings")
}
```

`User` 模型同步添加 `settings UserSetting[]` 关系。

### 2.2 设置 key

| key | 类型 | 说明 |
|-----|------|------|
| `target-weight` | Float | 目标体重（kg） |

统一使用 kebab-case，与 CLI `conf` 命名一致，后续可扩展。

---

## 三、API

### 3.1 `GET/PUT /api/v1/settings`

```
GET  /api/v1/settings          → { "settings": { "target-weight": "65" } }
PUT  /api/v1/settings/:key     → 更新单个设置
```

### 3.2 `GET /api/v1/weights/calendar?year=2026`

```json
{
  "data": [
    ["2026-01-01", null, null],
    ["2026-01-02", -0.3, 70.5],
    ["2026-01-03", +0.5, 71.0]
  ],
  "exerciseDays": [
    ["2026-01-02", 450],
    ["2026-01-05", 320]
  ],
  "summary": {
    "totalRecords": 42,
    "totalExerciseDays": 15,
    "netChange": -1.5
  },
  "year": 2026
}
```

- `data` 中每项：`[日期, 体重变化量, 当日体重]`
- `exerciseDays` 中每项：`[日期, 当日消耗总热量]`

---

## 四、前端组件

### 4.1 `WeightCalendarHeatmap.tsx`

```typescript
interface Props {
  year: number
  targetWeight: number | null
}
```

### 4.2 ECharts 配置

双 `visualMap`：

```typescript
visualMap: [
  {
    // 体重变化 → 红绿分段
    seriesIndex: 0,
    type: 'piecewise',
    pieces: [
      { min: 0.5,  color: '#DC2626' },            // 明显上升
      { min: 0.1,  max: 0.5,  color: '#FCA5A5' }, // 轻微上升
      { min: -0.1, max: 0.1,  color: '#E5E7EB' }, // 持平
      { min: -0.5, max: -0.1, color: '#86EFAC' }, // 轻微下降
      { max: -0.5, color: '#16A34A' },             // 明显下降
    ]
  },
  {
    // 运动消耗 → 红色深浅
    min: 0, max: 800,
    seriesIndex: 1,
    type: 'continuous',
    inRange: { color: ['#FEE2E2', '#EF4444', '#B91C1C'] }
  }
],
series: [
  {
    type: 'heatmap',
    coordinateSystem: 'calendar',
    data: weightChangeData   // [[日期, 变化量], ...]
  },
  {
    type: 'effectScatter',
    coordinateSystem: 'calendar',
    data: exerciseDays,      // [[日期, 热量], ...]
    symbol: 'rect',
    symbolSize: [12, 3],     // 水平短线
    z: 10
  }
]
```

---

## 五、页面集成

### 5.1 Settings 页面 — 新增「健康目标」

在 `settings/page.tsx` 添加卡片：

```
┌──────────────────────────────────────┐
│  🎯 健康目标                         │
│  目标体重: [___] kg     [已保存 ✓]   │
└──────────────────────────────────────┘
```

- 客户端组件 `TargetWeightSettings`（`'use client'`）
- 调用 `PUT /api/v1/settings/target-weight` 保存
- 体重页面从此 API 读取目标体重

### 5.2 Weight 页面 — 插入日力图

在统计卡片和折线图之间插入 `WeightCalendarHeatmap`：

```
┌──────────────────────────────────────────┐
│  体重追踪                    [+ 记录体重] │
├──────────────────────────────────────────┤
│  [ 平均 ] [ 最低 ] [ 最高 ] [ 变化 ]      │  ← 保留
├──────────────────────────────────────────┤
│  📅 2026 年体重日力图    ← 2026 →        │  ← 新增
│  ┌──────────────────────────────────┐    │
│  │  日历热力图 + 运动标记            │    │
│  └──────────────────────────────────┘    │
├──────────────────────────────────────────┤
│  体重趋势（折线图）                       │  ← 保留
├──────────────────────────────────────────┤
│  最近记录                                │  ← 保留
└──────────────────────────────────────────┘
```

---

## 六、实施步骤

```
1. Prisma → 2. Settings API → 3. Calendar API → 4. 组件 → 5. 集成 → 6. i18n → 7. 测试
```

| 步骤 | 文件 | 说明 |
|------|------|------|
| 1 | `prisma/schema.prisma` | 新增 `UserSetting` 模型 + 迁移 |
| 2 | `app/api/v1/settings/route.ts` | 用户设置 GET/PUT API |
| 3 | `app/api/v1/weights/calendar/route.ts` | 日历数据 API |
| 4 | `app/components/WeightCalendarHeatmap.tsx` | 日力图组件 |
| 5 | `app/dashboard/weight/page.tsx` | weight 页面集成组件 |
| 6 | `app/settings/page.tsx` | Settings 页面添加目标体重 |
| 7 | `messages/zh.json`, `messages/en.json` | i18n 翻译 |

---

## 七、i18n 新增 key

```json
// weight 节点
"calendarTitle": "体重日力图",
"exerciseMark": "运动日",
"caloriesBurned": "消耗热量",
"goToSettings": "去设置",

// settings 节点
"healthGoals": "健康目标",
"targetWeight": "目标体重",
"targetWeightSaved": "目标体重已保存"
```

---

## 八、版本信息

- **目标版本**：v0.1.18
- **涉及文件**：9 个
- **依赖**：echarts v6.1.0、react-echarts-library v1.4.0（已安装）
