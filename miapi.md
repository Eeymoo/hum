 小米运动健康 (Mi Fitness) v3.55.0 — API 参考文档

> **逆向工程来源**: 反编译自 `小米运动健康_3.55.0.APK` (com.mi.health / com.xiaomi.fitness)
> **日期**: 2026-06-04
> **目的**: 了解数据同步机制，为自建健康数据中心提供参考

---

## 目录

1. [概述与架构](#1-概述与架构)
2. [认证体系 — 完整登录流程](#2-认证体系--完整登录流程)
3. [数据核心 API (运动/健康数据)](#3-数据核心-api)
4. [饮食/营养 API](#4-饮食营养-api)
5. [体重/体脂秤 API](#5-体重体脂秤-api)
6. [睡眠 API](#6-睡眠-api)
7. [训练计划 API](#7-训练计划-api)
8. [第三方数据对接 API](#8-第三方数据对接-api)
9. [其他 API](#9-其他-api)
10. [自建数据中心同步方案](#10-自建数据中心同步方案)
11. [实现参考代码](#11-实现参考代码)
12. [附录](#12-附录)

---

## 1. 概述与架构

### 基本信息

| 属性 | 值 |
|---|---|
| 包名 | `com.mi.health` |
| 主代码包 | `com.xiaomi.fitness` |
| Application | `com.xiaomi.fitness.FitnessApp` (extends `Hilt_FitnessApp`) |
| 主 Activity | `com.xiaomi.fitness.login.SplashActivity` |
| DI 框架 | Dagger Hilt |
| 网络层 | OkHttp3 + Retrofit2 + Kotlin Coroutines |
| 序列化 | Gson |
| 数据库 | Room |
| 崩溃上报 | XCrash (小米自研) |

### API 服务器

| 用途 | Base URL | Path | 源码引用 |
|---|---|---|---|
| **主健康 API** | `https://hlth.io.mi.com/` | `app/v1/` | `FitnessApiService`, `WeightApiService`, `AccountV1Service` 等 |
| **主健康 API** (旧) | `https://hlth.io.mi.com/` | `healthapp/` | `AccessService`, `AccountService`, `SportHttpService` 等 |
| **手表/设备 API** | `https://watch.iot.mi.com/` | `cgi-op/api/v1/miwear/` | `HabitService`, `WeekReportRequestInterface` |
| **研究项目** | `https://hlth.research.xiaomiwear.com/` | `app/v1/` | `HealthCheckService` (数据) |
| **ECG 报告** | `https://api.995120.cn/static/hm505/mihealth-h5-beta` | — | `EcgConstantsKt` |

### 请求/响应格式

- **Content-Type**: `application/x-www-form-urlencoded` (POST); GET 无 body
- **参数编码**: `data=<URL-encoded JSON string>`
- **响应格式**: JSON，包裹在 `BaseResult<T>` 中：

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```

> **字段说明**: `code`=0 表示成功; `message` 为人类可读的描述; `data` 为实际业务数据（字段名始终为 `"data"`）。

### 认证方式: Cookie 注入

所有 `hlth.io.mi.com` 的健康 API 通过 **Cookie 头** 认证：

```
Cookie: cUserId=<加密用户ID>; serviceToken=<服务令牌>; locale=zh_CN
```

`@Secret` 注解仅用于配置**登录策略**和**响应加密开关**，不参与请求签名计算。

### 术语速查

| 术语 | 说明 |
|---|---|
| `serviceToken` | 服务令牌，小米健康 API 的核心认证凭据 |
| `cUserId` | 加密后的用户 ID，Cookie 中与 serviceToken 配对使用 |
| `passToken` | 密码认证后获取的中间令牌，用于换取 serviceToken |
| `sid` | Service ID，如 `miothealth` (健康), `passportapi` (账号) |
| `watermark` | 数据增量同步的游标 |
| `_sign` | CSRF 防护签名，**值为 Step 1 响应 JSON 的 `sign` 字段** |

---

## 2. 认证体系 — 完整登录流程

### 2.1 SDK 版本与 SID

**SDK 版本**: PassportSDK **5.3.0.release.79** (源码: `PassportSDK.init()`)

| SID | 用途 |
|---|---|
| `miothealth` | 健康数据 API |
| `passportapi` | 小米账号 SDK 内部使用 |

### 2.2 密码登录 (byPassword)

**源码文件**: `XMPassport.loginByPassword()` (line 2700), `PassportLoginRequest.ByPassword` (line 55)

```
Step 1: 预登录 — 获取 MetaLoginData (sign/qs/callback)

  GET https://account.xiaomi.com/pass/serviceLogin
    ?sid=miothealth
    &_json=true
    &_locale=zh_CN

  Headers:
    User-Agent: PassportSDK/5.3.0.release.79

  Cookies:
    deviceId: <deviceId>                          // string, 设备指纹

  ← 200 OK  application/json
    {
      "sign": "abc123...",     // string → Step 2 body 的 _sign 参数值*
      "qs": "%3F...",          // string → Step 2 body 的 qs 参数值
      "callback": "https://...",// string → Step 2 body 的 callback 参数值
      "_sign": "xyz789..."     // string, 备用 (SDK 自己的 loginByPassword 不使用此字段)
    }

    * 源码证据: PassportLoginRequest.ByPassword.execute() line 59:
      this.arguments.params.easyPut("_sign", metaLoginData.sign)
      // metaLoginData.sign 来自 getMetaLoginData() 返回的 MetaLoginData 第一个字段
      // 即 Step 1 响应 JSON 的 "sign" 字段, 非 "_sign" 字段

Step 2: 密码认证

  POST https://account.xiaomi.com/pass/serviceLoginAuth2
  Content-Type: application/x-www-form-urlencoded

  Headers:
    EUI: <encryptedEui>                            // string, 仅 MIUI 系统有加密器时
    User-Agent: PassportSDK/5.3.0.release.79

  Cookies:
    deviceId: <deviceId>                           // string, 必填
    pass_o: <oaid>                                 // string, 可选
    ick: <captchaIck>                              // string, 验证码时
    ticketToken: <token>                           // string, 验证码时

  Body (form-urlencoded):
    user        <string>  必填, 小米账号/手机号/邮箱
    hash        <string>  必填, MD5(明文密码).toUpperCase() (见 §2.4)
    sid         <string>  必填, "miothealth"
    _json       <string>  必填, "true"
    _sign       <string>  必填, 值 = Step 1 响应 JSON 的 "sign" 字段   ← 注意取 sign 非 _sign!
    qs          <string>  必填, 值 = Step 1 响应 JSON 的 "qs" 字段
    callback    <string>  必填, 值 = Step 1 响应 JSON 的 "callback" 字段
    captCode    <string>  可选, 图形验证码
    cc          <string>  可选, 国家区号 (如 "+86")

  ← 成功 (HTTP 200, passToken 在 Response Header 中!):

    Response Headers:
      userId: 123456789
      passToken: abcd...
      cUserId: encrypted_xxx

    Response Body (JSON):
      {
        "code": 0,
        "securityStatus": 0,
        "ssecurity": "...",
        "psecurity": "...",
        "nonce": 1234567890,
        "location": "...",
        "pwd": 1
      }

    源码证据: parseLoginResult() lines 1054-1136
    - userId, passToken, cUserId 来自 HTTP Response Headers
      常量: BaseConstants.EXTRA_USER_ID = "userId",
             BaseConstants.EXTRA_PASSTOKEN = "passToken",
             "cUserId" 硬编码
    - 非 "passport" 的 sid 会额外走 getServiceTokenByStsUrl() 获取 serviceToken

  ← 需通知确认 (HTTP 200, securityStatus != 0, JSON body 含 notificationUrl):

    Response Body:
      {
        "code": 0,
        "securityStatus": 1,
        "notificationUrl": "https://account.xiaomi.com/pass/notification?..."
      }

    源码证据: processPhoneLoginContent() lines 1393-1415
    - jSONObject.optInt("securityStatus", 0) != 0
    - jSONObject.getString("notificationUrl")
    - URL 可能是相对路径, SDK 内部拼接 ACCOUNT_DOMAIN

  ← 需两步验证 (走 loginByStep2):

    Response Body:
      {
        "code": 0,
        "step1Token": "...",
        "userId": "..."
      }

  ← 需验证码:

    Response Body:
      {
        "code": 87001 (示例),
        "desc": "need captcha",
        "captchaUrl": "https://..."
      }

Step 3: passToken → serviceToken 交换 (两次 HTTP 请求)

  Step 3a: 第一次 — 获取 STS URL

    GET https://account.xiaomi.com/pass/serviceLogin
      ?sid=miothealth
      &_json=true

    Cookies:
      userId: <userId>                            // string, 必填 (来自 Step 2 Header)
      passToken: <passToken>                      // string, 必填 (来自 Step 2 Header)
      deviceId: <deviceId>                        // string, 必填

    ← 200 OK:

      Response Headers:
        userId: <value>
        passToken: <value>                        // 可能已刷新
        cUserId: <value>

      Response Body (JSON):
        {
          "passToken": "...",                     // string
          "cUserId": "...",                       // string
          "ssecurity": "...",                     // string, STS 签名密钥
          "psecurity": "...",                     // string
          "nonce": 1234567890,                    // long, STS 签名参数
          "location": "https://...",              // string, STS URL ← 二次请求的目标
          "pwd": 1,                               // int, 是否有密码
          "child": 0                              // int, -1=未知 0=否 1=是
        }

    源码: parseLoginResult() lines 1054-1136
    - `jSONObject.getString("location")` 提取 STS URL (line 1093)
    - `jSONObject.optString("ssecurity")` 提取签名密钥 (line 1066)
    - `jSONObject.optLong("nonce")` 提取 nonce (line 1067)
    - 当 sid != "passport" → 调用 getServiceTokenByStsUrl() (line 1114)

  Step 3b: 第二次 — STS 签名请求

    GET {location}                                 // ← Step 3a 响应 JSON 的 "location" 字段
      ?clientSign=<signature>
      &_userIdNeedEncrypt=true

    No Cookies (请求不用 Cookie)

    clientSign 计算方式 (源码: getClientSign:608 → Coder.generateSignature:34-60):
      // generateSignature(null, null, {"nonce": nonce}, ssecurity)
      // → arrayList = ["nonce={nonce}", "{ssecurity}"]
      // → 用 & 连接: "nonce={nonce}&{ssecurity}"
      // → hash4SHA1(str) = Base64.encodeToString(SHA1(strBytes), 2)
      clientSign = Base64( SHA1("nonce={nonce}&{ssecurity}") )
      // 注意: 是 SHA1 + Base64, 不是 HMAC-SHA1!

    ← 200 OK:

      Response Headers (源码: getServiceTokenByStsUrl lines 756-770):
        {sid}_serviceToken: <serviceToken>         // 如 "miothealth_serviceToken"
        或 fallback: serviceToken: <serviceToken>  // (if prefixed header is empty)
        {sid}_slh: <slh>                           // 如 "miothealth_slh"
        {sid}_ph: <ph>                             // 如 "miothealth_ph"
        其他 Set-Cookie 字段...

    说明: serviceToken 在 Response Header 中, 不在 JSON body。
    提取后组装最终 MiAccessToken, CookieFetcher 将其转为 Cookie: cUserId + serviceToken。
```

### 2.3 扫码/Ticket 登录

**源码文件**: `XMPassport.loginByPhone()` (line 1008)

```
Step 1: 获取 MetaLoginData

  GET /pass/serviceLogin 同上, 返回 sign/qs/callback

Step 2: Ticket 认证

  POST https://account.xiaomi.com/pass/serviceLoginTicketAuth
  Content-Type: application/x-www-form-urlencoded

  Body:
    user      <string>  必填, userId 或 phoneHash
    ticket    <string>  必填, 扫码得到的 ticket
    sid       <string>  必填, "miothealth"
    _json     <string>  必填, "true"
    _sign     <string>  必填, = MetaLoginData.sign (同 §2.2 的 _sign 来源)
    qs        <string>  必填, MetaLoginData.qs
    callback  <string>  必填, MetaLoginData.callback

  ← 成功: processPhoneLoginContent() 解析, passToken 在 Response Header 中
  ← 需通知: securityStatus != 0, JSON body 含 notificationUrl
```

### 2.4 密码哈希: 单层 MD5

**源码证据**: `XMPassport.java` lines 2722-2731

```java
// str = passwordLoginParams.password (明文)
// Line 2722: 有加密器时
encryptedValue = passWordEncryptor.getEncryptedValue(
    CloudCoder.getMd5DigestUpperCase(str)   // ← MD5(明文)
);

// Line 2731: 无加密器时 (fallback)
easyMap.easyPut("hash", CloudCoder.getMd5DigestUpperCase(str2));
// str2 = str = 明文密码
// = MD5(明文).toUpperCase()
```

**结论: hash = MD5(明文密码).toUpperCase()**，始终是单层 MD5。不存在双层 MD5。加密器只是把 MD5 结果再做加密，输入始终是明文。

### 2.5 设备指纹 (deviceId)

**源码**: `HashedDeviceIdUtil`, `DeviceIdHasher`, `DeviceIDCoder`

设备指纹使用 `CACHED_THEN_RUNTIME_THEN_PSEUDO` 策略（优先级从高到低）:

```
1. 缓存 (SharedPreferences "deviceId")
2. SHA1(ANDROID_ID) → Base64 URL_SAFE (flag=8) → 截断 16 字符
3. FidManager.getFid() (小米安全服务)
4. "oa_" + MD5(OAID).toUpperCase()
5. "an_" + MD5(ANDROID_ID).toUpperCase()
6. "android_" + UUID.randomUUID()
```

**Cookie 组装** (`addDeviceIdInCookies`):
```
Cookie: deviceId=<deviceId>; pass_o=<oaid>
```

```python
import hashlib, base64, uuid

def generate_device_id():
    secret = str(uuid.uuid4()).encode()
    sha1 = hashlib.sha1(secret).digest()
    return base64.urlsafe_b64encode(sha1).decode()[:16]
```

### 2.6 Token 生命周期与 401 处理

**源码**: `VerifyToken` (lines 1-182), `TokenManagerImpl`

| 事件 | HTTP 状态 | 应用行为 |
|---|---|---|
| 正常请求 | 200 | 正常处理 |
| Token 失效 | **401** | `VerifyToken.onHttpResponseBefore()` 捕获 → `mTokenManager.getServiceToken(sid, true, loginPolicy)` → 重试 (最多 3 次) |
| 全部重试失败 | 401 | `ApiException("Token is null, may not be login", 40001)` |

**重要**: `mTokenManager.getServiceToken()` 内部走 `XiaomiAccountManager` (Android AccountManager 本地调用)，**不是 HTTP 请求**。application 实际是通过本地系统服务获取新的 serviceToken。

**自建平台无 Android AccountManager** — 如果你在服务端需要刷新 token，只能走 `loginByPassToken` 路径:
```
GET https://account.xiaomi.com/pass/serviceLogin?sid=miothealth&_json=true
Cookie: userId=<userId>; passToken=<passToken>; deviceId=<deviceId>

→ 返回新的 AccountInfo，内部会自动走 getServiceTokenByStsUrl()
```

### 2.7 用户认证相关健康 API

以下 API 通过 Cookie 认证。

#### 设置用户数据
```
POST https://hlth.io.mi.com/app/v1/user/set_user_data
Content-Type: application/x-www-form-urlencoded
data=<URL-encoded JSON>
→ BaseResult<SetUserDataResult>
```

#### 获取/更新/删除用户 Profile
```
GET  https://hlth.io.mi.com/healthapp/user/get_miot_user_profile      → BaseResult<UserInfoProfile>
POST https://hlth.io.mi.com/healthapp/user/set_miot_user_profile       data=<JSON> → BaseResult<Boolean>
GET  https://hlth.io.mi.com/healthapp/user/remove_miot_user_profile    → BaseResult<Boolean>
```

#### 隐私协议
```
POST https://hlth.io.mi.com/healthapp/privacy/get_privacy_change        data=<JSON>&locale=<locale> → BaseResult<ChangeResult>
POST https://hlth.io.mi.com/healthapp/device/set_privacy_confirmation   data=<JSON> → BaseResponse
```

#### 用户信息收集上报
```
POST https://hlth.io.mi.com/app/v1/privacy/up_userinfo_collect_record
Content-Type: application/x-www-form-urlencoded
data=<URL-encoded JSON>  // 二次编码
→ BaseResult<ReportUserInfoResult>
```

---

## 3. 数据核心 API

> 以下所有 API 通过 Cookie `cUserId=<值>; serviceToken=<值>; locale=zh_CN` 认证。

### 3.1 核心数据端点总览

**源码证据**: `FitnessApiService` (`hlth.io.mi.com/app/v1/`) + `HealthCheckService` (`hlth.research.xiaomiwear.com/app/v1/`)

数据端点存在于 **两个 Host** 上：
- `hlth.io.mi.com/app/v1/` — 主用 (FitnessApiService)
- `hlth.research.xiaomiwear.com/app/v1/` — 研究项目用 (HealthCheckService)

```
// 按时间拉取
GET  hlth.io.mi.com/app/v1/data/get_project_data_by_time
     ?data=<JSON>  → BaseResult<GetProjectByTimeResponse>

// 按 watermark 增量拉取
GET  hlth.io.mi.com/app/v1/data/get_project_data_by_watermark
     ?data=<JSON>  → BaseResult<GetProjectByWMResponse>

// 获取最大 watermark
GET  hlth.io.mi.com/app/v1/data/get_max_project_data_watermark
     ?data=<JSON>  → BaseResult<GetProjectMaxWMResponse>

// 上传数据 (POST)
POST hlth.io.mi.com/app/v1/data/up_project_data
     data=<JSON>  → BaseResult<UpProjectResponse>
```

**源码证据**: 这四个端点都标注 `@aib("path")` = `@GET`, 参数用 `@zkj("data")` = `@Query`。**不是 POST**。

#### get_project_data_by_time 请求示例

```
GET https://hlth.io.mi.com/app/v1/data/get_project_data_by_time?data=<URL-encoded JSON>
```

```json
// data= URL-encode 后的 JSON:
{
  "startTime": 1717372800000,
  "endTime": 1717459200000,
  "dataTypes": ["STEPS", "HEART_RATE", "SLEEP"]
}
```

**响应结构** (`GetProjectByTimeResponse`): 包裹在 `BaseResult<GetProjectByTimeResponse>` 中。`GetProjectByTimeResponse` 字段名由 `com.mi.fitness.persist.server.data` 包定义，具体字段需抓包确认。

#### get_project_data_by_watermark 请求示例

```json
{
  "watermark": 1700000000000,
  "dataTypes": ["STEPS", "HEART_RATE", "SLEEP", "EXERCISE"],
  "limit": 500
}
```

响应中包含新的 `watermark` 供下次增量同步。

#### get_max_project_data_watermark 请求示例

```json
{
  "dataTypes": ["STEPS", "SLEEP"]
}
```

响应示例:
```json
{
  "code": 0,
  "data": {
    "watermark": 1717459200000
  }
}
```

### 3.2 运动数据 API

```
GET  /operate/get_sport_operational_data          ?data=<JSON> → BaseResult<SportsReportOperationalInfo>
POST /running_route/get_user_routes_list          data=<JSON> → BaseResult<RoutesList>
POST /running_route/get_user_routes_info          data=<JSON> → BaseResult<RoutesInfo>
POST /running_route/upload_user_route             data=<JSON> → BaseResult<UploadResult>
POST /running_route/delete_user_routes            data=<JSON> → BaseResult<DeleteResult>
POST /running_route/gen_upload_url                data=<JSON> → BaseResult<UploadUrlResult>
POST /running_route/user_route_strategy           data=<JSON> → BaseResult<RouteStrategy>

GET  https://hlth.io.mi.com/healthapp/diving/get_dive_point_by_latlng  ?data=<JSON> → BaseResult<OneDivingIdReport>
POST https://hlth.io.mi.com/healthapp/running_groups/team_entrance_config  data=<JSON>
GET  https://hlth.io.mi.com/app/v1/pk/get_sport_records  ?data=<JSON>

GET  watch.iot.mi.com/cgi-op/api/v1/miwear/sportShareConfig → SportShareResResult<SportShareRes>
```

> 查询类接口使用 POST 是因为 `data` JSON 可能包含 GPS 坐标等长数据。

### 3.3 统计 API

```
GET /statistics/get_goal_monthly_statistics_data  ?data=<JSON> → BaseResult<GoalMonthlyStatisticsData>
GET /vitality/get_achievement_data                ?data=<JSON> → BaseResult<ThreeTargetMedalInfo>
GET /data/get_aggregated_fitness_data_by_time     ?data=<JSON> → BaseResult<DailyConsumptionData>
```

### 3.4 周报 API

```
GET https://watch.iot.mi.com/cgi-op/api/v1/miwear/health/weeklyList
→ WeekReportResult<WeekReportListResponse>
```

---

## 4. 饮食/营养 API

**Base URL**: `https://hlth.io.mi.com/app/v1/` | **鉴权**: Cookie

```
POST /data/up_diet_records              data=<JSON (encoded=true)> → BaseResult<UpdateDietReportResponse>
GET  /data/get_diet_records_by_time     ?data=<JSON> → BaseResult<DailyDietReport>
POST /data/delete_diet_records          data=<JSON (encoded=true)> → BaseResult<UpdateDietReportResponse>
GET  /diet/food_search                  ?data=<JSON> → BaseResult<FoodSearchListData>
POST /diet/food_collect                 data=<JSON> → BaseResult<FoodCollectResult>
GET  /diet/food_collect_cancel          ?data=<JSON> → BaseResult<FoodCollectResult>
GET  /diet/food_collect_list            ?data=<JSON> → BaseResult<FoodFavoriteListData>
POST /diet/food_collected               data=<JSON (encoded=true)> → BaseResult<FoodCollectResult>
GET  /diet/food_list                    ?data=<JSON> → BaseResult<FoodListData>
GET  /diet/food_detail                  ?data=<JSON> → BaseResult<FoodDetailData>
GET  /diet/user_consumption             ?data=<JSON> → BaseResult<HeatConsumptionData>
GET  /statistics/batch_get_diet_summary  ?data=<JSON> → BaseResult<DietSummaryData>
GET  /diet/diet_advice                  ?data=<JSON> → BaseResult<DietSuggestionData>
```

---

## 5. 体重/体脂秤 API

**Base URL**: `https://hlth.io.mi.com/app/v1/` | **鉴权**: Cookie

```
POST /eco/api_proxy
Content-Type: application/x-www-form-urlencoded

方式一: eco_api=<api_name>&params=<JSON>
方式二: data=<JSON>

→ BaseResult<ScaleData>
```

> **注意**: eco_api 的具体枚举值未在反编译出的 Java 源码中找到（定义在 Kotlin 中且被混淆为短名）。ScaleRequest 类中使用 `eco_api` 和 `params` 两个字符串参数。具体值需要抓包确认。

---

## 6. 睡眠 API

**Base URL**: `https://hlth.io.mi.com/app/v1/` | **鉴权**: Cookie

```
GET  /statistics/get_sleep_users_distribution  ?data=<JSON> → BaseResult<SleepDistributeResult>   (loginPolicy=3)
POST /sleepInterventionPlans/create            data=<JSON> → BaseResult<SleepInterferePlan>
POST /sleepInterventionPlans/update            data=<JSON> → BaseResult<SleepInterferePlan>
POST /sleepInterventionPlans/list              data=<JSON> → BaseResult<SleepInterferePlanListResult>
POST /sleepInterventionPlans/get               data=<JSON> → BaseResult<SleepInterferePlan>
POST /sleepInterventionPlans/tasks/list        data=<JSON> → BaseResult<SleepInterferePlanTaskResult>
POST /sleepInterventionPlans/tasks/update      data=<JSON> → BaseResult<SleepInterfereDayTask>
POST /sleepInterventionPlans                   (空路径, 停止计划, 无 body) → HTTP 200
GET  /healthapp/third/alipay/aq/get_faq        ?data=<JSON> → BaseResult<List<AqQuestion>>
GET  /user/get_project_user_info               → BaseResult<SleepRhythmProjectUserInfo>
POST /user/set_project_user_info               data=<JSON> → BaseResult<SetResult>
GET  /service/gen_research_upload_url           ?data=<JSON> → BaseResult<List<ResearchPresignedUrlResponse>>
```

---

## 7. 训练计划 API

**Base URL**: `https://hlth.io.mi.com/app/v1/` | **鉴权**: Cookie

### 能力提升
```
GET  smart_running/improve/user_ability         → BaseResult<UserAbility>
POST smart_running/improve/generate             data=<JSON> → BaseResult<GenerateAbilityPlanResult>
POST smart_running/improve/summary              data=<JSON> → BaseResult<AbilityDetailSummary>
POST smart_running/improve/course_detail        data=<JSON> → BaseResult<GetAbilityCourseInfo>
POST smart_running/improve/adjust               data=<JSON> → BaseResult<SettingUpdateResult>
GET  smart_running/improve/terminate            → BaseResult<StopAbilityPlanResult>
GET  smart_running/week_plan                    → BaseResult<GetCurAbilityPlanResult>
```

### 习惯养成
```
POST smart_running/build/suggest            data=<JSON> → GetHabitPlanSuggestResult
POST smart_running/build/adjust             data=<JSON> → GenerateHabitPlanResult
POST smart_running/build/summary            data=<JSON> → BaseResult<HabitPlanHome>
POST smart_running/build/setting            data=<JSON> → BaseResult<ExecStatusResult>
GET  smart_running/build/detail             → BaseResult<GetHabitPlanDetailResult>
GET  smart_running/build/improve_check      → BaseResult<HabitPlanImprove>
POST smart_running/build/improve_reply      data=<JSON> → BaseResult<HabitSuccessResult>
GET  smart_running/build/teminate           → BaseResult<HabitSuccessResult>
```

### 报告与配置
```
POST smart_running/plan_report                data=<JSON> → BaseResult<TrainReport>
POST smart_running/plan_report/sport_record   data=<JSON> → BaseResult<GetPlanSportReportListResult>
POST smart_running/plan_report/history        data=<JSON> → BaseResult<GetPlanHistoryResult>
GET  smart_running/force_stop_check           → BaseResult<ForceStopCheckResult>
GET  smart_running/entrance                   → BaseResult<GetEntranceInfoResult>
POST plan/remind_info                         data=<JSON> → BaseResult<SportRemindSettings>
POST plan/remind_set                          data=<JSON> → BaseResult<ExecStatusResult>
```

---

## 8. 第三方数据对接 API

**Base URL**: `https://hlth.io.mi.com/healthapp/` | **鉴权**: Cookie

```
POST auth/third_party                     data=<JSON> → BaseResult<SetThirdPartyAuthResult>
GET  auth/get_thirdparty_auth_config       ?data=<JSON> → BaseResult<GetConfigListResult>
POST auth/get_third_party                 data=<JSON> → BaseResult<GetThirdPartyResult>
POST auth/miapp/update_scopes             data=<JSON> → BaseResult<UpdateMiAppAuthScopeListResult>
GET  auth/miapp/get_scopes                ?data=<JSON> → BaseResult<GetMiAppAuthScopeListResult>
POST auth/lab/grant                       data=<JSON> → BaseResult<GrantLabAuthResult>
POST auth/lab/revoke                      data=<JSON> → BaseResult<RevokeLabAuthResult>
GET  auth/lab/get_auth_config             ?data=<JSON> → BaseResult<GetLabConfigResult>
POST third/googlefit/bind                 data=<JSON> → BaseResult<GoogleFitBindResultModel>
GET  third/googlefit/bind_state           → BaseResult<GetGoogleFitBindStatusResultModel>
GET  third/googlefit/unbind               → BaseResult<GoogleFitUnbindResultModel>
POST third/strava/bind_authorize_strava   data=<JSON> → BaseResult<StravaBindResult>
GET  third/strava/get_bind_status         → BaseResult<StravaBindResult>
GET  open/bind_to_wechat                  ?data=<JSON> → BaseResult<WechatBindResult>
POST third/alipay/bind_alipay_user        data=<JSON> → BaseResult<AlipayBindResult>
GET  huami/data_migrate/auth_list         ?data=<JSON> → BaseResult<MiSportDataList>
GET  huami/data_migrate/item_status       ?data=<JSON> → BaseResult<MiSportStatusList>
GET  huami/data_migrate/latest_record     → BaseResult<MiSportStatus>
POST huami/data_migrate/trigger           data=<JSON> → BaseResult<MigrateResponse>
POST third/bind/oauth2                    data=<JSON> → BaseResult<ThirdPartyBindResultModel>
```

---

## 9. 其他 API

### 天气
```
GET https://hlth.io.mi.com/healthapp/weather/get_weather_info_v3       ?locale=<locale>&data=<JSON> → WeatherResp
GET https://hlth.io.mi.com/healthapp/weather/get_weather_pressure_v2    ?data=<JSON> → PressureResp
GET https://hlth.io.mi.com/healthapp/weather/get_city_location_info     ?data=<JSON>&locale=<locale> → LocationByNameResp
```

### 消息/通知/习惯/推送/勋章/ECG/亲友/隐私
```
GET  /message/batch_get_msg                  ?data=<JSON>
GET  /message/get_alert_msg                  ?data=<JSON>
GET  watch.iot.mi.com/.../habit/all          → HabitResult<HabitShopBean>
POST watch.iot.mi.com/.../habit/update       data=<JSON> → HabitResult<AddHabitResp>
POST /plugin/access_plugin                   data=<JSON>
GET  /membership/config                      → BaseResult<...>
GET  /ops/v1/medal/detail                    ?data=<JSON>
GET  /ecg/get_vip_info                       → BaseResult<...>
POST /relatives/send_invite                  data=<JSON>
POST /relatives/delete_relative              data=<JSON>
POST /privacy/logoff_service                 data=<JSON>
POST /privacy/device/delete                  data=<JSON>
```

---

## 10. 自建数据中心同步方案

### 方案 A: Android Health Connect API (✅ 强烈推荐)
直接从系统 Health Connect 读取标准化的健康数据。无需逆向小米 API 或管理 Token。

### 方案 B: 直接调用小米健康 API (✅ 已验证可行)
**原理**: 模拟 HTTP 请求。

**更新后的正确步骤**:
1. 登录获取 `passToken` (§2.2 Step 2) — passToken 在 Response Headers 中
2. 交换 `serviceToken` (§2.2 Step 3) — GET /pass/serviceLogin (Cookie: passToken)
3. Cookie 传入 `cUserId=<值>; serviceToken=<值>; locale=zh_CN`
4. 核心数据用 **GET** `/app/v1/data/get_project_data_by_time?data=<JSON>`
5. 增量同步用 **GET** `/app/v1/data/get_project_data_by_watermark?data=<JSON>`
6. Token 过期 (401) → 重新走 Step 2→3 获取新 serviceToken

### 方案 C/D: 第三方桥接 / 隐私导出 (有限支持)

---

## 11. 实现参考代码

### 11.1 Python: 完整密码登录 + 获取健康数据 (含 STS 转发 + 完整错误处理)

> **依赖**: `pip install requests`
> **文件**: 保存为 `hardened_login.py` 即可运行
> **版本**: 此版本含完整错误处理，禁止静默失败

```python
#!/usr/bin/env python3
"""
小米运动健康 API 登录 + 数据拉取 — 含完整错误处理
源码依据: com.xiaomi.accountsdk.account.XMPassport + com.xiaomi.fitness.account.token.*
"""
import hashlib, base64, uuid, sys, logging
import requests, json
from urllib.parse import quote, urlencode

# ── 日志: INFO 级别, 不打印密码明文 ──
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger("mihealth")

# ── 配置 ──
SID = "miothealth"
USER_AGENT = "PassportSDK/5.3.0.release.79 XiaomiAccountSSO/5.3.0.release.79"
ACCOUNT_BASE = "https://account.xiaomi.com"
HEALTH_BASE = "https://hlth.io.mi.com"
TIMEOUT = 15  # 秒


# ═══════════════════════════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════════════════════════

class MiHealthError(Exception):
    """所有错误的基类, 携带上下文"""
    def __init__(self, message, step="", url="", method="", status=None, body=""):
        super().__init__(message)
        self.step = step
        self.url = url
        self.method = method
        self.status = status
        self.body = body[:500]  # 截断

    def __str__(self):
        parts = [f"{self.step}: {super().__str__()}"]
        if self.url:
            parts.append(f"  {self.method} {self.url}")
        if self.status:
            parts.append(f"  HTTP {self.status}")
        if self.body:
            parts.append(f"  Body (前200字符): {self.body[:200]}")
        return "\n".join(parts)


def _check_http(resp, step_name):
    """统一 HTTP 状态码检查"""
    if resp.status_code != 200:
        raise MiHealthError(
            f"HTTP {resp.status_code}",
            step=step_name,
            url=resp.request.url,
            method=resp.request.method,
            status=resp.status_code,
            body=resp.text,
        )


def _check_json(resp, step_name):
    """安全 JSON 解析, 失败时携带原始响应"""
    try:
        return resp.json()
    except (json.JSONDecodeError, ValueError) as e:
        raise MiHealthError(
            f"JSON 解析失败: {e}",
            step=step_name,
            url=resp.request.url,
            method=resp.request.method,
            status=resp.status_code,
            body=resp.text,
        )


def generate_device_id():
    """源码: HashedDeviceIdUtil → SHA1 → Base64 URL_SAFE → [:16]"""
    secret = str(uuid.uuid4()).encode()
    sha1 = hashlib.sha1(secret).digest()
    return base64.urlsafe_b64encode(sha1).decode()[:16]


def hash_password(password):
    """源码: XMPassport.java:2731 — getMd5DigestUpperCase(明文) — 单层 MD5"""
    return hashlib.md5(password.encode()).hexdigest().upper()


def compute_client_sign(nonce, ssecurity):
    """
    源码: getClientSign(608-612) → Coder.generateSignature(34-60)

    算法 (非 HMAC!):
      1. 拼接: "nonce={nonce}&{ssecurity}"
      2. SHA1(拼接字符串) → bytes
      3. Base64(SHA1 bytes)

    Coder.generateSignature 内部:
      - arrayList.add("nonce={nonce}")  // TreeMap 迭代
      - arrayList.add(ssecurity)        // 始终追加
      - sb = join("&", arrayList)       // → "nonce={n}&{sec}"
      - hash4SHA1(sb)                   // → SHA1 → Base64(NO_WRAP)
    """
    msg = f"nonce={nonce}&{ssecurity}"
    sha1_digest = hashlib.sha1(msg.encode("utf-8")).digest()
    return base64.b64encode(sha1_digest).decode()


# ═══════════════════════════════════════════════════════════════
# Step 1: 预登录
# ═══════════════════════════════════════════════════════════════

def step1_pre_login(device_id, oaid=""):
    """获取 MetaLoginData (sign/qs/callback)"""
    log.info("Step 1: 预登录 deviceId=%s...", device_id[:8])
    url = f"{ACCOUNT_BASE}/pass/serviceLogin"

    resp = requests.get(
        url,
        params={"_json": "true", "sid": SID, "_locale": "zh_CN"},
        headers={"User-Agent": USER_AGENT},
        cookies={"deviceId": device_id, "pass_o": oaid},
        timeout=TIMEOUT,
    )
    _check_http(resp, "Step 1: serviceLogin")
    body = _check_json(resp, "Step 1: serviceLogin")

    sign = body.get("sign", "")
    # 源码: ByPassword.execute() uses metaLoginData.sign
    # Step 2 body._sign = 这里的 "sign" 字段, 不是 "_sign"
    if not sign or sign == body.get("_sign", "x") == sign == "":
        # 没有任何 sign 返回 → 网络代理/风控拦截
        raise MiHealthError(
            "Step 1: 未返回 sign 字段, 可能被风控拦截或账号状态异常",
            step="Step 1", url=url, method="GET",
            body=json.dumps(body),
        )

    log.info("Step 1 OK: sign=%s..., qs=%s chars, cb=%s chars",
             sign[:16], len(body.get("qs", "")), len(body.get("callback", "")))
    return {"sign": sign, "qs": body.get("qs", ""), "callback": body.get("callback", "")}


# ═══════════════════════════════════════════════════════════════
# Step 2: 密码认证
# ═══════════════════════════════════════════════════════════════

def step2_login_by_password(user, password, meta, device_id, captcha=None):
    """
    密码认证 → 获取 passToken (在 HTTP Response Header)
    源码: XMPassport.loginByPassword() → parseLoginResult()
    """
    log.info("Step 2: 密码认证 user=%s device=%s...", user, device_id[:8])
    url = f"{ACCOUNT_BASE}/pass/serviceLoginAuth2"

    form = {
        "user": user,
        "hash": hash_password(password),
        "sid": SID,
        "_json": "true",
        "_sign": meta["sign"],      # ← sign, 不是 _sign!
        "qs": meta.get("qs", ""),
        "callback": meta.get("callback", ""),
    }
    cookies = {"deviceId": device_id}
    if captcha:
        form["captCode"] = captcha["code"]
        cookies["ick"] = captcha.get("ick", "")

    resp = requests.post(
        url,
        data=form,
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        cookies=cookies,
        allow_redirects=False,
        timeout=TIMEOUT,
    )
    _check_http(resp, "Step 2: serviceLoginAuth2")

    # 源码: parseLoginResult — passToken/userId 在 Response Headers
    user_id     = (resp.headers.get("userId") or "").strip()
    pass_token  = (resp.headers.get("passToken") or "").strip()
    c_user_id   = (resp.headers.get("cUserId") or "").strip()

    if pass_token:
        log.info("Step 2 OK: userId=%s passToken=%s... cUserId=%s",
                 user_id, pass_token[:16], c_user_id[:16] if c_user_id else "(empty)")
        return {"userId": user_id, "passToken": pass_token, "cUserId": c_user_id}

    # ── passToken 未出现在 Header → 需要判断错误场景 ──
    body = _check_json(resp, "Step 2: serviceLoginAuth2 body")

    if "notificationUrl" in body:
        raise MiHealthError(
            f"Step 2: 需要通知确认. notificationUrl={body.get('notificationUrl','')}",
            step="Step 2", url=url, method="POST", status=200,
            body=json.dumps(body),
        )
    if body.get("securityStatus", 0) != 0:
        raise MiHealthError(
            f"Step 2: 需要二次验证. securityStatus={body.get('securityStatus')}",
            step="Step 2", url=url, method="POST", status=200,
            body=json.dumps(body),
        )
    # 其他未知失败
    raise MiHealthError(
        f"Step 2: 未返回 passToken, code={body.get('code')} desc={body.get('desc','?')}",
        step="Step 2", url=url, method="POST", status=200,
        body=json.dumps(body),
    )


# ═══════════════════════════════════════════════════════════════
# Step 3: passToken → serviceToken (两次 HTTP 请求)
# ═══════════════════════════════════════════════════════════════

def step3_get_service_token(user_id, pass_token, device_id):
    """
    Step 3a: GET /pass/serviceLogin → STS URL + ssecurity + nonce
    Step 3b: GET {location}?clientSign=SHA1+Base64 → serviceToken (in Header)

    源码: parseLoginResult() + getServiceTokenByStsUrl()
    sid="miothealth" (非 "passport") 时必然走 STS 转发分支.
    """
    log.info("Step 3a: 获取 STS URL userId=%s passToken=%s... device=%s...",
             user_id, pass_token[:16], device_id[:8])

    # ── Step 3a ──
    url_3a = f"{ACCOUNT_BASE}/pass/serviceLogin"
    resp_a = requests.get(
        url_3a,
        params={"_json": "true", "sid": SID},
        headers={"User-Agent": USER_AGENT},
        cookies={
            "userId": user_id,
            "passToken": pass_token,
            "deviceId": device_id,
        },
        allow_redirects=False,
        timeout=TIMEOUT,
    )
    _check_http(resp_a, "Step 3a: serviceLogin")
    body_a = _check_json(resp_a, "Step 3a: serviceLogin body")

    location  = body_a.get("location", "")       # 源码: jSONObject.getString("location")
    nonce     = body_a.get("nonce", 0)            # 源码: jSONObject.optLong("nonce")
    ssecurity = body_a.get("ssecurity", "")       # 源码: jSONObject.optString("ssecurity")
    c_user_id = (resp_a.headers.get("cUserId") or body_a.get("cUserId", "") or "").strip()

    if not location or location == "null":
        raise MiHealthError(
            "Step 3a: 响应缺少 STS URL (location 字段). sid 非 passport 时应必然存在",
            step="Step 3a", url=url_3a, method="GET", status=200,
            body=json.dumps(body_a),
        )
    if not ssecurity:
        raise MiHealthError(
            "Step 3a: 响应缺少 ssecurity (STS 签名密钥)",
            step="Step 3a", url=url_3a, method="GET", status=200,
            body=json.dumps(body_a),
        )

    log.info("Step 3a OK: location=%s... nonce=%s", location[:50], nonce)

    # ── Step 3b ──
    log.info("Step 3b: STS 签名请求...")
    client_sign = compute_client_sign(nonce, ssecurity)

    resp_b = requests.get(
        location,
        params={
            "clientSign": client_sign,
            "_userIdNeedEncrypt": "true",
        },
        headers={"User-Agent": USER_AGENT},
        timeout=TIMEOUT,
    )
    _check_http(resp_b, "Step 3b: STS URL")

    # 源码: getServiceTokenByStsUrl lines 756-770
    # Header: "{sid}_serviceToken" → fallback "serviceToken"
    svc_token = (resp_b.headers.get(f"{SID}_serviceToken") or "").strip()
    if not svc_token:
        svc_token = (resp_b.headers.get("serviceToken") or "").strip()
    if not svc_token:
        raise MiHealthError(
            "Step 3b: 响应 Header 缺少 serviceToken (尝试了 miothealth_serviceToken 和 serviceToken)",
            step="Step 3b", url=location, method="GET", status=resp_b.status_code,
            body="; ".join(f"{k}={v}" for k, v in resp_b.headers.items() if "token" in k.lower() or "slh" in k.lower()),
        )

    slh = (resp_b.headers.get(f"{SID}_slh") or "").strip()
    ph  = (resp_b.headers.get(f"{SID}_ph") or "").strip()

    log.info("Step 3b OK: serviceToken=%s... cUserId=%s slh=%s",
             svc_token[:20], c_user_id[:16] if c_user_id else "(empty)", slh[:16] if slh else "(empty)")

    return {
        "serviceToken": svc_token,
        "cUserId": c_user_id,
        "userId": user_id,
        "slh": slh,
        "ph": ph,
    }


# ═══════════════════════════════════════════════════════════════
# 健康数据 API
# ═══════════════════════════════════════════════════════════════

def call_health_api_get(endpoint, c_user_id, service_token, params=None):
    """源码: FitnessApiService — @aib = @GET, @zkj = @Query"""
    url = f"{HEALTH_BASE}/app/v1/{endpoint}"
    if params:
        url += "?data=" + quote(json.dumps(params, separators=(',', ':')))

    log.info("Health API GET %s params_keys=%s", endpoint, list(params.keys()) if params else [])
    resp = requests.get(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Cookie": f"cUserId={c_user_id}; serviceToken={service_token}; locale=zh_CN",
        },
        timeout=TIMEOUT,
    )
    _check_http(resp, f"Health GET /{endpoint}")

    # 401 特殊处理: 提示需刷新 Token
    if resp.status_code == 401:
        raise MiHealthError(
            "Health API 返回 401 — serviceToken 已失效. 需重新走 Step 2→3 登录流程.",
            step=f"Health GET /{endpoint}", url=url, method="GET", status=401,
        )

    return _check_json(resp, f"Health GET /{endpoint}")


# ═══════════════════════════════════════════════════════════════
# 完整流程
# ═══════════════════════════════════════════════════════════════

def login_and_get_data(user, password):
    """返回 (token_dict, health_data_dict)"""
    device_id = generate_device_id()
    log.info("=== 开始登录流程 ===")

    # Step 1
    meta = step1_pre_login(device_id)

    # Step 2
    login = step2_login_by_password(user, password, meta, device_id)

    # Step 3
    token = step3_get_service_token(login["userId"], login["passToken"], device_id)

    # Step 4
    data = call_health_api_get(
        "data/get_project_data_by_time",
        token["cUserId"], token["serviceToken"],
        {
            "startTime": 1717372800000,
            "endTime": 1717459200000,
            "dataTypes": ["STEPS", "HEART_RATE", "SLEEP"],
        },
    )
    log.info("=== 完成: 获取到 %s 条数据键 ===", len(data.get("data", data)))
    return token, data


# ═══════════════════════════════════════════════════════════════
# 入口
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import getpass

    user = input("小米账号 (手机/邮箱/ID): ").strip()
    if not user:
        print("[FAIL] 账号不能为空"); sys.exit(1)
    pwd = getpass.getpass("密码: ")
    if not pwd:
        print("[FAIL] 密码不能为空"); sys.exit(1)

    try:
        token, data = login_and_get_data(user, pwd)
    except MiHealthError as e:
        print(f"\n{'='*60}\n[ERROR] 登录失败\n{'='*60}")
        print(e)
        sys.exit(1)
    except requests.exceptions.Timeout as e:
        print(f"\n[ERROR] 网络超时: {e}"); sys.exit(1)
    except requests.exceptions.ConnectionError as e:
        print(f"\n[ERROR] 网络连接失败: {e}"); sys.exit(1)

    print(f"\nToken: userId={token['userId']} serviceToken={token['serviceToken'][:20]}...")
    print(json.dumps(data, indent=2, ensure_ascii=False))
```

### 11.2 cURL: 快速测试 (含 STS 转发)

> **前提**: 需要 `jq`, `openssl`, `md5sum` (或 `md5` on macOS), `python3`

```bash
#!/bin/bash
set -euo pipefail  # 遇错即停, 未定义变量报错

# ===== 用户输入 =====
read -p "小米账号 (手机/邮箱/ID): " XIAOMI_USER
read -sp "密码: " XIAOMI_PWD; echo
# (注意: 使用 XIAOMI_PWD 而非 PWD, 因为 $PWD 是 bash 内置变量)

# ===== 设备指纹生成 =====
DEVICE_ID=$(python3 -c \
  "import hashlib,base64,uuid;print(base64.urlsafe_b64encode(hashlib.sha1(uuid.uuid4().hex.encode()).digest()).decode()[:16])")
echo "[OK] DEVICE_ID=$DEVICE_ID"

# ===== Step 1: 预登录 =====
META=$(curl -s -G "https://account.xiaomi.com/pass/serviceLogin" \
  -d "_json=true" -d "sid=miothealth" -d "_locale=zh_CN" \
  -H "User-Agent: PassportSDK/5.3.0.release.79" \
  -b "deviceId=$DEVICE_ID")

SIGN=$(echo "$META" | jq -r '.sign')         # ← sign, 不是 _sign!
QS=$(echo "$META"   | jq -r '.qs')
CB=$(echo "$META"   | jq -r '.callback')

if [ -z "$SIGN" ] || [ "$SIGN" = "null" ]; then
  echo "[FAIL] Step 1: 未获取到 sign, 响应: $META"; exit 1
fi
echo "[OK] Step 1: sign=${SIGN:0:16}..."

# ===== Step 2: 密码认证 =====
HASH=$(echo -n "$XIAOMI_PWD" | md5sum | tr 'a-z' 'A-Z' | cut -d' ' -f1)
# (macOS 用: md5 -q | tr 'a-z' 'A-Z')

LOGIN=$(curl -s -i -X POST "https://account.xiaomi.com/pass/serviceLoginAuth2" \
  -d "user=$XIAOMI_USER" \
  -d "hash=$HASH" -d "sid=miothealth" -d "_json=true" \
  -d "_sign=$SIGN" -d "qs=$QS" -d "callback=$CB" \
  -H "User-Agent: PassportSDK/5.3.0.release.79" \
  -b "deviceId=$DEVICE_ID")

# passToken/userId 在 HTTP Response Headers 中 (源码: parseLoginResult)
PASS_TOKEN=$(echo "$LOGIN" | grep -i '^passToken:' | head -1 | cut -d' ' -f2 | tr -d '\r')
USER_ID=$(echo "$LOGIN"    | grep -i '^userId:'    | head -1 | cut -d' ' -f2 | tr -d '\r')

if [ -z "$PASS_TOKEN" ]; then
  echo "[FAIL] Step 2: 未获取到 passToken. 可能是验证码/二次验证."
  echo "Response headers+body (前 30 行):"; echo "$LOGIN" | head -30
  exit 1
fi
echo "[OK] Step 2: PASS_TOKEN=${PASS_TOKEN:0:16}... USER_ID=$USER_ID"

# ===== Step 3a: 获取 STS URL + ssecurity + nonce =====
STS_A=$(curl -s -i -G "https://account.xiaomi.com/pass/serviceLogin" \
  -d "_json=true" -d "sid=miothealth" \
  -H "User-Agent: PassportSDK/5.3.0.release.79" \
  -b "userId=$USER_ID; passToken=$PASS_TOKEN; deviceId=$DEVICE_ID")

CUSER_ID=$(echo "$STS_A" | grep -i '^cUserId:' | head -1 | cut -d' ' -f2 | tr -d '\r')

# 提取 JSON body: curl -i 输出头+空行+body, awk 按空行分段取 JSON 段
STS_BODY=$(echo "$STS_A" | awk 'BEGIN{RS=""} /^{/{print; exit}')

LOCATION=$(echo  "$STS_BODY" | jq -r '.location')
NONCE=$(echo     "$STS_BODY" | jq -r '.nonce')
SSECURITY=$(echo "$STS_BODY" | jq -r '.ssecurity')

if [ -z "$LOCATION" ] || [ "$LOCATION" = "null" ]; then
  echo "[FAIL] Step 3a: 未获取到 STS URL (location)."
  echo "STS body: $STS_BODY"; exit 1
fi
echo "[OK] Step 3a: CUSER_ID=$CUSER_ID"

# ===== Step 3b: STS 签名请求 =====
# clientSign = Base64( SHA1("nonce={nonce}&{ssecurity}") )
# 源码: Coder.generateSignature → hash4SHA1 → SHA1 → Base64(NO_WRAP)
CLIENT_SIGN=$(echo -n "nonce=$NONCE&$SSECURITY" \
  | openssl dgst -sha1 -binary \
  | base64)

STS_B=$(curl -s -i -G "$LOCATION" \
  -d "clientSign=$CLIENT_SIGN" \
  -d "_userIdNeedEncrypt=true" \
  -H "User-Agent: PassportSDK/5.3.0.release.79")

# serviceToken 在 Header: "{sid}_serviceToken" 或 fallback "serviceToken"
SERVICE_TOKEN=$(echo "$STS_B" \
  | grep -E -i '^miothealth_serviceToken:|^serviceToken:' \
  | head -1 | cut -d' ' -f2 | tr -d '\r' || true)

if [ -z "$SERVICE_TOKEN" ]; then
  echo "[FAIL] Step 3b: 未获取到 serviceToken."
  echo "STS response headers (前 20 行):"; echo "$STS_B" | head -20
  exit 1
fi

# ===== 导出凭证 =====
echo ""
echo "=========================================="
echo "  凭证就绪. 复制以下命令到新终端复用:"
echo "=========================================="
echo "  export CUSER_ID='$CUSER_ID'"
echo "  export SERVICE_TOKEN='$SERVICE_TOKEN'"
echo "  export DEVICE_ID='$DEVICE_ID'"
echo "=========================================="
echo ""
echo "  # 快速测试 (直接复制运行):"
echo "  curl -s -G 'https://hlth.io.mi.com/app/v1/data/get_project_data_by_time' \\"
echo "    --data-urlencode 'data={\"startTime\":1717372800000,\"endTime\":1717459200000,\"dataTypes\":[\"STEPS\"]}' \\"
echo "    -H 'Cookie: cUserId=$CUSER_ID; serviceToken=$SERVICE_TOKEN; locale=zh_CN' \\"
echo "    -H 'User-Agent: PassportSDK/5.3.0.release.79' | jq ."
echo "=========================================="

# ===== Step 4: 拉取健康数据 =====
echo ""
echo "[Step 4] 拉取健康数据..."
curl -s -G "https://hlth.io.mi.com/app/v1/data/get_project_data_by_time" \
  --data-urlencode 'data={"startTime":1717372800000,"endTime":1717459200000,"dataTypes":["STEPS","HEART_RATE","SLEEP"]}' \
  -H "Cookie: cUserId=$CUSER_ID; serviceToken=$SERVICE_TOKEN; locale=zh_CN" \
  -H "User-Agent: PassportSDK/5.3.0.release.79" \
  | jq .
```

---

## 12. 附录

### 混淆注解映射表

小米健康使用了 ProGuard 混淆，Retrofit 注解名被重命名：

| 混淆名称 | 原始注解 | 作用 | 示例 |
|---|---|---|---|
| `@aib` | `@GET` | HTTP GET | `@aib("path")` |
| `@sma` / `@vki` | `@POST` / path | HTTP POST | `@vki("path")` |
| `@q3a` | `@Field` | POST 表单字段 | `@q3a("data")` |
| `@zkj` | `@Query` | URL 查询参数 | `@zkj("data")` |
| `@d2s` | `@Url` | 动态 URL | `@d2s String url` |
| `@alj` | `@QueryMap` | 查询参数 Map | `@alj HashMap` |
| `@hbc` | `@Header` | HTTP 头部 | `@hbc("Authorization")` |
| `@ed3` | `@Body` | 请求体 | `@ed3 RequestBody` |
| `@u3a` | `@FieldMap` | 表单字段 Map | `@u3a HashMap` |
| `@o3q` | `@Streaming` | 流式响应 | — |

### 通用响应包装 `BaseResult<T>`

```json
{
  "code": 0,            // int, 0=成功
  "message": "ok",      // string
  "data": { ... }       // T, 字段名始终为 "data"
}
```

### HTTP 状态码与错误参考

| HTTP 状态 | 含义 | 处理方式 |
|---|---|---|
| 200 + code=0 | 成功 | 正常处理 |
| 200 + code≠0 | 业务错误 | 检查 `message`/`desc` |
| 200 + securityStatus≠0 | 需通知确认 | JSON body 含 `notificationUrl` |
| 401 | Token 失效 | 重走 passToken→serviceToken 流程 |

### ErrorCode 枚举 (SDK 内部, 非 HTTP)

| 枚举 | 说明 |
|---|---|
| `ERROR_NONE` | 无错误 |
| `ERROR_NO_ACCOUNT` | 无小米账号 |
| `ERROR_USER_INTERACTION_NEEDED` | 需弹出登录页 |
| `ERROR_APP_PERMISSION_FORBIDDEN` | 应用权限禁止 |
| `ERROR_CANCELLED` | 操作取消 |
| `ERROR_AUTHENTICATOR_ERROR` | 认证器错误 |
| `ERROR_IOERROR` | 网络错误 |

---

> **文档版本**: 4.0 (源码验证版)
> **变更历史**:
> - v1.0: 初始端点枚举
> - v2.0: +完整登录、密码加密、设备指纹、参考代码
> - v3.0: +审计修复、Schema、术语表、错误码
> - v4.0: **源码级修复** — 密码确认为单层 MD5, 数据端点确认为 GET, _sign 取 sign 字段, passToken 来自 Header, Token 刷新无 HTTP 端点, 补全注解源代码引用
> **工具链**: jadx 1.4.7 + apktool 2.7.0 + dex2jar 2.4.36 + Vineflower 1.12.0
