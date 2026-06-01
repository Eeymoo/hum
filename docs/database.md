# 数据库与部署

## 数据库

项目使用 Prisma ORM 进行数据库管理。Schema 定义在 `packages/web/prisma/schema.prisma` 中。

### 数据模型

| 模型 | 说明 | 关键字段 |
|------|------|----------|
| **User** | 用户账号 | `email`, `name`, `avatar` |
| **Account** | 第三方账号关联 | `provider`, `providerAccountId`, `password` |
| **ApiKey** | API 访问密钥 | `key`, `name`, `lastUsed` |
| **Weight** | 体重记录 | `weight`, `bodyFat`, `muscleMass`, `bmi`, `water`, `boneMass`, `visceralFat` |
| **Exercise** | 运动记录 | `type`, `duration`, `caloriesBurned`, `activities`, `heartRateAvg`, `heartRateMax`, `feeling` |
| **Diet** | 饮食记录 | `mealType`, `calories`, `protein`, `carbs`, `fat`, `fiber`, `sodium`, `foods`, `water` |
| **Sleep** | 睡眠记录 | `duration`, `bedTime`, `wakeTime`, `quality`, `deepSleep`, `remSleep`, `awakenings`, `feeling` |
| **Record** | 通用健康记录 | `type`, `data`, `tags`, `note`, `attachments` |
| **DeviceCode** | Device Flow 授权码 | `deviceCode`, `userCode`, `status`, `expiresAt` |
| **AccessToken** | OAuth Access Token | `token`, `userId`, `expiresAt` |

所有模型均支持软删除（`deleteAt` 字段，0 为未删除）。

### 数据库切换

项目支持 SQLite 和 PostgreSQL 双数据库：

```bash
cd packages/web

# SQLite（本地开发默认）
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev

# PostgreSQL（生产环境）
DATABASE_URL="postgresql://user:pass@localhost:5432/hum" npx prisma migrate dev
```

运行时通过 `DB_TYPE` 环境变量自动切换：

```bash
DB_TYPE=sqlite      # 使用 SQLite
DB_TYPE=postgresql  # 使用 PostgreSQL
```

### 常用命令

```bash
cd packages/web

npx prisma generate       # 生成 Prisma Client
npx prisma migrate dev    # 开发环境运行迁移
npx prisma migrate deploy # 生产环境运行迁移
npx prisma studio         # 打开数据库管理界面
npx prisma db push        # 推送 schema 到数据库
npx prisma db pull        # 从数据库拉取 schema
```

### 迁移目录

- `prisma/migrations_sqlite/` — SQLite 迁移文件
- `prisma/migrations_postgresql/` — PostgreSQL 迁移文件

## Docker 部署

### 快速启动

```bash
# SQLite 模式（适合个人使用）
docker compose up -d

# PostgreSQL 模式（适合生产环境）
docker compose --profile postgres up -d
```

### 构建镜像

```bash
cd packages/web
docker build -t hum-api .
```

Dockerfile 采用多阶段构建：
1. **deps** — 安装依赖
2. **builder** — 构建应用，预生成 SQLite 和 PostgreSQL 的 Prisma Client
3. **runner** — 生产镜像，运行迁移后启动服务

### 环境变量

| 变量 | 说明 | 必需 | 示例 |
|------|------|------|------|
| `DATABASE_URL` | 数据库连接字符串 | 是 | `file:./prisma/dev.db` |
| `DB_TYPE` | 数据库类型 | 是 | `sqlite` / `postgresql` |
| `AUTH_SECRET` | NextAuth 加密密钥 | 是 | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 服务访问地址 | 是 | `http://localhost:3000` |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | 否 | — |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | 否 | — |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | 否 | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | 否 | — |

### Docker Compose 服务

| 服务 | 镜像 | 说明 |
|------|------|------|
| `hum-api` | `ghcr.io/eeymoo/hum-api` | API 服务 |
| `hum-postgres` | `postgres:16-alpine` | PostgreSQL 数据库（可选） |

## CI/CD

GitHub Actions 工作流 `.github/workflows/release.yml`：

```mermaid
graph LR
    A[Push Tag v*.*.*] --> B[提取版本号]
    B --> C[同步 CLI 版本]
    C --> D[发布到 npm]
    B --> E[同步 API 版本]
    E --> F[构建 Docker 镜像]
    F --> G[推送到 ghcr.io]
```

- **publish-npm**：发布 CLI 包到 npm（`@eeymoo/hum`）
- **publish-docker**：构建并推送 API Docker 镜像到 GitHub Container Registry

## 测试

### 端到端测试

```bash
cd packages/cli
npm run test:e2e
```

测试覆盖：
- 配置读写
- API Key 登录 / Device Flow 登录
- 体重、运动、饮食、睡眠的增删改查与统计
- 通用记录的增删改查与搜索
- 时间线查询

**注意**：运行测试前请确保 API 服务已启动。
