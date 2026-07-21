# Design: xiaomi-data-rc4-encryption

## Context

上一 change 已让 `miapi.ts` 能通过 QR 扫码登录拿到 `{serviceToken, cUserId, ssecurity, ...}`。但 `healthApiGet` 用明文 cookie + `?data=<JSON>` 调用 `hlth.io.mi.com/app/v1/data/*` 返回 `401 auth err`。

`miband-bot-api-analysis.md`（§2.2）给出了经实际抓包验证的加密协议，与小米运动健康 App 行为逐字节一致：

- **认证**：Cookie `cUserId + serviceToken`（身份）
- **请求签名/加密**：参数经 RC4（skip=1024）+ SHA1 签名，密钥流由 `signedNonce = base64(SHA256(b64decode(ssecurity) + b64decode(nonce)))` 派生
- **响应**：同样 RC4 加密，用同一 `signedNonce` 解密后才是 JSON

文档已提供完整 TypeScript 伪代码（`_rc4_crypt` / `generateNonce` / `computeSignedNonce` / `buildSigMessage` / `buildEncryptedParams` / `encryptedRequest` / `decryptResponse`），本变更将其落地为可运行代码。

## Goals / Non-Goals

**Goals:**

- 实现 RC4 加密层，替换 `healthApiGet` 明文调用。
- 用真实绑定的凭证拉取最近 7 天步数/睡眠/体重并入库（sourceId 幂等）。
- 加密层有单元测试覆盖（RC4 往返、签名稳定性、向量校验）。

**Non-Goals:**

- 不改登录链路（上一 change 已跑通）。
- 不改数据库 schema（复用既有 sourceId 幂等）。
- 不实现 analysis doc §4 提及的"方案 A CLI / 方案 C TS 全量移植"等周边——只做数据拉取必需的加密层。
- 不做请求重试/退避策略（既有 `withRetry` 只处理 401 刷新，保持不变）。

## Decisions

### D1：加密层独立成模块 `lib/sync/mi-crypto.ts`

把纯加密逻辑（RC4/nonce/signature）从 `miapi.ts` 抽出，理由：
- 可独立单测（输入输出确定，不依赖网络/Prisma）；
- `miapi.ts` 只保留数据源业务逻辑（登录、同步编排、字段映射）；
- 与既有 `lib/sync/crypto.ts`（AES 凭证加密）职责清晰分离——`crypto.ts` 管本地落库加密，`mi-crypto.ts` 管与小米服务器的协议加密。

导出：`buildEncryptedParams(method, path, ssecurity, params)` 与 `decryptResponse(ssecurity, nonce, ciphertext)`，以及内部函数（供测试）`rc4Crypt`、`generateNonce`、`computeSignedNonce`、`buildSigMessage`。

### D2：RC4 实现严格对齐文档（KSA + skip 1024 + 连续流）

关键正确性点（任一偏差即签名失败）：

1. **KSA**：标准 RC4 密钥调度，`j = (j + s[i] + key[i % key.length]) & 0xFF`。
2. **skip 1024**：生成密钥流前丢弃前 1024 字节（RC4-drop[1024]，防密钥流开头弱点）。
3. **连续流加密多值**：`buildEncryptedParams` 中多个参数值（data、rc4_hash__）**共用同一个 RC4 密钥流**（不是每个值重新初始化）。按 key 字典序排序后顺序加密，密钥流连续推进。
4. **rc4_hash__ 在加密前插入**：基于明文参数计算 `SHA1(sigMessage).base64`，放入 TreeMap 后再整体加密。
5. **signature 基于密文计算**：加密完成后再用密文参数算 `SHA1(sigMessage).base64` 作为 signature。

### D3：签名消息格式 `METHOD&/path&k1=v1&...&signedNonce`

严格按文档 `buildSigMessage`：
- method 大写；
- path 带前导 `/`；
- 参数按 key 字典序（`localeCompare`）；
- 末尾追加 signedNonce（base64）；
- 全部用 `&` 连接。

路径特殊处理：文档提到 `/healthapp/service/gen_download_url` 签名时用 `/service/gen_download_url`。本变更涉及的数据端点（`/app/v1/data/get_project_data_by_time` 等）按原路径签名，不做改写。

### D4：encryptedRequest 封装替换 healthApiGet

新函数 `encryptedHealthGet(token, endpoint, params)`：
1. 调 `buildEncryptedParams('GET', '/app/v1/' + endpoint, token.ssecurity, params)` 得到 `{...encryptedValues, signature, _nonce}`；
2. `fetch(url, { headers: { Cookie: cUserId + serviceToken } })`，加密参数作为 query string；
3. 响应文本先 `parseMiResponse` 去 `&&&START&&&` 前缀，再 `decryptResponse(ssecurity, _nonce, body)`；
4. 401 → 抛错触发上层 `withRetry` 的 token 刷新；
5. 业务码 `code !== 0` → 抛带 code/desc 的错误。

`miapi.ts` 的 4 个数据拉取点（steps/heart_rate/sleep/weight）改调此函数。`healthApiGet`（明文版）删除。

### D5：响应解密细节

`decryptResponse`：响应体是 RC4 加密的 base64 字符串（外层可能还有 `&&&START&&&` 前缀，先剥离）。用请求时同一个 `_nonce` 重新算 `signedNonce`，RC4 解密（RC4 对称，加解密同函数）得 JSON 明文。

注意：响应解密用的 signedNonce 与请求加密用的是**同一个 nonce**（请求时生成的 `_nonce`），不是重新生成。

## Risks / Trade-offs

- [RC4 实现与 App 逐字节不一致 → 签名失败 401/400] → 用真实账号已知的成功响应做向量校验（analysis doc 风险评估 §4.4 标注"签名算法 TS 移植难度中"）；加密函数配单测，用固定 nonce/ssecurity 产出确定性 signature 比对。
- [连续流加密的边界（哪些值参与、排序）出错] → 严格按文档"按 key 字典序排序后顺序加密"，单测覆盖多值场景。
- [响应格式因端点而异（有的端点不加密）] → 数据端点（`/app/v1/data/*`）确认是加密的；若个别端点返回明文 JSON，`decryptResponse` 解密失败时 fallback 尝试直接 JSON.parse 并告警。
- [小米接口/风控变化] → 与上一 change 一致，保留手动 token 导入兜底；错误信息显式区分加密失败 vs 业务错误。

## Migration Plan

纯代码层改造，无数据/schema 变更。部署顺序：合并代码 → 跑测试 → 用真实凭证联调数据拉取。回滚 = 还原 `healthApiGet` 明文版（但明文本就 401 不可用，回滚无实际意义）。

## Open Questions

- 响应体是否恒为 RC4 加密：联调时确认；若部分响应为明文需加 fallback。
- `get_project_data_by_time` 返回的各 dataType 字段结构（STEPS/SLEEP/BODY_WEIGHT 的 items 形态）需联调时核对，可能需微调 `miapi.ts` 既有字段映射。
