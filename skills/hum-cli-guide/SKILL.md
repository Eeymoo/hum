---
name: hum-cli-guide
description: Use this skill when the user wants to log, query, update, or manage personal health data (weight, exercise, sleep, diet) or search food nutrition info via the Hum health-tracking CLI, including authentication setup with API keys or device flow, searching/filtering records, and troubleshooting API errors — even if they don't explicitly mention "Hum" or "CLI".
---

# Hum CLI Guide

This skill helps you use the Hum health tracking CLI effectively.

## When to Use

Use this skill when:
- Setting up Hum CLI for the first time
- Recording health data (weight, exercise, sleep, diet)
- Searching food nutrition information
- Managing your health records
- Querying your health timeline or stats

## Getting Started

### 1. Check CLI Status

```bash
hum auth status
```

This shows if you're logged in and the API connection status.

### 2. Login

Choose one method:

**Option A: API Key (Recommended for automation)**
```bash
hum auth login --api-key YOUR_API_KEY
```

**Option B: Device Flow (Interactive)**
```bash
hum auth login --device
```

Then visit the URL shown and enter the code.

### 3. Quick Record

Record your first health data:

```bash
# Record weight (必填: 体重值 kg)
hum weight add --value 70.5

# Record exercise (必填: 运动类型 + 时长分钟)
hum exercise add --type running --duration 30

# Record diet (必填: 餐次类型)
hum diet add --meal lunch --foods "鸡胸肉:150g,糙米饭:200g"

# Record sleep (必填: 入睡时间 + 起床时间 + 质量，时长可自动计算)
hum sleep add --bedtime 23:00 --waketime 06:30 --quality 8

# Search food nutrition info
hum food --name 鸡胸肉
```

## Daily Usage

### View Recent Records

```bash
# 查看各类最近记录
hum weight list --last 7d
hum exercise list --last 7d
hum diet list --last 7d
hum sleep list --last 7d

# 综合时间线
hum timeline --last 7d
```

### View Stats

```bash
hum weight stats --last 30d
hum exercise stats --last 7d
hum diet stats --last 7d
hum sleep stats --last 7d
```

### Update & Delete

```bash
hum weight update --id RECORD_ID --value 71.0
hum weight delete --id RECORD_ID
```

## References

Load these reference files when the user asks about specific topics:

- **录入详细说明（Weight/Exercise/Diet/Sleep/Food 字段与示例）** → read `references/specialized-commands.md`
- **更新记录、附件、补录、API 调用** → read `references/advanced.md`
- **Configuration or API keys** → read `references/config-and-keys.md`
- **API errors or connection issues** → read `references/troubleshooting.md`
- **数据结构、响应格式、统计命令** → read `references/output-schema.md`
