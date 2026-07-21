# xiaomi-cloud-sync

## MODIFIED Requirements

### Requirement: 健康数据同步与映射

系统 SHALL 从小米健康 API（`hlth.io.mi.com/app/v1/data/*`）拉取指定时间范围（默认最近 7 天）的步数、心率、睡眠、体重数据，并映射写入 Exercise、Sleep、Weight 表。所有数据 API 请求 MUST 经过 RC4 加密签名（见"请求加密签名" requirement），明文调用 MUST NOT 被使用。睡眠起止时间 MUST 映射为 `bedTime`/`wakeTime` 并计算时长；体重数据 MUST 映射体重值及可得的体脂等字段；拉取失败的数据类型 MUST 记录错误且不中断其他类型。

#### Scenario: 全量类型同步成功

- **WHEN** 用户凭证有效并触发同步
- **THEN** 系统经 RC4 加密请求分别拉取运动、睡眠、体重数据，解密响应后创建/更新对应记录，并返回各类型同步条数

#### Scenario: 单一类型失败不影响其他类型

- **WHEN** 体重数据接口异常但睡眠接口正常
- **THEN** 睡眠记录正常写入，结果中体重计 0 条且 errors 含体重错误原因

#### Scenario: 明文调用被拒绝

- **WHEN** 同步逻辑尝试用明文参数调用数据 API
- **THEN** 小米返回 401 auth err，系统经加密请求重试后成功（明文路径不可用是既定事实，代码中 MUST NOT 保留明文调用）

## ADDED Requirements

### Requirement: 请求加密签名

系统 SHALL 对所有小米健康数据 API 请求实施 RC4 加密 + SHA1 签名，与小米运动健康 App 行为一致。加密流程 MUST 为：生成 nonce（base64(8 随机字节 + 4 字节分钟数大端序)）→ 派生 signedNonce（base64(SHA256(b64decode(ssecurity) + b64decode(nonce)))）→ 计算明文参数的 rc4_hash__（SHA1 签名消息）→ 插入 rc4_hash__ 后对所有值按 key 字典序用连续 RC4 流（drop 1024）加密 → 用密文参数计算 signature（SHA1）。请求 MUST 携带 `signature` 与 `_nonce` 参数，通过 Cookie（cUserId + serviceToken）认证。响应体 MUST 用同一 nonce 的 signedNonce 经 RC4 解密为 JSON。签名消息格式 MUST 为 `METHOD&/path&k1=v1&...&signedNonce`（method 大写、path 带前导 /、参数字典序）。

#### Scenario: 加密请求被小米接受

- **WHEN** 系统用有效凭证与正确的 RC4 加密签名调用数据 API
- **THEN** 小米返回 200，响应经 RC4 解密后为含健康数据的合法 JSON（code=0）

#### Scenario: RC4 实现逐字节对齐 App

- **WHEN** 用固定 nonce 与 ssecurity 对已知参数加密
- **THEN** 产出的 signature 与 rc4_hash__ 确定且稳定（同输入同输出），KSA/skip 1024/连续流加密行为与小米 App 一致

#### Scenario: 响应解密

- **WHEN** 数据 API 返回 RC4 加密的响应体
- **THEN** 系统用请求时的 _nonce 重新派生 signedNonce 解密，得到 code=0 的 JSON；解密失败时给出明确错误而非吞掉

#### Scenario: 缺少 ssecurity 时拒绝请求

- **WHEN** 凭证缺少 ssecurity（无法派生加密密钥）
- **THEN** 系统不发起请求，直接返回"未登录/凭证不完整"错误
