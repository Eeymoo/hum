# Specialized Commands

Hum CLI provides dedicated subcommands for each health tracking category. Each type supports `add`, `list`, `stats`, `get`, `update`, and `delete` operations.

---

## Weight (体重)

### 录入体重

```bash
# 必填：体重值（单位 kg）
hum weight add --value 70.5

# 完整示例：带身体成分数据
hum weight add \
  --value 70.5 \
  --body-fat 18.5 \
  --muscle-mass 32.0 \
  --bmi 22.1 \
  --water 55.0 \
  --bone-mass 3.2 \
  --visceral-fat 8

# 带备注和日期（补录历史数据）
hum weight add --value 71.0 --note "饭后" --date 2024-01-15

# 附带文件（如体脂秤截图）
hum weight add --value 70.5 --file ./scale-photo.jpg
```

**字段说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `--value` | ✅ | 体重值（kg） |
| `--body-fat` | | 体脂率（%） |
| `--muscle-mass` | 肌肉量（kg） |
| `--bmi` | BMI 指数 |
| `--water` | 水分率（%） |
| `--bone-mass` | 骨量（kg） |
| `--visceral-fat` | 内脏脂肪等级 |
| `--note` | 备注 |
| `--date` | 日期（YYYY-MM-DD），默认今天 |
| `--file` | 附件文件路径（可多个） |

### 查询与统计

```bash
# 查看最近记录
hum weight list --last 7d

# 统计数据（趋势、均值等）
hum weight stats --last 30d

# 查看单条记录
hum weight get --id <id>

# 更新记录
hum weight update --id <id> --value 71.0 --note "更正"

# 删除记录
hum weight delete --id <id>
```

---

## Exercise (运动)

### 录入运动

```bash
# 必填：运动类型 + 时长（分钟）
hum exercise add --type running --duration 30

# 完整示例：带详细数据
hum exercise add \
  --type strength \
  --duration 60 \
  --calories 400 \
  --heart-rate-avg 130 \
  --heart-rate-max 165 \
  --feeling 8 \
  --location "健身房"

# 带活动明细（格式：名称:属性1=值1,属性2=值2;名称2:属性1=值1）
hum exercise add \
  --type strength \
  --duration 60 \
  --activities "卧推:sets=4,reps=10,weight=60;深蹲:sets=3,reps=12,weight=80"

# 补录历史运动
hum exercise add --type swimming --duration 45 --date 2024-01-10
```

**字段说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `--type` | ✅ | 运动类型（running/strength/cycling/swimming/other 等） |
| `--duration` | ✅ | 时长（分钟） |
| `--calories` | | 消耗热量（kcal） |
| `--activities` | | 活动明细，格式：`名称:属性=值,属性=值;名称2:属性=值` |
| `--heart-rate-avg` | | 平均心率 |
| `--heart-rate-max` | 最大心率 |
| `--feeling` | 感受评分（1-10） |
| `--location` | 地点 |
| `--note` | 备注 |
| `--date` | 日期（YYYY-MM-DD），默认今天 |
| `--file` | 附件文件路径（可多个） |

### 查询与统计

```bash
# 查看最近运动记录
hum exercise list --last 7d

# 按类型筛选
hum exercise list --type running --last 30d

# 运动统计
hum exercise stats --last 7d

# 查看/更新/删除
hum exercise get --id <id>
hum exercise update --id <id> --duration 35
hum exercise delete --id <id>
```

---

## Diet (饮食)

### 录入饮食

```bash
# 必填：餐次类型
hum diet add --meal breakfast

# 完整示例：带营养数据
hum diet add \
  --meal lunch \
  --calories 650 \
  --protein 35.0 \
  --carbs 70.0 \
  --fat 20.0 \
  --fiber 8.0 \
  --sodium 800 \
  --water 300

# 带食物明细（格式：食物名:食用量,食物名2:食用量2）
hum diet add \
  --meal dinner \
  --foods "鸡胸肉:150g,糙米饭:200g,西兰花:100g" \
  --calories 550

# 快速录入
hum diet add --meal snack --foods "苹果:1个" --note "下午加餐"
```

**字段说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `--meal` | ✅ | 餐次类型（breakfast/lunch/dinner/snack） |
| `--calories` | | 热量（kcal） |
| `--protein` | | 蛋白质（g） |
| `--carbs` | | 碳水化合物（g） |
| `--fat` | | 脂肪（g） |
| `--fiber` | | 膳食纤维（g） |
| `--sodium` | | 钠（mg） |
| `--foods` | | 食物明细，格式：`食物名:食用量,食物名2:食用量2` |
| `--water` | | 饮水量（ml） |
| `--note` | 备注 |
| `--date` | 日期（YYYY-MM-DD），默认今天 |
| `--file` | 附件文件路径（可多个） |

### 查询与统计

```bash
# 查看最近饮食记录
hum diet list --last 7d

# 按餐次筛选
hum diet list --meal breakfast --last 7d

# 饮食统计
hum diet stats --last 7d

# 查看/更新/删除
hum diet get --id <id>
hum diet update --id <id> --calories 600
hum diet delete --id <id>
```

---

## Sleep (睡眠)

### 录入睡眠

```bash
# 必填：时长 + 入睡时间 + 起床时间 + 睡眠质量
hum sleep add \
  --duration 7.5 \
  --bedtime 23:00 \
  --waketime 06:30 \
  --quality 8

# 完整示例：带详细睡眠数据
hum sleep add \
  --duration 7.5 \
  --bedtime 23:00 \
  --waketime 06:30 \
  --quality 8 \
  --deep-sleep 1.5 \
  --rem-sleep 1.8 \
  --awakenings 2 \
  --feeling 7

# 快速录入
hum sleep add --duration 6 --bedtime 00:30 --waketime 06:30 --quality 5 --note "失眠"
```

**字段说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `--duration` | ✅ | 睡眠时长（小时） |
| `--bedtime` | ✅ | 入睡时间（HH:mm） |
| `--waketime` | ✅ | 起床时间（HH:mm） |
| `--quality` | ✅ | 睡眠质量评分（1-10） |
| `--deep-sleep` | | 深度睡眠时长（小时） |
| `--rem-sleep` | | REM 睡眠时长（小时） |
| `--awakenings` | | 夜醒次数 |
| `--feeling` | | 起床感受评分（1-10） |
| `--note` | 备注 |
| `--date` | 日期（YYYY-MM-DD），默认今天 |
| `--file` | 附件文件路径（可多个） |

### 查询与统计

```bash
# 查看最近睡眠记录
hum sleep list --last 7d

# 睡眠统计分析
hum sleep stats --last 30d

# 查看/更新/删除
hum sleep get --id <id>
hum sleep update --id <id> --quality 7
hum sleep delete --id <id>
```

---

## 通用查询参数

所有 `list` 命令支持相同的查询参数：

| 参数 | 说明 |
|------|------|
| `--last <period>` | 时间范围（如 `7d` 7天、`2w` 2周、`1m` 1月、`1y` 1年，或纯数字表示天数） |
| `--start <date>` | 起始日期（YYYY-MM-DD） |
| `--end <date>` | 结束日期（YYYY-MM-DD） |
| `--include-deleted` | 包含已删除记录 |

所有 `stats` 命令支持 `--last`、`--start`、`--end` 参数。
