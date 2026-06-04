# miband-bot 小米运动健康 API 逆向分析报告

> 分析对象: [iAlexeyRu/miband-bot](https://github.com/iAlexeyRu/miband-bot) 的 `mi-fitness-python` SDK 模块
> 分析范围: 仅关注 API 调用与认证逻辑，排除 Telegram Bot UI 层

---

## 1. API 端点清单

### 1.1 基础信息

| 配置项 | 值 |
|--------|------|
| API 基础 URL | `https://ru.hlth.io.mi.com` (俄罗斯/海外节点) |
| 国内节点 | `https://hlth.io.mi.com` (推测) |
| 认证方式 | Cookie (`cUserId` + `serviceToken`) + RC4 加密 |
| 加密算法 | RC4 (skip=1024) + SHA1 签名 |
| 密钥来源 | 登录时获取的 `ssecurity` (Base64 编码的随机密钥) |
| User-Agent | `Android-12-3.53.1-vivo-V2284A` |
| 区域标识 | `region_tag: ru` |

### 1.2 认证端点 (小米账号 OAuth)

| 方法 | URL | 用途 | 认证方式 |
|------|-----|------|----------|
| `GET` | `https://account.xiaomi.com/longPolling/loginUrl` | 获取二维码图片 URL | 无 |
| `GET` | `https://account.xiaomi.com/pass/serviceLogin` | 初始化登录会话 / passToken 换凭证 | Cookie (passToken) |
| `POST` | `https://account.xiaomi.com/pass/serviceLoginAuth2` | 密码登录提交 | 无 |
| `GET` | `https://sts-hlth.io.mi.com/healthapp/sts` | STS 安全令牌交换 | Cookie (passToken + cUserId) |

### 1.3 亲友管理端点

| 方法 | 路径 | 用途 | 对应常量 |
|------|------|------|----------|
| `GET` | `/app/v1/relatives/get_relative_list` | 获取亲友列表 | `RELATIVES_LIST_PATH` |
| `GET` | `/app/v1/relatives/verify_userinfo_by_id` | 按 UID 验证用户信息 | `RELATIVES_VERIFY_USER_PATH` |
| `POST` | `/app/v1/relatives/send_invite` | 发送亲友邀请 | `RELATIVES_SEND_INVITE_PATH` |
| `POST` | `/app/v1/relatives/operate_invite` | 同意/拒绝邀请 (operate=1/2) | `RELATIVES_OPERATE_INVITE_PATH` |
| `POST` | `/app/v1/relatives/delete_relative` | 删除亲友关系 | `RELATIVES_DELETE_PATH` |
| `GET` | `/app/v1/relatives/get_shared_data_types` | 查询亲友共享的数据类型 | `RELATIVES_GET_SHARED_TYPES_PATH` |
| `GET` | `/app/v1/relatives/get_applied_shared_data_types` | 查询已申请的共享类型 | `RELATIVES_GET_APPLIED_SHARED_TYPES_PATH` |
| `GET` | `/app/v1/relatives/get_family_member` | 获取家庭成员列表 | `RELATIVES_GET_FAMILY_MEMBER_PATH` |
| `GET` | `/app/v1/relatives/get_invite_unique_id` | 获取二维码邀请链接 ID | `RELATIVES_GET_INVITE_ID_PATH` |
| `GET` | `/app/v1/relatives/get_topic_subscriptions` | 获取消息订阅状态 | `RELATIVES_GET_TOPIC_SUBS_PATH` |

### 1.4 健康数据查询端点

| 方法 | 路径 | 用途 | 请求参数 |
|------|------|------|----------|
| `GET` | `/app/v1/data/get_latest_fitness_data` | 获取亲友最新数据快照 (所有类型) | `relative_uid` |
| `GET` | `/app/v1/data/get_aggregated_fitness_data_by_time` | 按天聚合数据 (心率/睡眠/步数等) | `relative_uid`, `key`, `tag`, `start_time`, `end_time`, `limit` |
| `GET` | `/app/v1/data/get_fitness_data_by_time` | 原始测量记录 (体重/血压等) | `relative_uid`, `key`, `start_time`, `end_time`, `limit` |

### 1.5 消息端点

| 方法 | 路径 | 用途 |
|------|------|------|
| `POST` | `/app/v1/message/get_msg_list` | 获取消息列表 |
| `POST` | `/app/v1/message/check_new_msg` | 检查是否有新消息 |

### 1.6 认证流程全景

```
┌─────────────┐     ┌────────────────────────────┐     ┌──────────────────┐
│   用户扫码   │ ──▶ │ account.xiaomi.com/loginUrl │ ──▶ │ 长轮询等待扫码    │
└─────────────┘     └────────────────────────────┘     └──────────────────┘
                                                               │
                                                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         扫码成功后返回凭证                                  │
│  {ssecurity, userId, passToken, cUserId, location}                       │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────┐    ┌─────────────────────────────┐
│  _helpers.py           │───▶│  跟随 location 重定向        │
│  extract_credentials() │    │  提取 serviceToken          │
└────────────────────────┘    └─────────────────────────────┘
                               │
                               ▼
┌────────────────────────┐    ┌─────────────────────────────┐
│  sts.py                │───▶│  STS 令牌交换                │
│  sts_exchange()        │    │  sts-hlth.io.mi.com/healthapp/sts │
└────────────────────────┘    └─────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      RC4 加密 API 调用                                   │
│  Cookie: cUserId={cUserId}; serviceToken={serviceToken}                 │
│  Header: region_tag=ru, handleparams=true                               │
│  参数: RC4 加密后的 {data, signature, rc4_hash__, _nonce}               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心文件映射

### 2.1 文件职责总览

| 文件路径 | 职责 |
|----------|------|
| `mi_fitness/crypto.py` | RC4 加解密 + SHA1 签名 + nonce 生成 |
| `mi_fitness/client/base.py` | 加密请求基础层 (`encrypted_request`) |
| `mi_fitness/client/api.py` | `MiHealthClient` 类，业务编排入口 |
| `mi_fitness/client/data.py` | 健康数据查询函数 (心率/睡眠/步数等) |
| `mi_fitness/client/relatives.py` | 亲友管理函数 |
| `mi_fitness/client/messages.py` | 消息通知函数 |
| `mi_fitness/auth/manager.py` | `XiaomiAuth` 认证管理器 |
| `mi_fitness/auth/qr.py` | 二维码扫码登录 |
| `mi_fitness/auth/password.py` | 密码登录 |
| `mi_fitness/auth/passtoken.py` | passToken 交换登录 |
| `mi_fitness/auth/sts.py` | STS 安全令牌交换 |
| `mi_fitness/auth/_helpers.py` | 认证工具函数 |
| `mi_fitness/const.py` | API 端点常量 + 数据类型 key |
| `mi_fitness/models.py` | Pydantic 数据模型 |
| `mi_fitness/http.py` | 带重试的 HTTP 客户端 |

### 2.2 加密/签名算法核心代码

#### 2.2.1 RC4 加解密 (crypto.py)

```typescript
/**
 * RC4 加密/解密（带前 N 字节跳过，防止密钥流弱点）
 * 密钥流跳过 1024 字节后与 App 行为一致
 */
function _rc4_crypt(key: Uint8Array, data: Uint8Array, skip: number = 1024): Uint8Array {
  // KSA (Key-Scheduling Algorithm)
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xFF;
    [s[i], s[j]] = [s[j], s[i]];
  }

  // 跳过前 skip 字节密钥流
  let i = 0;
  j = 0;
  for (let _ = 0; _ < skip; _++) {
    i = (i + 1) & 0xFF;
    j = (j + s[i]) & 0xFF;
    [s[i], s[j]] = [s[j], s[i]];
  }

  // PRGA + XOR
  const result = new Uint8Array(data.length);
  for (let idx = 0; idx < data.length; idx++) {
    i = (i + 1) & 0xFF;
    j = (j + s[i]) & 0xFF;
    [s[i], s[j]] = [s[j], s[i]];
    result[idx] = data[idx] ^ s[(s[i] + s[j]) & 0xFF];
  }
  return result;
}
```

#### 2.2.2 Nonce 生成 (crypto.py)

```typescript
/**
 * 生成请求 nonce
 * 格式: base64(random_8_bytes + minutes_since_epoch_4bytes_BE)
 */
function generateNonce(): string {
  const randomPart = crypto.randomBytes(8);        // 8 字节随机数
  const minutes = Math.floor(Date.now() / 1000 / 60);
  const timePart = Buffer.alloc(4);
  timePart.writeUInt32BE(minutes, 0);              // 大端序 4 字节
  return Buffer.concat([randomPart, timePart]).toString('base64');
}
```

#### 2.2.3 Signed Nonce 派生 (crypto.py)

```typescript
/**
 * 计算签名 nonce（用于 RC4 密钥派生）
 * signed_nonce = base64(SHA256(b64decode(ssecurity) + b64decode(nonce)))
 *
 * ssecurity: 登录时小米服务器返回的 Base64 编码密钥
 */
function computeSignedNonce(ssecurity: string, nonce: string): string {
  const hash = crypto.createHash('sha256')
    .update(Buffer.from(ssecurity, 'base64'))
    .update(Buffer.from(nonce, 'base64'))
    .digest();
  return hash.toString('base64');
}
```

#### 2.2.4 签名消息构建 (crypto.py)

```typescript
/**
 * 构建签名消息字符串（对应 App 中 z94.b 格式）
 * 格式: METHOD&/path&k1=v1&k2=v2&...&signedNonce_b64
 * - method 大写
 * - path 带前导 /
 * - params 按 key 字典序（TreeMap）排序
 */
function buildSigMessage(
  method: string,
  urlPath: string,
  params: Record<string, string>,
  signedNonce: string
): string {
  const parts: string[] = [method.toUpperCase()];
  parts.push(urlPath.startsWith('/') ? urlPath : '/' + urlPath);

  // 按 key 字典序排序
  for (const k of Object.keys(params).sort()) {
    parts.push(`${k}=${params[k]}`);
  }
  parts.push(signedNonce);
  return parts.join('&');
}
```

#### 2.2.5 完整请求参数构建 (crypto.py)

```typescript
/**
 * 构建完整的加密请求参数（对应 App 中 ua4.c 方法）
 *
 * 流程:
 * 1. 生成 nonce，计算 signed_nonce = base64(SHA256(ssecurity + nonce))
 * 2. 构建原始参数 TreeMap（排除空 key/value）
 * 3. rc4_hash__ = SHA1(METHOD&/path&k=v&...&signedNonce) → base64
 * 4. 将 rc4_hash__ 插入 TreeMap
 * 5. 用连续 RC4 流加密所有 TreeMap 值（按 key 排序，drop 1024）
 * 6. signature = SHA1(METHOD&/path&k=enc_v&...&signedNonce) → base64
 * 7. 返回 {加密后各参数, signature, _nonce}
 */
function buildEncryptedParams(
  method: string,
  urlPath: string,
  ssecurity: string,
  params?: Record<string, any>
): Record<string, string> {
  const nonce = generateNonce();
  const snonce = computeSignedNonce(ssecurity, nonce);
  const snonceBytes = Buffer.from(snonce, 'base64');

  // Step 1: 原始参数 TreeMap
  const rawTree: Record<string, string> = {};
  if (params) {
    rawTree['data'] = JSON.stringify(params);
  }

  // Step 2: 计算 rc4_hash__（基于原始明文参数）
  const rc4Msg = buildSigMessage(method, urlPath, rawTree, snonce);
  const rc4Hash = crypto.createHash('sha1').update(rc4Msg).digest('base64');

  // Step 3: 插入 rc4_hash__
  rawTree['rc4_hash__'] = rc4Hash;

  // Step 4: 用连续 RC4 流加密所有值
  const sortedEntries = Object.entries(rawTree).sort(([a], [b]) => a.localeCompare(b));
  const encryptedValues = rc4StreamEncryptValues(snonceBytes, sortedEntries);

  // Step 5: 计算 signature（基于加密后参数）
  const sigMsg = buildSigMessage(method, urlPath, encryptedValues, snonce);
  const signature = crypto.createHash('sha1').update(sigMsg).digest('base64');

  // Step 6: 组装结果
  return {
    ...encryptedValues,
    signature,
    _nonce: nonce,
  };
}
```

### 2.3 认证核心代码

#### 2.3.1 Cookie 构建 (client/base.py)

```typescript
/**
 * 构造健康接口请求所需的认证 cookie
 */
function buildAuthCookies(token: AuthToken): Record<string, string> {
  return {
    cUserId: token.c_user_id,
    serviceToken: token.service_token,
  };
}
```

#### 2.3.2 加密请求发送 (client/base.py)

```typescript
/**
 * 发送 RC4 加密的 API 请求并解密响应
 *
 * 核心流程:
 * 1. 调用 build_encrypted_params 生成加密参数
 * 2. 通过 Cookie (cUserId + serviceToken) 发送请求
 * 3. 收到响应后用 ssecurity 解密
 * 4. 检查业务错误码
 */
async function encryptedRequest(
  http: RetryAsyncClient,
  token: AuthToken,
  method: string,
  path: string,
  baseUrl: string,
  params?: Record<string, any>
): Promise<Record<string, any>> {
  if (!token.service_token || !token.ssecurity) {
    throw new AuthError('未登录');
  }

  // 特殊路径签名处理
  const signingPath = path === '/healthapp/service/gen_download_url'
    ? '/service/gen_download_url'
    : path;

  // 构建加密参数（自动包含 signature 和 _nonce）
  const encParams = buildEncryptedParams(method, signingPath, token.ssecurity, params);
  const nonce = encParams._nonce;
  const cookies = buildAuthCookies(token);
  const url = baseUrl.replace(/\/$/, '') + path;

  // 发送请求
  const resp = method.toUpperCase() === 'GET'
    ? await http.get(url, { params: encParams, cookies })
    : await http.post(url, encParams, { cookies });

  // 解密响应
  const result = decryptResponse(token.ssecurity, nonce, resp.data);

  // 检查业务码
  const code = parseInt(result.code ?? -1);
  if (code !== 0) {
    throw mapBusinessError(code, result, params);
  }
  return result;
}
```

#### 2.3.3 二维码登录 (auth/qr.py)

```typescript
/**
 * 二维码扫码登录流程
 *
 * Step 1: 获取二维码信息
 *   GET https://account.xiaomi.com/longPolling/loginUrl
 *   参数: sid=miothealth, _qrsize=480
 *   返回: {qr: 图片URL, loginUrl: 登录链接, lp: 长轮询URL}
 *
 * Step 2: 长轮询等待扫码
 *   GET {lp} (长轮询 URL)
 *   超时: 默认 300 秒
 *
 * Step 3: 提取凭证
 *   从响应中提取 {ssecurity, userId, passToken, cUserId, location}
 *   跟随 location 重定向获取 serviceToken
 */
async function loginQr(
  http: RetryAsyncClient,
  token: AuthToken,
  qrCallback?: (qrUrl: string, loginUrl: string) => Promise<void>
): Promise<void> {
  // Step 1: 获取二维码
  const qrParams = {
    _qrsize: '480',
    qs: '%3Fsid%3Dmiothealth%26_json%3Dtrue',
    callback: 'https://sts-hlth.io.mi.com/healthapp/sts',
    _hasLogo: 'false',
    sid: 'miothealth',
    serviceParam: '',
    _locale: 'zh_CN',
    _dc: String(Date.now()),
  };
  const resp = await http.get('https://account.xiaomi.com/longPolling/loginUrl', {
    params: qrParams,
  });
  const qrData = parseMiResponse(resp.data);  // 去除 &&&START&&& 前缀

  const qrImageUrl = qrData.qr;
  const longPollingUrl = qrData.lp;

  // 展示二维码
  if (qrCallback) await qrCallback(qrImageUrl, qrData.loginUrl);

  // Step 2: 长轮询等待扫码
  const resp2 = await http.get(longPollingUrl, { timeout: 60 });
  const data = parseMiResponse(resp2.data);

  // Step 3: 提取凭证
  await extractCredentials(http, data, token);
}
```

#### 2.3.4 passToken 交换登录 (auth/passtoken.py)

```typescript
/**
 * 使用 passToken 换取完整登录凭证
 *
 * 适用场景: 已有 passToken（从浏览器 Cookie 或历史登录中提取）
 *
 * 流程:
 * 1. 设置 passToken + deviceId + userId Cookie
 * 2. 调用 serviceLogin（带上 passToken cookie 直接返回凭证）
 * 3. 用 ssecurity + nonce 计算 clientSign
 * 4. 跟随 location 获取 serviceToken
 */
async function loginPassToken(
  http: RetryAsyncClient,
  token: AuthToken,
  passToken: string,
  userId: string,
  deviceId?: string
): Promise<void> {
  token.pass_token = passToken;
  token.user_id = userId;
  token.device_id = deviceId || `an_${crypto.randomBytes(16).toString('hex')}`;

  // 设置 cookies
  for (const [name, value] of [
    ['passToken', passToken],
    ['deviceId', token.device_id],
    ['userId', userId],
  ]) {
    setCookieForDomains(http, name, value);
  }

  // 调用 serviceLogin
  const resp = await http.get('https://account.xiaomi.com/pass/serviceLogin', {
    params: { _json: 'true', sid: 'miothealth' },
  });
  const data = parseMiResponse(resp.data);

  token.ssecurity = data.ssecurity;
  token.c_user_id = data.cUserId;

  // 计算 clientSign = base64(SHA1("nonce={nonce}&{ssecurity}"))
  if (data.location) {
    const signText = `nonce=${data.nonce}&${data.ssecurity}`;
    const sha1Digest = crypto.createHash('sha1').update(signText).digest();
    const clientSign = encodeURIComponent(sha1Digest.toString('base64'));
    const fullUrl = `${data.location}&clientSign=${clientSign}`;
    token.service_token = await extractServiceToken(http, fullUrl);
  }
}
```

### 2.4 数据查询核心代码

#### 2.4.1 聚合数据查询 (client/data.py)

```typescript
/**
 * 获取亲友的聚合数据（按天汇总）
 *
 * 支持的 key 值:
 * - "heart_rate" - 心率日汇总
 * - "sleep" - 睡眠日汇总
 * - "steps" - 步数日汇总
 * - "calories" - 活动卡路里日汇总
 * - "valid_stand" - 有效站立日汇总
 * - "intensity" - 中高强度活动日汇总
 * - "spo2" - 血氧日汇总
 *
 * tag: 默认为 "daily_report"
 */
async function getAggregatedData(
  client: MiHealthClient,
  relativeUid: number,
  key: string,           // 数据类型 key
  startTime: number,     // Unix 时间戳（秒）
  endTime: number,
  tag: string = 'daily_report',
  limit: number = 30
): Promise<AggregatedDataResponse> {
  const resp = await client._request('GET', '/app/v1/data/get_aggregated_fitness_data_by_time', {
    relative_uid: relativeUid,
    key,
    tag,
    start_time: startTime,
    end_time: endTime,
    limit,
  });
  return new AggregatedDataResponse(resp);
}
```

#### 2.4.2 原始测量数据查询 (client/data.py)

```typescript
/**
 * 获取原始测量/事件数据（非按天聚合，每次测量一条记录）
 *
 * 支持的 key 值:
 * - "weight" - 体重测量
 * - "blood_pressure" - 血压测量
 */
async function getFitnessData(
  client: MiHealthClient,
  relativeUid: number,
  key: string,
  startTime: number,
  endTime: number,
  limit: number = 30
): Promise<AggregatedDataResponse> {
  const resp = await client._request('GET', '/app/v1/data/get_fitness_data_by_time', {
    relative_uid: relativeUid,
    key,
    start_time: startTime,
    end_time: endTime,
    limit,
  });
  return new AggregatedDataResponse(resp);
}
```

---

## 3. 数据结构定义

### 3.1 认证 Token 结构

```typescript
interface AuthToken {
  user_id: string;        // 小米用户 ID (userId)
  c_user_id: string;      // cUserId（cookie 认证用）
  service_token: string;  // serviceToken（cookie 认证用）
  ssecurity: string;      // 加密密钥 Base64（RC4 加解密用）
  pass_token: string;     // passToken（可用于 STS 交换）
  device_id: string;      // 设备标识符（格式: an_{hex(16bytes)}）
}
```

### 3.2 API 响应包装结构

```typescript
// 通用响应基类
interface ApiResponse {
  code: number;      // 0 = 成功
  message: string;   // 错误描述
  result: Record<string, any> | any[];
}

// 业务错误码
const ERR_NOT_RELATIVES = -4002001;        // 非亲友关系
const ERR_NOT_SHARED_DATA_TYPE = -4002004; // 未共享该数据类型
const ERR_DEVICE_UNTRUST = 70016;          // 设备未信任
```

### 3.3 聚合数据项结构 (get_aggregated_data 返回)

```typescript
interface AggregatedDataItem {
  sid: string;              // 数据来源 SID
  tag: string;              // 数据标签（如 "daily_report"）
  key: string;              // 数据类型（"heart_rate" / "sleep" / "steps" 等）
  time: number;             // 数据时间戳（秒，当天 0 点）
  value: string;            // JSON 字符串值
  update_time: number;      // 更新时间戳
  watermark: string;        // 水印（增量同步用）
  source_sid_list: string[]; // 数据来源列表
}
```

### 3.4 心率数据结构

```typescript
interface HeartRateData {
  time: number;                        // 数据时间戳（当天 0 点）
  avg_hr: number;                      // 日均心率 (bpm)
  avg_rhr: number;                     // 日均静息心率 (bpm)
  max_hr: number;                      // 最大心率
  min_hr: number;                      // 最小心率
  latest_hr: { bpm: number; time: number } | null;  // 最新一次采样
  abnormal_hr_count: number;           // 异常心率次数
  aerobic_hr_zone_duration: number;    // 有氧区间时长（分钟）
  anaerobic_hr_zone_duration: number;  // 无氧区间时长（分钟）
  extreme_hr_zone_duration: number;    // 极限区间时长（分钟）
  fat_burning_hr_zone_duration: number;// 燃脂区间时长（分钟）
  warm_up_hr_zone_duration: number;    // 热身区间时长（分钟）
}
```

### 3.5 睡眠数据结构

```typescript
interface SleepSegment {
  bedtime: number;              // 入睡时间戳
  wake_up_time: number;         // 醒来时间戳
  duration: number;             // 持续时长（分钟）
  sleep_deep_duration: number;  // 深睡时长（分钟）
  sleep_light_duration: number; // 浅睡时长（分钟）
  timezone: number;             // 时区偏移
  awake_count: number;          // 醒来次数
  sleep_awake_duration: number; // 清醒时长（分钟）
}

interface SleepData {
  time: number;                      // 数据时间戳
  total_duration: number;            // 总睡眠时长（分钟）
  sleep_score: number;               // 睡眠评分（0-100）
  sleep_stage: number;               // 睡眠阶段数
  sleep_deep_duration: number;       // 深睡时长（分钟）
  sleep_light_duration: number;      // 浅睡时长（分钟）
  sleep_rem_duration: number;        // REM 时长（分钟）
  sleep_awake_duration: number;      // 清醒时长（分钟）
  long_sleep_evaluation: number;     // 长期睡眠评估
  day_sleep_evaluation: number;      // 日间小睡评估
  avg_hr: number;                    // 睡眠平均心率
  max_hr: number;                    // 睡眠最大心率
  min_hr: number;                    // 睡眠最小心率
  avg_spo2: number;                  // 睡眠平均血氧
  segment_details: SleepSegment[];   // 睡眠片段列表
}
```

### 3.6 步数数据结构

```typescript
interface StepData {
  time: number;      // 数据时间戳
  steps: number;     // 步数
  distance: number;  // 距离（米）
  calories: number;  // 消耗卡路里
  goal: number;      // 目标步数
}
```

### 3.7 其他数据类型

```typescript
// 体重
interface WeightData {
  time: number;
  weight: number;  // 千克
  bmi: number;
}

// 血压
interface BloodPressureData {
  time: number;
  systolic: number;   // 收缩压（高压 mmHg）
  diastolic: number;  // 舒张压（低压 mmHg）
  pulse: number | null; // 脉搏 (bpm)
}

// 血氧
interface Spo2Data {
  time: number;
  spo2: number;  // 血氧百分比
}

// 血氧日汇总
interface Spo2SummaryData {
  time: number;
  avg_spo2: number;
  max_spo2: number;
  min_spo2: number;
  lack_spo2_count: number;  // 低血氧次数
  latest_spo2: Spo2Data | null;
}

// 卡路里
interface CaloriesData {
  time: number;
  calories: number;  // 已消耗活动卡路里
  goal: number;      // 目标值
}

// 中高强度活动
interface IntensityData {
  time: number;
  duration: number;  // 时长（分钟）
}

// 有效站立
interface ValidStandData {
  time: number;
  count: number;     // 有效站立次数
}

// 目标完成
interface GoalData {
  time: number;
  goal_items: Array<{
    field: number;        // 1=步数, 2=卡路里, 4=中高强度
    target_value: number;
    achieved_value: number;
  }>;
}
```

### 3.8 与 Hum 项目 Prisma 模型的字段映射建议

```prisma
// === 运动记录表 ===
model Exercise {
  id          String   @id @default(cuid())
  userId      String   // 关联用户 ID
  date        DateTime @db.Date

  // 步数字段 (from StepData)
  steps       Int      @default(0)
  distance    Int      @default(0)  // 米
  stepGoal    Int      @default(0)  // 目标步数

  // 卡路里字段 (from CaloriesData)
  calories    Int      @default(0)  // 活动卡路里
  calorieGoal Int      @default(0)

  // 中高强度活动 (from IntensityData)
  intensityDuration Int @default(0) // 分钟

  // 有效站立 (from ValidStandData)
  validStandCount Int @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, date])
}

// === 睡眠记录表 ===
model Sleep {
  id                String   @id @default(cuid())
  userId            String
  date              DateTime @db.Date

  // 基础指标 (from SleepData)
  totalDuration     Int      @default(0)  // 总睡眠时长（分钟）
  sleepScore        Int?     // 睡眠评分 0-100
  deepDuration      Int      @default(0)  // 深睡（分钟）
  lightDuration     Int      @default(0)  // 浅睡（分钟）
  remDuration       Int      @default(0)  // REM（分钟）
  awakeDuration     Int      @default(0)  // 清醒（分钟）
  awakeCount        Int      @default(0)  // 醒来次数

  // 心率指标
  avgHr             Int?     // 睡眠平均心率
  maxHr             Int?     // 睡眠最大心率
  minHr             Int?     // 睡眠最小心率

  // 血氧指标
  avgSpo2           Int?     // 睡眠平均血氧

  // 原始片段 JSON
  segmentsJson      String?  @db.Text  // SleepSegment[] JSON

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId, date])
}

// === 心率记录表 ===
model HeartRate {
  id                    String   @id @default(cuid())
  userId                String
  date                  DateTime @db.Date

  // 日汇总 (from HeartRateData)
  avgHr                 Int?     // 日均心率
  restingHr             Int?     // 日均静息心率
  maxHr                 Int?     // 最大心率
  minHr                 Int?     // 最小心率

  // 区间时长（分钟）
  warmUpZoneDuration    Int @default(0)
  fatBurningZoneDuration Int @default(0)
  aerobicZoneDuration   Int @default(0)
  anaerobicZoneDuration Int @default(0)
  extremeZoneDuration   Int @default(0)

  // 最新采样
  latestBpm             Int?     // 最新心率值
  latestTime            DateTime? // 最新采样时间

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([userId, date])
}

// === 体重记录表 ===
model Weight {
  id        String   @id @default(cuid())
  userId    String
  timestamp DateTime // 测量时间
  weight    Float    // 千克
  bmi       Float?
  source    String   @default("xiaomi") // 数据来源

  createdAt DateTime @default(now())

  @@index([userId, timestamp])
}

// === 血压记录表 ===
model BloodPressure {
  id         String   @id @default(cuid())
  userId     String
  timestamp  DateTime // 测量时间
  systolic   Int      // 收缩压（高压）
  diastolic  Int      // 舒张压（低压）
  pulse      Int?     // 脉搏
  source     String   @default("xiaomi")

  createdAt  DateTime @default(now())

  @@index([userId, timestamp])
}

// === 血氧记录表 ===
model Spo2 {
  id           String   @id @default(cuid())
  userId       String
  date         DateTime @db.Date

  // 日汇总 (from Spo2SummaryData)
  avgSpo2      Int?
  maxSpo2      Int?
  minSpo2      Int?
  lackSpo2Count Int @default(0) // 低血氧次数

  // 最新采样
  latestSpo2   Int?
  latestTime   DateTime?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([userId, date])
}
```

---

## 4. 逆向接入方案

### 4.1 可直接复用的接口（无需二次开发）

| 接口 | 复用难度 | 说明 |
|------|----------|------|
| 二维码登录 | ⭐ 低 | SDK 已实现完整流程，可直接调用 |
| passToken 登录 | ⭐ 低 | 适合已有 passToken 的场景 |
| 获取亲友列表 | ⭐ 低 | 标准 CRUD 接口 |
| 获取最新数据 | ⭐ 低 | `get_latest_fitness_data` 已完整解析 |
| 获取聚合数据 | ⭐ 低 | `get_aggregated_fitness_data_by_time` 支持所有日汇总类型 |
| 获取原始测量数据 | ⭐ 低 | `get_fitness_data_by_time` 支持体重/血压等 |
| 亲友管理 | ⭐ 低 | 邀请/同意/删除/查询 全套接口 |
| 消息通知 | ⭐ 低 | 邀请消息查询 |

**注意**: 所有数据获取接口均需通过**亲友关系**访问，无法直接查询自己的数据。需要：
1. 主账号 A 登录
2. 账号 B 在小米运动健康 App 中添加 A 为亲友并共享数据
3. A 通过 SDK 查询 B 的数据

### 4.2 需要二次开发的模块

| 模块 | 工作量 | 说明 |
|------|--------|------------|
| 签名算法 TS 移植 | ⭐⭐ 中 | RC4 + SHA1 签名需从 Python 移植到 TypeScript/Node.js |
| 登录状态管理 | ⭐⭐ 中 | Token 持久化、自动刷新、过期处理 |
| 日期/时区处理 | ⭐⭐ 中 | 接口使用东八区时间戳，需处理时区转换 |
| 增量同步机制 | ⭐⭐⭐ 高 | `watermark` 字段支持增量同步，需设计同步状态机 |
| 数据类型扩展 | ⭐⭐⭐ 高 | 运动明细、GPS 轨迹等需要逆向其他接口 |
| Protobuf 解析 | ⭐⭐⭐⭐ 很高 | 部分小米接口使用 protobuf，本项目暂未涉及 |

### 4.3 不需要破解的模块

- ✅ **签名算法**: 已完全逆向，RC4 + SHA1 纯算法实现
- ✅ **密钥获取**: 通过标准登录流程获取 `ssecurity`
- ✅ **Protobuf**: 本项目涉及的所有接口均使用 JSON，无 protobuf
- ✅ **设备指纹**: `device_id` 可随机生成，格式 `an_{32位hex}`
- ✅ **证书固定**: 未检测到 SSL pinning 相关逻辑

### 4.4 接入 Hum 的技术路径建议

#### 方案 A: CLI 调用（推荐，快速落地）

```typescript
/**
 * 通过 Python CLI 子进程调用 mi-fitness SDK
 * 优点: 无需移植签名算法，直接使用成熟 SDK
 * 缺点: 依赖 Python 运行时
 */

// 1. 安装 mi-fitness
// pip install mi-fitness

// 2. Node.js 封装
import { execa } from 'execa';

class MiFitnessCliAdapter {
  async loginQr(): Promise<{ qrUrl: string; loginUrl: string }> {
    const { stdout } = await execa('python', ['-m', 'mi_fitness', 'login', '--json']);
    return JSON.parse(stdout);
  }

  async getDailySummary(
    tokenPath: string,
    relativeUid: number,
    date: string
  ): Promise<DailySummary> {
    const { stdout } = await execa('python', [
      '-m', 'mi_fitness',
      'summary',
      '--token', tokenPath,
      '--uid', String(relativeUid),
      '--date', date,
      '--json',
    ]);
    return JSON.parse(stdout);
  }
}
```

**CLI 命令参考**:
```bash
# 二维码登录
python -m mi_fitness login --json

# 获取亲友列表
python -m mi_fitness relatives --token ~/.mi_token.json

# 获取每日摘要
python -m mi_fitness summary --token ~/.mi_token.json --uid 12345678 --date 2024-01-15 --json

# 获取心率历史
python -m mi_fitness hr --token ~/.mi_token.json --uid 12345678 --days 7 --json
```

#### 方案 B: API 封装（推荐，长期维护）

```typescript
/**
 * 将 Python SDK 封装为独立 HTTP 服务
 * Node.js 通过 REST API 调用
 *
 * 架构:
 * ┌──────────┐    HTTP    ┌──────────────────┐    RC4    ┌──────────────┐
 * │ Hum API  │ ◀────────▶ │ mi-fitness-proxy │ ◀───────▶ │ 小米健康 API  │
 * │ (Node)   │            │ (Python/FastAPI) │  加密     │              │
 * └──────────┘            └──────────────────┘           └──────────────┘
 */

// Python FastAPI 代理服务 (mi-fitness-proxy)
// main.py:
from fastapi import FastAPI
from mi_fitness import MiHealthClient, XiaomiAuth

app = FastAPI()

@app.post("/login/qr")
async def login_qr():
    """返回二维码 URL"""
    auth = XiaomiAuth()
    qr_url, login_url = await auth.login_qr()
    return {"qr_url": qr_url, "login_url": login_url}

@app.get("/relatives/{uid}/daily-summary")
async def get_daily_summary(uid: int, date: str, token: str):
    auth = XiaomiAuth.from_token(token)
    client = MiHealthClient(auth)
    summary = await client.get_daily_summary(uid, date)
    return summary.model_dump()
```

#### 方案 C: 纯 TypeScript 移植（工作量大，无外部依赖）

```typescript
/**
 * 将核心签名算法移植为 TypeScript 模块
 * 优点: 无 Python 依赖，可集成到 Hum 现有代码库
 * 工作量: 约 1-2 周
 *
 * 需移植的文件（按优先级）:
 * 1. crypto.ts  - RC4 + SHA1 签名（约 200 行）
 * 2. base.ts    - encrypted_request 封装（约 150 行）
 * 3. auth/*.ts  - 登录流程（二维码 + passToken，约 500 行）
 * 4. models.ts  - 数据模型（可用 Zod 替代 Pydantic）
 */

// 核心签名模块伪代码
// src/lib/mi-crypto.ts:
export class MiCrypto {
  constructor(private ssecurity: string) {}

  buildParams(method: string, path: string, data?: object): EncryptedParams {
    const nonce = this.generateNonce();
    const signedNonce = this.computeSignedNonce(nonce);
    // ... RC4 加密 + SHA1 签名
    return { encryptedData: '...', signature: '...', _nonce: nonce };
  }

  decryptResponse(nonce: string, ciphertext: string): object {
    const signedNonce = this.computeSignedNonce(nonce);
    const plaintext = this.rc4Decrypt(signedNonce, ciphertext);
    return JSON.parse(plaintext);
  }
}
```

### 4.5 推荐接入路径

| 阶段 | 方案 | 目标 | 工期 |
|------|------|------|------|
| Phase 1 | 方案 A (CLI) | 快速验证数据可用性，跑通登录到取数的完整链路 | 2-3 天 |
| Phase 2 | 方案 B (API 封装) | 稳定服务化，支持并发请求和 Token 自动刷新 | 1 周 |
| Phase 3 | 方案 C (TS 移植) | 长期维护，去除 Python 依赖 | 2-4 周 |

### 4.6 关键密钥与凭证管理建议

```typescript
/**
 * Token 存储结构（JSON 文件）
 * 建议存储路径: ~/.hum/mi-fitness/tokens/{userId}.json
 */
interface StoredToken {
  user_id: string;
  c_user_id: string;
  service_token: string;
  ssecurity: string;     // ⚠️ 敏感：RC4 加密密钥
  pass_token: string;    // ⚠️ 敏感：可用于换取凭证
  device_id: string;
  created_at: string;    // ISO 8601
  updated_at: string;
}

/**
 * 安全注意事项:
 * 1. ssecurity 和 pass_token 是敏感凭证，需加密存储
 * 2. service_token 有过期时间（通常 30 天），需实现自动刷新
 * 3. device_id 生成后应持久化，避免频繁更换触发风控
 * 4. 建议使用小米子账号（亲友账号）而非主账号登录
 */
```

---

## 附录：数据类型常量速查

```typescript
// const.ts 中的数据类型 key
const DATA_TYPES = {
  GOAL:           'goal',            // 目标完成
  HEART_RATE:     'heart_rate',      // 心率
  SLEEP:          'sleep',           // 睡眠
  BLOOD_PRESSURE: 'blood_pressure',  // 血压
  STEPS:          'steps',           // 步数
  CALORIES:       'calories',        // 卡路里
  VALID_STAND:    'valid_stand',     // 有效站立
  INTENSITY:      'intensity',       // 中高强度活动
  WEIGHT:         'weight',          // 体重
  SPO2:           'spo2',            // 血氧
} as const;

// 聚合接口 vs 原始测量接口 数据类型分布:
// get_aggregated_data (按天聚合): heart_rate, sleep, steps, calories, valid_stand, intensity, spo2
// get_fitness_data (原始记录): weight, blood_pressure
// get_latest_data (最新快照): 以上全部 + goal
```
