# Hum 健康追踪应用 — 问题修复计划

> 审查日期：2026-05-28
> 基于项目全量代码审查，按优先级排列

---

## 修复优先级总览

| 编号 | 优先级 | 问题 | 涉及文件 | 复杂度 |
|------|--------|------|-----------|--------|
| #1 | ~~P0~~ ✅ | ~~文件下载路径遍历漏洞~~ | `files/[type]/[filename]/route.ts` | 中 |
| #2 | ~~P0~~ ✅ | ~~锁定 Prisma 版本避免意外升级~~ | `package.json` | 低 |
| #3 | ~~P1~~ ✅ | ~~API 查询缺少 userId 过滤~~ | 所有 v1 GET 路由（10+ 文件） | 高 |
| #4 | ~~P1~~ ✅ | ~~POST 路由缺少输入验证~~ | 所有 v1 POST 路由 | 中 |
| #5 | ~~P1~~ ✅ | ~~DELETE 路由缺少 userId 校验~~ | 所有 v1 `[id]/route.ts` | 中 |
| #6 | ~~P2~~ ✅ | ~~设备认证改用数据库存储~~ | `device/route.ts`, `device-auth.ts`, `token/route.ts` | 高 |
| #7 | ~~P2~~ ✅ | ~~Access Token 定期清理~~ | `device-auth.ts` | 低 |
| #8 | ~~P3~~ ✅ | ~~添加移动端导航菜单~~ | `dashboard/layout.tsx` | 低 |
| #9 | ~~P3~~ ✅ | ~~Settings 页面功能补全~~ | `settings/page.tsx` | 中 |
| #10 | ~~P3~~ ✅ | ~~错误提示与加载状态优化~~ | 各 dashboard 页面 | 低 |
| #11 | ~~P4~~ ✅ | ~~移除未使用的导入~~ | weights/exercises/diets route.ts | 低 |
| #12 | ~~P4~~ ✅ | ~~完善环境变量文档~~ | `env.example` | 低 |
| #13 | ~~P4~~ ✅ | ~~bcrypt salt rounds 调整~~ | `register/route.ts` | 低 |

---

## P0 — 安全漏洞（建议立即修复）

### #1 [P0] ✅ 已修复 — 文件下载路径遍历漏洞

- **文件**: `app/api/v1/files/[type]/[filename]/route.ts`
- **风险**: 攻击者可通过 `../../../etc/passwd` 等路径读取服务器任意文件
- **方案**:
  - 对 `filename` 做规范化处理，使用 `path.resolve` 后验证路径仍在 `uploads/` 目录内
  - 拒绝包含 `..` 的文件名
  - 校验文件名格式（应为 `uuid-originalName` 形式）

```typescript
// 示例修复
import { resolve, normalize, relative } from 'path'

const UPLOAD_DIR = resolve(process.cwd(), 'uploads')

function isSafePath(type: string, filename: string): boolean {
  const resolved = resolve(UPLOAD_DIR, type, filename)
  return resolved.startsWith(UPLOAD_DIR)
}
```

### #2 [P0] ✅ 已修复 — 锁定 Prisma 版本避免意外升级

- **文件**: `package.json`
- **风险**: `^5.0.0` 范围允许升级到 Prisma 7，当前 schema 不兼容
- **方案**:
  - 将 `prisma` 和 `@prisma/client` 锁定到 `5.22.0`（或当前实际安装版本）
  - 如计划升级 Prisma 7，需同步迁移 schema 配置到 `prisma.config.ts`

---

## P1 — ~~数据隔离与输入校验~~ ✅ 已修复

### #3 [P1] ✅ 已修复 — API 查询缺少 userId 过滤

- **文件**: 所有 `app/api/v1/*/route.ts` 的 GET handler
- **风险**: 已认证用户可查看所有用户的数据
- **涉及路由**:
  - `weights/route.ts`
  - `exercises/route.ts`
  - `diets/route.ts`
  - `sleeps/route.ts`
  - `records/route.ts`
  - `timeline/route.ts`
  - 对应的 `stats/route.ts` 和 `[id]/route.ts`
- **方案**: 在所有 `where` 条件中加入 `userId: authResult.userId`

```typescript
// 修复前
const where: any = {}
if (!includeDeleted) { where.deleteAt = 0 }

// 修复后
const where: any = { userId: authResult.userId }
if (!includeDeleted) { where.deleteAt = 0 }
```

### #4 [P1] ✅ 已修复 — POST 路由缺少输入验证

- **文件**: 所有 `app/api/v1/*/route.ts` 的 POST handler
- **风险**: 必填字段缺失或格式错误会导致数据库写入异常
- **方案**:
  - 在数据创建前验证必填字段存在且有效
  - 对数值字段做 `NaN` 检查
  - 统一提取验证逻辑到工具函数

```typescript
// 示例：weights POST 修复
const weightStr = formData.get('weight') as string
if (!weightStr || isNaN(parseFloat(weightStr))) {
  return NextResponse.json({ error: 'weight is required and must be a number' }, { status: 400 })
}
```

### #5 [P1] ✅ 已修复 — DELETE 路由补充 userId 校验

- **文件**: 所有 `app/api/v1/*/[id]/route.ts`
- **风险**: 用户可删除其他用户的数据
- **方案**: 删除操作前确认记录属于当前用户

```typescript
const existing = await prisma.weight.findFirst({
  where: { id: params.id, userId: authResult.userId }
})
if (!existing) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
```

---

## P2 — ~~认证机制持久化改造~~ ✅ 已修复

### #6 [P2] ✅ 已修复 — 设备认证改用数据库存储

- **文件**:
  - `app/api/v1/auth/device/route.ts`（device codes）
  - `lib/device-auth.ts`（access tokens）
  - `app/api/v1/auth/device/token/route.ts`（token 交换）
- **问题**: 内存存储在多实例/重启后丢失，且跨模块通过 `(global as any)` 访问不可靠
- **方案**:

  **方案 A — 数据库存储（推荐）**:
  - 新增 Prisma model `DeviceCode` 和 `AccessToken`
  - 在 schema.prisma 中添加：

    ```prisma
    model DeviceCode {
      id          String   @id @default(uuid())
      deviceCode  String   @unique
      userCode    String   @unique
      status      String   @default("pending")
      userId      String?
      expiresAt   DateTime
      createdAt   DateTime @default(now())
      @@map("device_codes")
    }

    model AccessToken {
      id        String   @id @default(uuid())
      token     String   @unique
      userId    String
      expiresAt DateTime
      createdAt DateTime @default(now())
      @@map("access_tokens")
    }
    ```

  - 重写 `device/route.ts`、`device/token/route.ts`、`device-auth.ts` 使用 Prisma 读写 ✅

  **方案 B — Redis 存储**:
  - 适合高并发场景，利用 Redis TTL 自动过期
  - 需要额外引入 Redis 依赖

### #7 [P2] ✅ 已修复 — Access Token 定期清理

- **文件**: `lib/device-auth.ts`
- **问题**: 过期 token 仅被动删除，长期运行会内存泄漏
- **方案**: 数据库持久化已完成，查询时通过 `expiresAt` 条件自动过滤过期记录；GET 端点中主动清理过期 device codes
- **实施**: `device-auth.ts` 中 `validateAccessToken` 查询时检测过期并删除；`device/route.ts` 的 GET handler 中批量清理过期记录

---

## P3 — ~~UI/UX 完善~~ ✅ 已修复

### #8 [P3] ✅ 已修复 — 添加移动端导航菜单

- **文件**: `app/dashboard/layout.tsx`, `app/dashboard/MobileNav.tsx`（新增）
- **方案**:
  - 新建客户端组件 `MobileNav.tsx`，使用 `useState` 管理菜单开关状态
  - 添加 hamburger 按钮（`sm:hidden`），带 SVG 图标切换（☰ ↔ ✕）
  - 菜单以折叠面板形式展示，带 `transition-all` 动画
  - 支持点击外部关闭（`useRef` + `mousedown`）和路由变更自动关闭（`usePathname`）
  - 包含全部 9 个导航链接，高亮当前活跃路由

### #9 [P3] ✅ 已修复 — Settings 页面功能补全

- **文件**: `app/settings/page.tsx`, `app/settings/ExportButton.tsx`（新增）
- **问题**:
  - "Export Data" 按钮无功能
  - 头像使用原生 `<img>` 而非 Next.js `<Image>`
- **方案**:
  - 新建客户端组件 `ExportButton.tsx`，并发请求 5 个 API 端点（weights/exercises/diets/sleeps/records），使用 `Promise.allSettled` 容错，生成 JSON 文件下载
  - 按钮带 loading/success/error 三种状态反馈
  - 头像替换为 `next/image` 的 `<Image>` 组件，设置 `width={64}` `height={64}`

### #10 [P3] ✅ 已修复 — 优化错误提示与加载状态

- **文件**: 各 dashboard 页面 (`weight/page.tsx`, `exercise/page.tsx`, `diet/page.tsx`, `sleep/page.tsx`, `records/page.tsx`, `timeline/page.tsx`)
- **方案**:
  - 将 `<div>Loading...</div>` 替换为与页面布局匹配的 skeleton UI（`animate-pulse` 灰色占位块）
  - 新增 `error` state，数据加载失败时显示红色警告横幅（含重试按钮）
  - 新增 `submitError` state，表单提交失败时在按钮上方显示错误信息
  - 各页面 skeleton 数量与实际布局一致（4/3/2 列卡片 + 图表区 + 列表项）

---

## P4 — 代码清理与优化

### #11 [P4] ✅ 已修复 — 移除未使用的导入

- **文件**:
  - `app/api/v1/weights/route.ts` — 移除 `deleteFile`
  - `app/api/v1/exercises/route.ts` — 移除 `deleteFile`
  - `app/api/v1/diets/route.ts` — 移除 `deleteFile`

### #12 [P4] ✅ 已修复 — 完善环境变量文档

- **文件**: `env.example`
- **方案**: 补充所有必需的环境变量及说明：

  ```env
  # 数据库
  DATABASE_URL="file:./dev.db"

  # NextAuth
  AUTH_SECRET="your-secret-key"
  NEXTAUTH_URL="http://localhost:3000"

  # GitHub OAuth（可选）
  GITHUB_CLIENT_ID=""
  GITHUB_CLIENT_SECRET=""

  # Google OAuth（可选）
  GOOGLE_CLIENT_ID=""
  GOOGLE_CLIENT_SECRET=""
  ```

### #13 [P4] ✅ 已修复 — bcrypt salt rounds 调整

- **文件**: `app/api/auth/register/route.ts`
- **方案**: 将 salt rounds 从 `12` 调整为 `10`，平衡安全性与性能

---

## 执行建议

```
Week 1: P0（安全修复）→ 部署上线
Week 2: P1（数据隔离 + 输入校验）→ 部署上线
Week 3: P2（认证持久化）→ 需数据库迁移，充分测试后部署
Week 4: P3 + P4（UI 完善 + 代码清理）
```

每个阶段完成后建议：
1. 运行 `npm run build` 确认无编译错误
2. 手动测试核心流程（注册、登录、数据 CRUD、API Key 认证）
3. 提交代码并打 tag
