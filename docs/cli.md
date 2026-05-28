# CLI 使用指南

Hum CLI 是与后端 API 交互的命令行工具，支持体重、运动、饮食、睡眠四大健康维度的数据管理。

## 安装

```bash
# 方式一：从源码链接（开发）
cd packages/cli
npm install && npm link

# 方式二：从 npm 安装（用户）
npm install -g @eeymoo/hum
```

## 全局选项

```bash
hum --version    # 查看 CLI 版本
hum --help       # 查看帮助
```

CLI 启动时会自动检查与 API 的版本兼容性。若主版本不一致，将提示升级。

---

## 配置命令

### `hum config`

```bash
# 设置 API 地址
hum config set apiUrl http://localhost:3001

# 查看当前配置
hum config list
```

---

## 认证命令

### `hum auth login`

支持两种登录方式：

```bash
# API Key 方式（推荐用于自动化脚本）
hum auth login --api-key <your-api-key>

# Device Flow 方式（交互式，适合临时使用）
hum auth login --device
# 按提示访问 URL 并输入验证码
```

### `hum auth status`

显示当前登录状态、API 地址、CLI 与 API 版本号。

### `hum auth logout`

清除本地保存的 API Key 和 Access Token。

### `hum auth keys`

管理 API 密钥（需先登录）：

```bash
hum auth keys list                    # 列出所有密钥
hum auth keys create --name "my cli"  # 创建新密钥
hum auth keys revoke --id <key-id>    # 删除密钥
```

---

## 体重追踪

### `hum weight add`

```bash
hum weight add \
  --value 70.5 \
  --body-fat 22.0 \
  --muscle-mass 55.0 \
  --bmi 22.5 \
  --water 55.0 \
  --bone-mass 3.0 \
  --visceral-fat 8 \
  --note "晨起空腹" \
  --date 2024-01-15
```

**必填**：`--value`

### `hum weight list`

```bash
hum weight list --last 30d
hum weight list --start 2024-01-01 --end 2024-01-31
hum weight list --include-deleted
```

### `hum weight stats`

```bash
hum weight stats --last 30d
```

返回：趋势数据、平均体重、最低/最高体重、30 天变化量。

### `hum weight get`

```bash
hum weight get --id <record-id>
```

### `hum weight update`

```bash
hum weight update --id <record-id> --value 71.0 --note "更新备注"
```

### `hum weight delete`

```bash
hum weight delete --id <record-id>
```

---

## 运动追踪

### `hum exercise add`

```bash
hum exercise add \
  --type running \
  --duration 30 \
  --calories-burned 320 \
  --activities "慢跑:时长=30,距离=5km" \
  --feeling 8 \
  --date 2024-01-15
```

**必填**：`--type`, `--duration`

**运动类型**：`running` | `strength` | `cycling` | `swimming` | `other`

### `hum exercise list`

```bash
hum exercise list --last 7d
hum exercise list --type running --last 30d
```

### `hum exercise stats`

```bash
hum exercise stats --last 30d
```

返回：总次数、总时长、总热量消耗、各类型频率分布。

### `hum exercise get`

```bash
hum exercise get --id <record-id>
```

### `hum exercise update`

```bash
hum exercise update --id <record-id> --duration 45
```

### `hum exercise delete`

```bash
hum exercise delete --id <record-id>
```

---

## 饮食追踪

### `hum diet add`

```bash
hum diet add \
  --meal lunch \
  --calories 650 \
  --protein 35 \
  --carbs 80 \
  --fat 15 \
  --fiber 8 \
  --sodium 1200 \
  --foods "米饭:200g,鸡胸肉:150g,西兰花:100g" \
  --water 500 \
  --date 2024-01-15
```

**必填**：`--meal`

**餐别**：`breakfast` | `lunch` | `dinner` | `snack`

### `hum diet list`

```bash
hum diet list --last 7d
hum diet list --meal breakfast
```

### `hum diet stats`

```bash
hum diet stats --last 7d
```

返回：日均热量、平均蛋白质/碳水/脂肪、总饮水量。

### `hum diet get`

```bash
hum diet get --id <record-id>
```

### `hum diet update`

```bash
hum diet update --id <record-id> --calories 700
```

### `hum diet delete`

```bash
hum diet delete --id <record-id>
```

---

## 睡眠追踪

### `hum sleep add`

```bash
hum sleep add \
  --duration 7.5 \
  --bedtime 23:00 \
  --waketime 06:30 \
  --quality 8 \
  --deep-sleep 2.0 \
  --rem-sleep 1.5 \
  --date 2024-01-15
```

**必填**：`--duration`, `--bedtime`, `--waketime`, `--quality`

### `hum sleep list`

```bash
hum sleep list --last 7d
```

### `hum sleep stats`

```bash
hum sleep stats --last 7d
```

返回：平均时长、平均质量、平均深睡时长。

### `hum sleep get`

```bash
hum sleep get --id <record-id>
```

### `hum sleep update`

```bash
hum sleep update --id <record-id> --quality 9
```

### `hum sleep delete`

```bash
hum sleep delete --id <record-id>
```

---

## 通用记录

### `hum record add`

```bash
hum record add \
  --type note \
  --data '{"mood":"good","energy":8}' \
  --tags daily,morning \
  --note "今日状态不错"
```

**必填**：`--type`, `--data`

**记录类型**：`note` | `mood` | `symptom` | `medication` | `measurement` | `other`

### `hum record list`

```bash
hum record list --tag daily --last 7d
hum record list --type mood --start 2024-01-01 --end 2024-01-31
```

### `hum record search`

```bash
hum record search --query "状态"
hum record search --query "体重" --type measurement --last 30d
```

### `hum record get`

```bash
hum record get --id <record-id>
```

### `hum record update`

```bash
hum record update --id <record-id> --data '{"energy":9}' --note "更新备注"
```

### `hum record delete`

```bash
hum record delete --id <record-id>
```

---

## 时间线

### `hum timeline`

聚合显示所有健康数据（体重、运动、饮食、睡眠、记录）的时间线：

```bash
hum timeline --last 7d
hum timeline --start 2024-01-01 --end 2024-01-31
```

---

## 时间范围格式

所有 `--last` 参数支持以下格式：

| 格式 | 含义 | 示例 |
|------|------|------|
| `N` 或 `Nd` | 最近 N 天 | `7`, `7d` |
| `Nw` | 最近 N 周 | `2w` |
| `Nm` | 最近 N 月 | `1m` |
| `Ny` | 最近 N 年 | `3y` |

也可使用 `--start` 和 `--end` 指定精确日期范围（`YYYY-MM-DD` 格式）。
