# Hum

一个健康跟踪应用，包含 API 服务和命令行工具。

## 项目结构

```
hum/
├── apps/
│   └── api/             # Next.js API 服务
│       ├── app/
│       │   └── api/
│       │       └── v1/  # API 端点
│       ├── lib/         # 工具函数
│       └── prisma/      # 数据库 schema 和迁移
└── packages/
    └── cli/             # 命令行工具
```

## 技术栈

- **API 服务**：Next.js 15, TypeScript, Prisma
- **CLI 工具**：Node.js, Commander.js
- **数据库**：SQLite (本地开发)

## 快速开始

### 前置要求

- Node.js 18+

### 1. 启动 API 服务

```bash
cd apps/api
npm install

# 设置数据库
npx prisma migrate dev

# 创建初始 API Key（用于 CLI 登录）
sqlite3 prisma/dev.db "INSERT INTO api_keys (id, key, name, createdAt) VALUES ('init', 'abc123', 'dev', datetime('now'));"

# 启动服务
npm run dev
```

API 服务将在 http://localhost:3000 启动。

### 2. 安装 CLI 工具

```bash
cd packages/cli
npm install

# 方式一：本地运行
node bin/index.js --help

# 方式二：链接到全局（推荐）
npm link
hum --help
```

## CLI 使用指南

### 配置

```bash
# 设置 API 地址（如果后端不在默认 3000 端口）
hum config set apiUrl http://localhost:3001

# 查看配置
hum config list
```

### 认证

```bash
# 登录（需要有效的 API Key）
hum auth login --api-key abc123

# 查看登录状态
hum auth status

# 退出登录
hum auth logout
```

### 记录管理

```bash
# 添加记录
hum record add \
  --type custom \
  --data '{"weight":72.5}' \
  --tags weight,daily \
  --note "晨重"

# 列出记录（支持筛选）
hum record list --tag weight --last 7d
hum record list --start 2024-01-01 --end 2024-01-31

# 查看单条记录
hum record get --id <record-id>

# 更新记录
hum record update --id <record-id> --data '{"weight":71.8}'

# 搜索记录
hum record search --query "体重"

# 删除记录
hum record delete --id <record-id>
```

**记录类型**：`custom` | `medical` | `supplement` | `symptom` | `other`

**时间范围格式**：
- `7d` - 最近7天
- `2w` - 最近2周
- `1m` - 最近1月
- `3y` - 最近3年

### 时间线

```bash
# 查看最近时间线
hum timeline --last 7d

# 查看特定日期范围
hum timeline --start 2024-01-01 --end 2024-01-31
```

## API 文档

### 认证

所有 API 请求都需要在头部携带有效的 API Key：

```
Authorization: Bearer <your-api-key>
```

### 端点

#### 记录 (Records)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/records` | 获取记录列表 |
| POST | `/api/v1/records` | 创建新记录 |
| GET | `/api/v1/records/:id` | 获取单个记录 |
| PATCH | `/api/v1/records/:id` | 更新记录 |
| DELETE | `/api/v1/records/:id` | 删除记录 |
| GET | `/api/v1/records/search` | 搜索记录 |

#### 时间线 (Timeline)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/timeline` | 获取时间线数据 |

#### 认证 (Auth)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/verify` | 验证 API Key |

## 测试

### 端到端测试

```bash
cd packages/cli
npm run test:e2e
```

测试脚本会自动验证：
- 配置读写
- 登录/状态查询
- 记录的增删改查
- 时间线查询

**注意**：运行测试前请确保 API 服务已启动。

## 数据库

项目使用 Prisma ORM 进行数据库管理。数据库 schema 定义在 [apps/api/prisma/schema.prisma](/apps/api/prisma/schema.prisma) 中。

### 主要模型

- **Record** - 健康记录，包含类型、数据、标签、附件和日期
- **ApiKey** - API 访问密钥

### 常用命令

```bash
cd apps/api

npx prisma generate       # 生成 Prisma Client
npx prisma migrate dev    # 运行迁移
npx prisma studio         # 打开数据库管理界面
npx prisma db seed        # 运行种子脚本
```

## 开发命令

### API 服务

```bash
cd apps/api
npm run dev          # 开发模式
npm run build        # 生产构建
npm run start        # 生产启动
npm run lint         # 代码检查
```

### CLI 工具

```bash
cd packages/cli
node bin/index.js    # 本地运行
npm run test:e2e     # 运行端到端测试
```

## 常见问题

### Q: CLI 登录时提示 401？
A: 确认数据库中已存在有效的 API Key：
```bash
cd apps/api
sqlite3 prisma/dev.db "SELECT * FROM api_keys;"
```

### Q: 如何修改 API 端口？
A: 使用 `hum config set apiUrl http://localhost:新端口`

## 路线图

- [x] MVP1: 基础记录 CRUD + CLI
- [ ] MVP2: 体重专用命令、统计展示、数据导出
- [ ] MVP3: 趋势图表、数据可视化

## 许可证

ISC
