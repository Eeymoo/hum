# Proposal: xiaomi-data-rc4-encryption

## Why

上一个 change（`land-xiaomi-cloud-sync`，已归档）打通了小米运动健康的 QR 扫码登录链路，拿到了完整凭证（serviceToken / cUserId / ssecurity）。但实测调用健康数据 API（`GET /app/v1/data/get_project_data_by_time`）返回 `401 auth err`——

排查发现 `miapi.ts` 的 `healthApiGet` 用**明文 cookie + 明文 data 参数**调用，而小米健康数据 API 实际要求所有请求参数经过 **RC4 加密 + SHA1 签名**（密钥由登录时拿到的 `ssecurity` 派生），响应体同样是 RC4 加密需解密后才是 JSON。这导致数据同步功能（步数/睡眠/体重入库）完全不工作——登录通了，但拉不到任何数据。

两份逆向文档对此说法矛盾：`miapi.md`（反编译推测）说可明文调用，但 `miband-bot-api-analysis.md`（实际抓包验证）明确数据 API 必须走 RC4 加密。实测以抓包文档为准。该文档已提供完整的 TypeScript 伪代码（`_rc4_crypt` / `computeSignedNonce` / `buildEncryptedParams` / `encryptedRequest` / `decryptResponse`），可直接移植。

本变更实现 RC4 加密层，替换 `healthApiGet` 的明文调用，让数据同步真正跑通。

## What Changes

- 新增 `packages/web/lib/sync/mi-crypto.ts`：RC4 加解密（KSA + skip 1024 + PRGA）、nonce 生成、signedNonce 派生（SHA256）、签名消息构建、`buildEncryptedParams`（rc4_hash__ + 连续 RC4 流加密 + signature）、`decryptResponse`（响应解密）。
- 改造 `packages/web/lib/sync/sources/miapi.ts`：用新的加密请求函数替换 `healthApiGet` 的明文实现；调用 `buildEncryptedParams` 生成加密参数，通过 cookie（cUserId + serviceToken）发送，用 `ssecurity` + `_nonce` 解密响应。
- 同步方法的 4 个数据拉取点（步数、心率、睡眠、体重）统一走加密请求。
- 为加密层补单元测试（RC4 往返、签名稳定性、nonce 格式、已知向量校验）。
- 真实账号联调：用已绑定的凭证拉取最近 7 天数据，验证步数/睡眠/体重入库。

## Capabilities

### New Capabilities

<!-- 无新 capability，RC4 加密是 xiaomi-cloud-sync 数据同步的实现方式 -->

### Modified Capabilities

- `xiaomi-cloud-sync`: 修改"健康数据同步与映射"——数据 API 调用从明文改为 RC4 加密签名；新增"请求加密签名" requirement 描述 RC4/SHA1 签名机制与响应解密

## Impact

- **代码**：
  - `packages/web/lib/sync/mi-crypto.ts`（新增，约 150 行，移植自 analysis doc 伪代码）
  - `packages/web/lib/sync/sources/miapi.ts`（改造 `healthApiGet` 与 4 个数据拉取点）
  - `packages/web/__tests__/lib/mi-crypto.test.ts`（新增，RC4/签名测试）
- **依赖**：无新增（RC4 用 Node 内置 `crypto`，SHA1/SHA256/Base64 同样内置）
- **数据**：无 schema 变更，同步入库复用既有 sourceId 幂等机制
- **兼容**：纯实现层改造，登录链路（上一 change 已跑通）不受影响；已绑定的凭证（含 ssecurity）可直接用于加密
- **风险**：RC4 移植需与小米 App 行为逐字节一致（KSA 初始化、skip 1024、连续流加密多值共用一个密钥流），签名消息的参数排序与拼接格式必须精确；用真实账号的已知响应做向量校验降低风险
