# API 文档

Hum 提供 RESTful API，所有请求需携带认证令牌。

## 认证方式

API 支持两种认证方式：

**API Key：**
```
Authorization: Bearer <your-api-key>
```

**Access Token（Device Flow）：**
```
Authorization: Bearer <access-token>
```

## 公共参数

所有 GET 列表接口支持以下查询参数：

| 参数 | 说明 | 示例 |
|------|------|------|
| `last` | 时间范围 | `7d`, `2w`, `1m`, `3y` |
| `start` | 开始日期 | `2024-01-01` |
| `end` | 结束日期 | `2024-01-31` |
| `page` | 页码（默认 1） | `2` |
| `limit` | 每页条数（默认 20） | `10` |
| `order` | 排序方向（默认 desc） | `asc` |

## 端点

### 体重 (Weights)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/weights` | 获取体重列表 |
| POST | `/api/v1/weights` | 创建体重记录 |
| GET | `/api/v1/weights/stats` | 获取体重统计 |
| GET | `/api/v1/weights/:id` | 获取单个体重记录 |
| PATCH | `/api/v1/weights/:id` | 更新体重记录 |
| DELETE | `/api/v1/weights/:id` | 删除体重记录 |

**POST /api/v1/weights**（FormData）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `weight` | float | 是 | 体重（kg） |
| `bodyFat` | float | 否 | 体脂率（%） |
| `muscleMass` | float | 否 | 肌肉量（kg） |
| `bmi` | float | 否 | BMI |
| `water` | float | 否 | 水分率（%） |
| `boneMass` | float | 否 | 骨量（kg） |
| `visceralFat` | int | 否 | 内脏脂肪等级 |
| `note` | string | 否 | 备注 |
| `date` | string | 否 | 日期（YYYY-MM-DD） |
| `file` | file[] | 否 | 附件 |

**GET /api/v1/weights/stats**

返回：
```json
{
  "trend": [
    { "date": "2024-01-01", "weight": 70.5, "bodyFat": 22.0 }
  ],
  "avgWeight": 70.5,
  "minWeight": 69.0,
  "maxWeight": 72.0,
  "change": -1.5
}
```

### 运动 (Exercises)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/exercises` | 获取运动列表 |
| POST | `/api/v1/exercises` | 创建运动记录 |
| GET | `/api/v1/exercises/stats` | 获取运动统计 |
| GET | `/api/v1/exercises/:id` | 获取单个运动记录 |
| PATCH | `/api/v1/exercises/:id` | 更新运动记录 |
| DELETE | `/api/v1/exercises/:id` | 删除运动记录 |

**POST /api/v1/exercises**（FormData）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 类型：running/strength/cycling/swimming/other |
| `duration` | int | 是 | 时长（分钟） |
| `caloriesBurned` | int | 否 | 消耗热量 |
| `activities` | string | 否 | 活动详情 |
| `heartRateAvg` | int | 否 | 平均心率 |
| `heartRateMax` | int | 否 | 最大心率 |
| `feeling` | int | 否 | 感受（1-10） |
| `location` | string | 否 | 地点 |
| `note` | string | 否 | 备注 |
| `date` | string | 否 | 日期 |
| `file` | file[] | 否 | 附件 |

**GET /api/v1/exercises/stats**

返回：
```json
{
  "totalDuration": 300,
  "totalCalories": 1500,
  "frequencyByType": { "running": 5, "strength": 3 },
  "count": 8
}
```

### 饮食 (Diets)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/diets` | 获取饮食列表 |
| POST | `/api/v1/diets` | 创建饮食记录 |
| GET | `/api/v1/diets/stats` | 获取饮食统计 |
| GET | `/api/v1/diets/:id` | 获取单个饮食记录 |
| PATCH | `/api/v1/diets/:id` | 更新饮食记录 |
| DELETE | `/api/v1/diets/:id` | 删除饮食记录 |

**POST /api/v1/diets**（FormData）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mealType` | string | 是 | 餐别：breakfast/lunch/dinner/snack |
| `calories` | int | 否 | 热量 |
| `protein` | float | 否 | 蛋白质（g） |
| `carbs` | float | 否 | 碳水（g） |
| `fat` | float | 否 | 脂肪（g） |
| `fiber` | float | 否 | 纤维（g） |
| `sodium` | float | 否 | 钠（mg） |
| `foods` | string | 否 | 食物列表 |
| `water` | int | 否 | 饮水量（ml） |
| `note` | string | 否 | 备注 |
| `date` | string | 否 | 日期 |
| `file` | file[] | 否 | 附件 |

**GET /api/v1/diets/stats**

返回：
```json
{
  "avgCaloriesPerDay": 2000,
  "avgProtein": 80.5,
  "avgCarbs": 250.0,
  "avgFat": 65.0,
  "totalWater": 2000,
  "count": 21
}
```

### 睡眠 (Sleeps)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/sleeps` | 获取睡眠列表 |
| POST | `/api/v1/sleeps` | 创建睡眠记录 |
| GET | `/api/v1/sleeps/stats` | 获取睡眠统计 |
| GET | `/api/v1/sleeps/:id` | 获取单个睡眠记录 |
| PATCH | `/api/v1/sleeps/:id` | 更新睡眠记录 |
| DELETE | `/api/v1/sleeps/:id` | 删除睡眠记录 |

**POST /api/v1/sleeps**（FormData）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `duration` | float | 是 | 睡眠时长（小时） |
| `bedTime` | string | 是 | 入睡时间（HH:MM） |
| `wakeTime` | string | 是 | 醒来时间（HH:MM） |
| `quality` | int | 是 | 质量（1-10） |
| `deepSleep` | float | 否 | 深睡时长（小时） |
| `remSleep` | float | 否 | REM 时长（小时） |
| `awakenings` | int | 否 | 觉醒次数 |
| `feeling` | int | 否 | 感受（1-10） |
| `note` | string | 否 | 备注 |
| `date` | string | 否 | 日期 |
| `file` | file[] | 否 | 附件 |

**GET /api/v1/sleeps/stats**

返回：
```json
{
  "avgDuration": 7.5,
  "avgQuality": 8.2,
  "avgDeepSleep": 2.0,
  "count": 7
}
```

### 记录 (Records)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/records` | 获取记录列表 |
| POST | `/api/v1/records` | 创建新记录 |
| GET | `/api/v1/records/search` | 搜索记录 |
| GET | `/api/v1/records/:id` | 获取单个记录 |
| PATCH | `/api/v1/records/:id` | 更新记录 |
| DELETE | `/api/v1/records/:id` | 删除记录 |

**POST /api/v1/records**（JSON）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 类型：note/mood/symptom/medication/measurement/other |
| `data` | object | 是 | JSON 数据 |
| `tags` | string[] | 否 | 标签 |
| `note` | string | 否 | 备注 |
| `attachments` | string[] | 否 | 附件 URL |
| `date` | string | 否 | 日期 |

**GET /api/v1/records/search**

查询参数：`q`（搜索关键词）、`type`、`last`、`includeDeleted`

### 时间线 (Timeline)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/timeline` | 获取聚合时间线 |

返回所有类型数据的统一时间线，按时间倒序排列。

### 认证 (Auth)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/verify` | 验证 API Key |
| POST | `/api/v1/auth/device` | 发起 Device Flow |
| POST | `/api/v1/auth/device/token` | 轮询 Device Token |
| GET | `/api/v1/auth/keys` | 获取 API 密钥列表 |
| POST | `/api/v1/auth/keys` | 创建 API 密钥 |
| DELETE | `/api/v1/auth/keys/:id` | 删除 API 密钥 |

**POST /api/v1/auth/verify**（JSON）

```json
{ "apiKey": "your-api-key" }
```

返回：
```json
{
  "valid": true,
  "user": "用户名",
  "keyName": "密钥名称"
}
```

**POST /api/v1/auth/device**

返回：
```json
{
  "deviceCode": "...",
  "userCode": "ABCD-EFGH",
  "verificationUriComplete": "http://localhost:3000/auth/device?code=ABCD-EFGH",
  "interval": 5,
  "expiresIn": 1800
}
```

### 数据同步

> 第三方健康数据云端同步。当前支持小米运动健康（`miapi` 数据源）。
> ⚠️ 数据同步需配置 `SYNC_TOKEN_SECRET` 环境变量（用于加密存储第三方凭据），且仅在长驻 Node.js 进程下可用定时同步（不支持 serverless）。

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/sync/sources` | 列出已注册的数据源及其配置 schema | 登录 |
| GET | `/api/v1/sync/config` | 查询当前用户的同步配置（开关、频率、绑定状态、最后同步时间） | 登录 |
| POST | `/api/v1/sync/config` | 保存同步配置（开关、cron 频率） | 写权限 |
| POST | `/api/v1/sync/trigger` | 手动触发一次同步，可选 `startDate`/`endDate` | 写权限 |
| GET | `/api/v1/sync/jobs` | 查询同步任务历史（`limit` 默认 10） | 登录 |
| POST | `/api/v1/sync/login` | 账号密码登录或手动导入 Token 绑定 | 写权限 |
| POST | `/api/v1/sync/login/qr` | 生成二维码，返回 `sessionId` 与二维码图片 URL | 写权限 |
| POST | `/api/v1/sync/login/qr-poll` | 轮询扫码状态（`waiting`/`scanned`/`expired`/`error`） | 写权限 |

**GET /api/v1/sync/sources**

```json
{
  "sources": [
    {
      "id": "miapi",
      "name": "小米健康 API",
      "description": "通过小米健康 API 同步步数、心率、睡眠、体重等健康数据（支持二维码/密码登录）",
      "configSchema": [...]
    }
  ]
}
```

**POST /api/v1/sync/trigger**

请求体（均可选）：
```json
{ "startDate": "2026-01-01", "endDate": "2026-01-31" }
```

成功返回：
```json
{
  "jobId": "...",
  "success": true,
  "syncedRecords": { "exercise": 7, "sleep": 7, "weight": 2, "diet": 0 },
  "errors": []
}
```

未开启同步 / 未绑定凭据时返回 400，已有运行中任务返回 409。

> 注：数据同步走小米健康聚合数据接口（`get_aggregated_fitness_data_by_time`，RC4 加密签名 + `daily_report` tag）与原始测量接口（`get_fitness_data_by_time`）。支持步数/心率/睡眠/卡路里/血氧/有效站立/中高强度/压力（按天聚合）+ 体重（原始测量，含体脂/肌肉/骨量/水分/内脏脂肪）共 9 类数据同步入库（sourceId 幂等）。

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 健康检查 |
| POST | `/api/v1/files` | 文件上传 |

**GET /api/v1/health**

返回：
```json
{
  "status": "ok",
  "version": "0.1.14",
  "requirement": ">=0.3.0"
}
```
