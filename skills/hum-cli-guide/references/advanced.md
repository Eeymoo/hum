# Advanced Usage

## 更新记录

所有类型都支持 `update` 命令，只需传入要修改的字段：

```bash
# 更新体重
hum weight update --id <id> --value 71.0 --note "更正"

# 更新运动（增加活动明细）
hum exercise update --id <id> --feeling 9 --note "后来觉得很爽"

# 更新饮食
hum diet update --id <id> --calories 700

# 更新睡眠
hum sleep update --id <id> --quality 7 --note "其实还行"
```

更新时支持 `--replace-attachments` 标志来替换（而非追加）附件：

```bash
hum weight update --id <id> --file ./new-photo.jpg --replace-attachments
```

## 补录历史数据

所有 `add` 命令都支持 `--date` 参数：

```bash
# 补录昨天的体重
hum weight add --value 70.5 --date 2024-01-14

# 补录上周的运动
hum exercise add --type running --duration 30 --date 2024-01-08

# 补录昨天的午餐
hum diet add --meal lunch --foods "沙拉:1份,面包:2片" --date 2024-01-14

# 补录前天的睡眠
hum sleep add --duration 7 --bedtime 22:30 --waketime 05:30 --quality 7 --date 2024-01-13
```

## 文件附件

所有 `add` 和 `update` 命令支持通过 `--file` 上传附件：

```bash
# 单个文件
hum weight add --value 70.5 --file ./scale-screenshot.jpg

# 多个文件
hum exercise add --type hiking --duration 120 --file ./photo1.jpg --file ./photo2.jpg

# 更新时追加附件
hum diet update --id <id> --file ./meal-photo.jpg

# 替换全部附件
hum diet update --id <id> --file ./new-photo.jpg --replace-attachments
```

## 时间范围格式

`--last` 参数支持多种格式：

```bash
hum weight list --last 7d     # 最近 7 天
hum weight list --last 2w     # 最近 2 周
hum weight list --last 1m     # 最近 1 个月
hum weight list --last 3y     # 最近 3 年
hum weight list --last 10     # 最近 10 天（无后缀等同天数）
```

也可以用 `--start` 和 `--end` 指定精确日期范围：

```bash
hum weight list --start 2024-01-01 --end 2024-01-31
```

## Generic Record (通用记录)

对于 Weight/Exercise/Diet/Sleep 之外的健康数据，使用通用 `record` 命令：

```bash
# 添加自定义记录
hum record add --type medical --data '{"symptom": "headache", "severity": 5}'

# 带标签
hum record add --type supplement --data '{"name": "vitamin D", "dose": "1000IU"}' --tags daily,morning

# 搜索记录
hum record search --query "headache"

# 列出记录
hum record list --type medical --last 30d
```

**通用记录类型**：`custom`、`medical`、`supplement`、`symptom`、`other`

**注意**：体重/运动/饮食/睡眠数据请使用对应的专用命令（`hum weight`、`hum exercise`、`hum diet`、`hum sleep`），而非通用 `record` 命令。

## Timeline (时间线)

查看所有类型数据的合并时间线：

```bash
# 最近 7 天全部数据
hum timeline --last 7d

# 指定日期范围
hum timeline --start 2024-01-01 --end 2024-01-31

# 包含已删除记录
hum timeline --include-deleted
```

## API 直接调用

也可以绕过 CLI 直接调用 API（适合脚本或自动化场景）：

```bash
# 创建体重记录（FormData 格式）
curl -X POST http://localhost:3000/api/v1/weights \
  -H "Authorization: Bearer $HUM_API_KEY" \
  -F "weight=70.5" \
  -F "bodyFat=18.5" \
  -F "note=晨起空腹"

# 创建运动记录
curl -X POST http://localhost:3000/api/v1/exercises \
  -H "Authorization: Bearer $HUM_API_KEY" \
  -F "type=running" \
  -F "duration=30" \
  -F "caloriesBurned=300"

# 创建饮食记录
curl -X POST http://localhost:3000/api/v1/diets \
  -H "Authorization: Bearer $HUM_API_KEY" \
  -F "mealType=lunch" \
  -F "calories=650" \
  -F "foods=鸡胸肉:150g,糙米饭:200g"

# 创建睡眠记录
curl -X POST http://localhost:3000/api/v1/sleeps \
  -H "Authorization: Bearer $HUM_API_KEY" \
  -F "duration=7.5" \
  -F "bedTime=23:00" \
  -F "wakeTime=06:30" \
  -F "quality=8"
```
