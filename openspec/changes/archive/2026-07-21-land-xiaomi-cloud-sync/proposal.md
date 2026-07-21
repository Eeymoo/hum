# Proposal: land-xiaomi-cloud-sync

## Why

用户反馈"小米运动健康的接入存在问题"。排查结论：

1. **接入实现其实早已存在，但从未落地**：`origin/feat/sync-system` 分支（超前 main 19 个提交，+5644 行）已实现完整的小米运动健康云端自动同步——插件式同步架构、MiApiSource（密码/二维码/手动 Token 三种登录）、node-cron 定时调度、7 个 `/api/v1/sync/*` 路由、设置页 UI、`hum sync` CLI、4 张同步表与双库迁移、两份逆向分析文档（`miapi.md`、`miband-bot-api-analysis.md`）。而 main 上没有任何同步代码——用户实际使用的主线等于"没有接入"。
2. **分支停在未调通状态**：分支版本停留在 v0.1.31-alpha.8，最后一次提交是"添加二维码登录调试日志"，说明二维码登录链路仍在调试、未确认可用。
3. **分支上存在必须修复的缺陷**：
   - `SyncSourceConfig.token` 注释声称"加密后的认证凭证"，实际为**明文 JSON 落库**（小米账号 serviceToken/passToken 明文存储，泄露即等于账号被盗）；
   - 二维码会话使用内存 `Map` 保存，服务重启即丢失，且无 TTL 清理会泄漏内存；
   - CLI `sync.js` 绕过项目统一的 `request` 封装，用 `execSync('curl ...')` 拼请求（错误处理、超时、代理行为均不一致）；
   - 缺少任何自动化测试，合并质量无保障。

因此本变更的目标不是从零做接入，而是**修复这些问题并把已有的云端同步落地到 main**。

## What Changes

- 将 `feat/sync-system` 的同步系统合并进 main，解决与 main（v0.1.30）的冲突（package.json、prisma schema、settings 页、auth 等）。
- **修通登录链路**：以 `scripts/mi-login.sh` 手工验证密码登录全链路；用真实账号联调二维码登录（获取二维码 → 扫码 → 长轮询 → STS 换 serviceToken）；调试 `console.log` 收敛为结构化日志。
- **Token 加密存储**：`SyncSourceConfig.token` 落库前使用 AES-256-GCM 加密（密钥来自 `SYNC_TOKEN_SECRET` 环境变量），读取时解密；与注释承诺的行为对齐。
- **二维码会话治理**：内存会话增加 TTL（10 分钟）与定期清理；文档明确单实例部署限制。
- **CLI 重构**：`hum sync` 改用项目 `lib/api.js` 的 `request` 封装，移除 `execSync('curl')`。
- **补测试**：小米响应解析（`&&&START&&&` 前缀、签名计算）、同步引擎、登录/触发路由、幂等 upsert 的单元与 API 测试。
- 文档更新：`docs/api.md`、`docs/cli.md`、`docs/roadmap.md` 勾选同步项。

## Capabilities

### New Capabilities

- `xiaomi-cloud-sync`: 小米运动健康云端同步核心能力——三种认证方式（密码/二维码/手动 Token）、健康数据拉取与字段映射（步数/心率/睡眠/体重）、`sourceId + @@unique([date, sourceId])` 幂等写入、Token 过期自动刷新、node-cron 定时调度。
- `sync-management-api`: 同步管理 API（`/api/v1/sync/*`）的认证要求、同步配置的增删改查、手动触发、任务历史查询、登录发起与二维码轮询的行为与错误语义。
- `sync-settings-ui`: 设置页同步配置界面的行为——数据源展示、凭据绑定、二维码登录引导、同步开关与频率配置、任务历史展示。
- `sync-cli`: `hum sync` 命令的行为——手动触发、重新登录、任务历史查看、错误与未配置认证时的处理。

### Modified Capabilities

<!-- openspec/specs/ 当前为空，无既有 capability 需要修改 -->

## Impact

- **代码**（主要来自合并 `feat/sync-system` 并叠加修复）：
  - `packages/web/lib/sync/`（新增：types/registry/engine/scheduler/sources/miapi、qr-session、token 加密模块）
  - `packages/web/app/api/v1/sync/`（7 个新路由）
  - `packages/web/app/settings/sync/SyncSettings.tsx`、`packages/web/instrumentation.ts`、`packages/web/next.config.js`
  - `packages/cli/src/commands/sync.js`（重构）、`packages/cli/bin/index.js`
  - `packages/web/prisma/schema.prisma`：Weight/Exercise/Sleep/Diet 增加 `sourceId` 列与 `@@unique([date, sourceId])`；新增 UserSyncConfig/SyncSourceConfig/SyncJob/SyncLog 四表；sqlite + postgresql 双迁移
- **API**：新增 `/api/v1/sync/*` 一组端点（需认证；写操作需写权限）。
- **依赖**：`node-cron`（+`@types/node-cron`）；不引入新加密库（用 Node 内置 `crypto`）。
- **数据**：存量记录的 `sourceId` 为 NULL（两种数据库的唯一约束均视 NULL 互不相等），手动录入数据不受影响；无破坏性变更。
- **运维**：新增 `SYNC_TOKEN_SECRET` 环境变量；定时同步依赖长驻进程（standalone/Docker 部署可用，serverless 不可用，需文档声明）。
- **风险**：该通路基于逆向 API，存在小米风控/接口变更/服务条款风险，保留"手动导入 Token"作为登录失败时的兜底；`miapi.md` 等逆向文档随代码留存以便跟进上游变化。
