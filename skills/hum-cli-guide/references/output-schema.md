# Output Schema & Analysis

## 专用类型数据结构

所有类型都包含 `extraData` 字段（可为 null），用于存储任意 JSON 格式的扩展数据。

### Weight (体重)

```json
{
  "id": "uuid",
  "userId": "uuid",
  "weight": 70.5,
  "bodyFat": 18.5,
  "muscleMass": 32.0,
  "bmi": 22.1,
  "water": 55.0,
  "boneMass": 3.2,
  "visceralFat": 8,
  "extraData": null,
  "note": "晨起空腹",
  "attachments": [],
  "date": "2024-01-15T00:00:00.000Z",
  "createdAt": "2024-01-15T08:30:00.000Z",
  "updatedAt": "2024-01-15T08:30:00.000Z"
}
```

### Exercise (运动)

```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "running",
  "duration": 30,
  "caloriesBurned": 300,
  "activities": [
    { "name": "卧推", "sets": 4, "reps": 10, "weight": 60 }
  ],
  "heartRateAvg": 130,
  "heartRateMax": 165,
  "feeling": 8,
  "location": "健身房",
  "extraData": null,
  "note": "状态不错",
  "attachments": [],
  "date": "2024-01-15T00:00:00.000Z",
  "createdAt": "2024-01-15T08:30:00.000Z",
  "updatedAt": "2024-01-15T08:30:00.000Z"
}
```

### Diet (饮食)

```json
{
  "id": "uuid",
  "userId": "uuid",
  "mealType": "lunch",
  "calories": 650,
  "protein": 35.0,
  "carbs": 70.0,
  "fat": 20.0,
  "fiber": 8.0,
  "sodium": 800.0,
  "foods": [
    { "name": "鸡胸肉", "amount": "150g" },
    { "name": "糙米饭", "amount": "200g" }
  ],
  "water": 300,
  "extraData": null,
  "note": "健康午餐",
  "attachments": [],
  "date": "2024-01-15T00:00:00.000Z",
  "createdAt": "2024-01-15T08:30:00.000Z",
  "updatedAt": "2024-01-15T08:30:00.000Z"
}
```

### Sleep (睡眠)

```json
{
  "id": "uuid",
  "userId": "uuid",
  "duration": 7.5,
  "bedTime": "23:00",
  "wakeTime": "06:30",
  "quality": 8,
  "deepSleep": 1.5,
  "remSleep": 1.8,
  "awakenings": 2,
  "feeling": 7,
  "extraData": null,
  "note": "睡得不错",
  "attachments": [],
  "date": "2024-01-15T00:00:00.000Z",
  "createdAt": "2024-01-15T08:30:00.000Z",
  "updatedAt": "2024-01-15T08:30:00.000Z"
}
```

### Food (食物查询结果)

```json
{
  "source": "chinanutri",
  "sourceId": "12345",
  "name": "鸡胸肉",
  "energyKcal": 133.0,
  "protein": 31.0,
  "fat": 3.6,
  "carbs": 0
}
```

---

## List 响应结构

所有 `list` 命令返回分页结构（以 weight 为例）：

```json
{
  "weights": [...],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

每种类型的 list 响应顶层键名：
- `hum weight list` → `weights`
- `hum exercise list` → `exercises`
- `hum diet list` → `diets`
- `hum sleep list` → `sleeps`
- `hum food --name ...` → `foods`（无分页，totalPages 固定为 1）

## Stats 统计响应

### Weight Stats
```json
{
  "avgWeight": 70.5,
  "minWeight": 68.0,
  "maxWeight": 73.0,
  "count": 30,
  "trend": [...]
}
```

### Exercise Stats
```json
{
  "totalDuration": 300,
  "totalCalories": 2500,
  "avgDuration": 42.9,
  "avgCalories": 357.1,
  "frequencyByType": { "running": 3, "strength": 4 },
  "count": 7
}
```

- `avgDuration`：平均每次运动时长（分钟）
- `avgCalories`：平均每次有热量记录的消耗（kcal），仅统计有 `caloriesBurned` 值的记录

### Diet Stats
```json
{
  "avgCalories": 550.0,
  "avgProtein": 30.5,
  "avgCarbs": 65.2,
  "avgFat": 18.3,
  "totalWater": 2100,
  "count": 14
}
```

- 所有平均值按**有该字段值的记录数**计算（非按天数）
- `totalWater`：仅在总计 > 0 时返回，否则为 null

### Sleep Stats
```json
{
  "avgDuration": 7.2,
  "avgQuality": 7.5,
  "avgDeepSleep": 1.4,
  "count": 7
}
```

- `avgDeepSleep`：仅统计有深睡记录的数据，避免因缺失值拉低均值

## Record (通用记录)

`hum record` 用于非标准类型的自定义记录（custom/medical/supplement/symptom/other）：

```json
{
  "id": "uuid",
  "type": "medical",
  "data": {},
  "tags": "tag1,tag2",
  "note": "string",
  "attachments": "string",
  "date": "2024-01-15T00:00:00.000Z",
  "createdAt": "2024-01-15T08:30:00.000Z",
  "updatedAt": "2024-01-15T08:30:00.000Z",
  "deletedAt": null
}
```

## 内置统计命令

```bash
hum weight stats --last 30d      # 体重趋势 + 统计
hum exercise stats --last 7d     # 运动汇总（含平均时长/热量）
hum diet stats --last 7d         # 饮食统计（平均营养素）
hum sleep stats --last 7d        # 睡眠分析（含深睡均值）
```

所有 stats 命令支持 `--format` 参数：`json`（默认）、`table`、`toon`。

## Timeline (时间线)

查看所有类型健康数据的合并时间线：

```bash
# 最近 7 天全部数据
hum timeline --last 7d

# 指定日期范围
hum timeline --start 2024-01-01 --end 2024-01-31
```

返回按时间排序的所有类型记录的合并视图。
