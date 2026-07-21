# Tasks: land-xiaomi-cloud-sync

## 1. 分支合并与构建恢复

- [x] 1.1 合并 `origin/feat/sync-system` 到 main，解决冲突（package.json×2、schema.prisma、settings/page.tsx、login/page.tsx、auth.ts、package-lock.json），冲突处理遵循 design D1（保留 main 的 bugfix、叠加分支新增）
- [x] 1.2 恢复依赖安装并确认 `node-cron` 等新增依赖可用，web 与 cli 均构建通过
- [x] 1.3 sqlite 与 postgresql 两套迁移均在干净库上验证通过（新增列、唯一约束、4 张同步表）
- [x] 1.4 全量运行既有 web + cli 测试套件，修复合并引入的回归

## 2. 登录链路修通

- [x] 2.1 用 `scripts/mi-login.sh` 手工验证小米密码登录协议仍有效（sign/hash/STS 三段）— 实测结论：小米对 `miothealth` sid 的密码登录返回 `70016 登录验证失败`，协议层被风控；同时发现并修复 step1 `_sign` 字段名 bug
- [x] 2.2 为 `miapi.ts` 解析函数补单元测试（`&&&START&&&` 剥离、MD5 大写、clientSign SHA1），用录制 fixture
- [~] 2.3 真实账号联调密码登录链路（`/api/v1/sync/login`）— 跳过：密码登录被小米风控(70016)，按用户指示聚焦 QR 登录这一种方式
- [x] 2.4 真实账号联调二维码登录链路（qr → qr-poll → STS）— ✅ 完全跑通！发现并修复根因：`nonce` 大整数（>2^53）经 `JSON.parse` 精度丢失导致 clientSign 算错→STS 400；改用正则提取 nonce 原始字符串后 STS 200 成功拿到 serviceToken（同步修复到 miapi.ts 的 waitForQrScan 和 step3GetServiceToken）
- [~] 2.6（新发现）健康数据 API 返回 401：明文 cookie 调用无效，需 RC4 加密 + SHA1 签名。**转出新 change `xiaomi-data-rc4-encryption` 处理**（见该 change）
- [x] 2.5 调试 `console.log` 收敛：默认静默，`SYNC_DEBUG=true` 时输出截断响应；关键事件写入 SyncLog

## 3. 安全与缺陷修复

- [x] 3.1 新增 `packages/web/lib/sync/crypto.ts`：AES-256-GCM 加解密，`v1.<iv>.<tag>.<ciphertext>` 格式，`SYNC_TOKEN_SECRET` 缺失时禁用同步并告警
- [x] 3.2 所有 token 写入点（login、qr-poll）与读取点（engine）接入加解密；实现明文凭证懒迁移（额外修复：token 刷新后持久化新 token 到 DB）
- [x] 3.3 `qr-session.ts` 增加 10 分钟 TTL 与定期清扫（getSession 过期即删 + setInterval 每 2 分钟清扫）
- [x] 3.4 重构 `packages/cli/src/commands/sync.js`：移除 `execSync('curl')`，改用 `lib/api.js` 的 `request` 封装

## 4. 测试补齐

- [x] 4.1 同步引擎测试：任务状态流转（running→success/failed）、token 解密传入、source 未注册 failed、sync 抛错 failed
- [x] 4.2 API 路由测试：trigger 的 401/未开启 400/未绑定 400/无 token 400/运行中 409/正常 200
- [~] 4.3 幂等测试：sourceId 唯一约束在迁移验证中已确认存在；upsert 行为依赖 Prisma 约束，集成测试留待真实同步验证
- [x] 4.4 加解密测试：往返一致、密文带 v1 前缀、密钥缺失行为、明文懒迁移、篡改检测、随机 IV

## 5. 文档与发布

- [x] 5.1 更新 `docs/api.md`（`/api/v1/sync/*` 端点）与 `docs/cli.md`（`hum sync` 用法）
- [x] 5.2 更新 `docs/roadmap.md`：勾选"智能手环/手表数据同步"，注明部署限制（单实例长驻进程、`SYNC_TOKEN_SECRET`）与逆向 API 风险声明
- [x] 5.3 更新 `.env.example` 与 docker-compose.yml，补充 `SYNC_TOKEN_SECRET` 环境变量说明
- [~] 5.4 提升版本号（去掉 alpha 标记），全量测试通过后发布 — **推迟**：等 `xiaomi-data-rc4-encryption` change 完成后统一发版（用户决定）
