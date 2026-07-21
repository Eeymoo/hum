# Design: land-xiaomi-cloud-sync

## Context

`origin/feat/sync-system` 已实现完整的小米运动健康云端同步（+5644 行，19 个提交，停在 v0.1.31-alpha.8），包含：

- `packages/web/lib/sync/`：`SyncSource` 插件接口、`SyncRegistry` 注册中心、`SyncEngine` 执行引擎、`SyncScheduler`（node-cron，经 `instrumentation.ts` 在服务启动时初始化）、`MiApiSource`（逆向 `hlth.io.mi.com`，密码/二维码/手动 Token 三种登录，passToken 自动刷新 serviceToken）
- 7 个 `/api/v1/sync/*` 路由、699 行 `SyncSettings.tsx`、`hum sync` CLI
- Prisma：Weight/Exercise/Sleep/Diet 加 `sourceId` + `@@unique([date, sourceId])`；新增 UserSyncConfig/SyncSourceConfig/SyncJob/SyncLog；sqlite + postgresql 迁移已备
- 逆向文档 `miapi.md`（APK 反编译）与 `miband-bot-api-analysis.md`，调试脚本 `scripts/mi-login.sh`

分支未合并的原因与阻塞点：二维码登录链路仍在调试（最后提交加调试日志）；存在明文 Token 存储等缺陷；main 已演进到 v0.1.30，两边在 package.json、schema.prisma、settings 页等文件上有分叉。

## Goals / Non-Goals

**Goals:**

- 把同步系统合并进 main 并可正常构建、通过既有测试。
- 密码登录与二维码登录两条链路用真实小米账号验证通过；手动 Token 导入作为兜底保持可用。
- Token 加密落库；调试日志收敛；CLI 走统一封装；二维码会话有 TTL。
- 关键路径（解析、引擎、路由、幂等）有自动化测试。

**Non-Goals:**

- 不重新设计同步架构（插件式架构已合理，直接沿用）。
- 不支持 serverless 部署的定时同步（cron 需长驻进程，仅文档声明限制）。
- 不新增华为/OPPO/vivo 等其他厂商数据源（架构已预留，另行立项）。
- 不做增量同步之外的实时推送、不做高频心率/GPS 逐点数据。

## Decisions

### D1：合并策略 = 变基修复后直接合入，不 squash 历史

分支 19 个提交记录了登录方案的演进（密码 → 砍 MiFitness 源 → 二维码 → 手动 Token 兜底），保留历史有助于回溯逆向决策。操作：`git merge origin/feat/sync-system`（或 rebase 后 ff），预期冲突点在 `packages/web/package.json`、`packages/cli/package.json`、`packages/web/prisma/schema.prisma`、`packages/web/app/settings/page.tsx`、`packages/web/app/login/page.tsx`、`packages/web/auth.ts`、`package-lock.json`。冲突原则：保留 main 的 bugfix（如 refresh_token 保存修复、邮箱格式统一），叠加分支的新增块；版本号以 main 为准、合并后统一提升。

### D2：Token 加密 = AES-256-GCM + 环境变量密钥

新增 `packages/web/lib/sync/crypto.ts`：`encryptToken(json) / decryptToken(str)`，AES-256-GCM，密钥取自 `SYNC_TOKEN_SECRET`（至少 32 字节，启动时校验缺失则同步功能禁用并告警，不阻塞主应用）。密文格式 `v1.<iv>.<tag>.<ciphertext>`（base64），带版本前缀便于将来轮换。写入点收敛在 engine 读、各 login 路由写两处；明文迁移：读取时按"能 JSON.parse 则为旧明文、迁移重写为密文"的懒迁移策略，避免一次性迁移脚本。**不**用 next-auth 的 jose（仅面向 JWT），直接用 Node `crypto`。

### D3：登录链路修复方法 = 脚本先行、逐段验证

逆向链路不适合盲改。顺序：

1. 先用 `scripts/mi-login.sh` 手工跑通密码登录（脱离代码验证小米侧协议未变）；
2. 再对照 `miapi.md` 逐段单测 `miapi.ts` 的解析函数（`&&&START&&&` 剥离、clientSign SHA1、Header 提取 passToken/serviceToken），用录制的响应 fixture；
3. 二维码链路用真实账号联调，重点核对 `waitForQrScan` 的 STS 交换（分支最后正卡在这里，已有调试日志可对照）；
4. 调试 `console.log` 收敛为 `SyncLog` 表 + 统一 logger，响应体截断保留（调试需要）但默认只在 `SYNC_DEBUG=true` 时输出。

### D4：二维码会话保持内存态 + TTL，不落库

`qr-session.ts` 的内存 `Map` 增加 10 分钟 TTL 与定时清扫（复用 scheduler 的 cron 或简单 setInterval）。不落库的理由：二维码会话生命周期只有几分钟，且部署目标是单实例 standalone/Docker；多实例问题在文档中声明限制即可。同理，node-cron 调度器本身也只适用于单实例长驻进程。

### D5：CLI 重构为统一 `request` 封装

`sync.js` 删除全部 `execSync('curl ...')`，改用 `packages/cli/src/lib/api.js` 的 `request()`（已有鉴权、错误处理、超时行为），与项目其他命令一致。

### D6：幂等机制沿用分支设计

`sourceId` 列 + `@@unique([date, sourceId])` + upsert 已能满足"重复同步不重复入库"。存量手动记录 `sourceId` 为 NULL，sqlite 与 postgresql 的唯一约束都将 NULL 视为互不相等，不与同步记录冲突。唯一需要注意：同一天手动记录与同步记录会并存（判定为可接受——来源不同，语义不同）。

## Risks / Trade-offs

- [小米风控或接口变更导致登录/同步失效] → 手动 Token 导入兜底长期保留；`miapi.md` 逆向文档随库留存；错误信息显式区分"风控拦截/二次验证/密码错误"，便于用户自助处理。
- [逆向 API 的服务条款风险] → 个人自用工具定位，文档中声明风险由使用者承担；不批量抓取他人数据。
- [合并引入回归（main 已有 100+ 测试）] → 合并后全量跑 web + cli 测试套件；schema 冲突仔细核对（main 与分支都改过 schema）。
- [密钥丢失导致已存密文 Token 不可解密] → 解密失败时视为"需重新登录"，提示用户重新绑定；文档强调备份 `SYNC_TOKEN_SECRET`。
- [内存态调度器/会话在多实例下行为错误] → 文档明确单实例限制；不为此引入 Redis 等外部依赖（过度设计）。

## Migration Plan

1. 合并分支并解决冲突 → 跑通构建与既有测试；
2. 执行 prisma 迁移（sqlite 与 postgresql 各自验证）；
3. 部署时新增 `SYNC_TOKEN_SECRET`；旧明文 Token 懒迁移；
4. 登录链路联调通过后发布正式版（去掉 alpha 标记）。
回滚：同步功能由 `UserSyncConfig.enabled` 总开关控制，关闭即回到无同步状态；数据库新增列与表为纯增量，回滚代码不破坏存量数据。

## Open Questions

- 二维码登录当前具体卡在 STS 交换的哪一步，需联调时以分支上的调试日志输出确认（可能的小米侧响应格式变化）。
- `SyncJob.result` 中 diet 计数恒为 0（小米数据源无饮食数据），首版保留字段不实现。
