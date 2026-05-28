# Hum

一个健康跟踪应用，提供 Web 管理面板、RESTful API 和命令行工具。

## 项目结构

```
hum/
├── apps/
│   └── api/                       # Next.js 应用（Web 前端 + API 服务）
│       ├── app/
│       │   ├── api/v1/            # RESTful API 端点
│       │   ├── dashboard/         # Web 数据管理面板
│       │   ├── login/             # 登录页
│       │   ├── register/          # 注册页
│       │   └── settings/          # 设置页
│       ├── lib/                   # 工具函数
│       ├── prisma/                # 数据库 schema 和迁移
│       └── messages/              # 国际化文件（中/英）
├── packages/
│   └── cli/                       # 命令行工具
├── skills/                        # Agent Skills 扩展
├── docs/                          # 项目文档
│   ├── cli.md                     # CLI 使用指南
│   ├── api.md                     # API 文档
│   ├── web.md                     # Web 面板说明
│   ├── database.md                # 数据库与部署
│   └── roadmap.md                 # 路线图
└── .github/workflows/             # CI/CD 工作流
```

## 技术栈

- **Web 前端**：React 19, Next.js 15, Tailwind CSS, ECharts
- **API 服务**：Next.js 15, TypeScript, Prisma ORM
- **认证**：NextAuth.js v5（GitHub / Google / 邮箱密码）
- **国际化**：next-intl（中文 / English）
- **CLI 工具**：Node.js, Commander.js
- **数据库**：SQLite（开发）/ PostgreSQL（生产）
- **部署**：Docker, GitHub Actions

## 快速开始

### 前置要求

- Node.js 18+

### 1. 启动 API 服务

```bash
cd apps/api
npm install
npx prisma migrate dev
npm run dev
```

服务将在 http://localhost:3000 启动。

### 2. 创建账号并获取 API Key

1. 浏览器访问 `http://localhost:3000`
2. 使用邮箱注册，或通过 GitHub / Google 登录
3. 进入 Dashboard → **API 密钥** → 创建新密钥

### 3. 安装并登录 CLI

```bash
cd packages/cli
npm install && npm link

hum auth login --api-key <your-api-key>
hum auth status
```

## 核心功能

### 健康数据追踪

| 维度 | Web 面板 | CLI 命令 | 统计图表 |
|------|----------|----------|----------|
| 体重 | `/dashboard/weight` | `hum weight` | 趋势折线图 |
| 运动 | `/dashboard/exercise` | `hum exercise` | 频率柱状图 |
| 饮食 | `/dashboard/diet` | `hum diet` | 营养素饼图 |
| 睡眠 | `/dashboard/sleep` | `hum sleep` | 时长/质量对比图 |
| 通用记录 | `/dashboard/records` | `hum record` | — |
| 时间线 | `/dashboard/timeline` | `hum timeline` | 聚合列表 |

### 认证方式

- **Web**：GitHub / Google OAuth、邮箱密码
- **CLI**：API Key、`--device` Device Flow

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/cli.md](docs/cli.md) | CLI 完整使用指南（所有命令和参数） |
| [docs/api.md](docs/api.md) | RESTful API 文档（所有端点和参数） |
| [docs/web.md](docs/web.md) | Web 面板功能说明 |
| [docs/database.md](docs/database.md) | 数据库模型、部署指南、环境变量 |
| [docs/roadmap.md](docs/roadmap.md) | 路线图和版本规划 |

## 常用命令

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

### 数据库

```bash
cd apps/api
npx prisma generate       # 生成 Prisma Client
npx prisma migrate dev    # 运行迁移
npx prisma studio         # 打开数据库管理界面
```

## 部署

```bash
# SQLite 模式（个人使用）
docker compose up -d

# PostgreSQL 模式（生产环境）
docker compose --profile postgres up -d
```

详见 [docs/database.md](docs/database.md)。

## 常见问题

**Q: CLI 登录时提示 401？**

A: 访问 `http://localhost:3000/dashboard/api-keys` 确认密钥有效且未过期。

**Q: CLI 提示主版本不兼容？**

A: CLI 与 API 主版本必须一致，请升级 CLI：

```bash
npm install -g hum-cli@latest
```

**Q: 如何修改 API 端口？**

A: `hum config set apiUrl http://localhost:<新端口>`

## Skills（技能扩展）

Hum CLI 支持 [Agent Skills](https://agentskills.io) 开放标准：

```bash
npx skills add eeymoo/hum/skills
```

| 技能 | 说明 |
|------|------|
| `hum-cli-guide` | CLI 使用指南 |

## 许可证

ISC
