# xiaomi-cloud-sync

## Purpose

实现与小米运动健康云服务的对接，包括账号认证（密码/二维码/手动 Token）、凭证加密存储、健康数据同步与映射、幂等写入、Token 自动刷新以及基于 cron 的定时同步调度。

## Requirements

### Requirement: 小米账号认证

系统 SHALL 支持三种小米运动健康认证方式：账号密码登录（预登录 → 密码哈希认证 → STS 换取 serviceToken 完整流程）、二维码扫码登录（获取二维码 → 长轮询等待扫码 → STS 换取 serviceToken）、手动导入 Token（至少提供 `serviceToken` 与 `cUserId`）。认证失败时 MUST 返回可区分的错误原因（密码错误、需二次验证、风控拦截、二维码过期、网络异常）。

#### Scenario: 密码登录成功

- **WHEN** 用户提供正确的小米账号与密码发起认证
- **THEN** 系统完成三步登录流程并返回包含 serviceToken、cUserId、passToken 的凭证

#### Scenario: 密码登录被风控拦截

- **WHEN** 小米在预登录阶段不返回 sign 字段
- **THEN** 系统返回"可能被风控拦截或账号状态异常"的错误，不泄露内部堆栈

#### Scenario: 二维码登录成功

- **WHEN** 系统展示二维码且用户在有效期内用小米运动健康扫码确认
- **THEN** 长轮询返回凭证，系统经 STS 交换获得 serviceToken 并完成绑定

#### Scenario: 二维码过期

- **WHEN** 用户在二维码有效期内未完成扫码
- **THEN** 轮询返回 expired 状态，前端提示重新生成二维码

#### Scenario: 手动导入 Token

- **WHEN** 用户直接提交有效的 serviceToken 与 cUserId
- **THEN** 系统跳过登录流程直接保存凭证，可用于后续同步

### Requirement: 凭证安全存储

系统 SHALL 在保存小米凭证到数据库前使用 AES-256-GCM 加密（密钥来自 `SYNC_TOKEN_SECRET` 环境变量），读取使用时解密。密钥缺失时同步功能 MUST 禁用并给出告警，但不得阻塞主应用启动。数据库中 MUST NOT 出现明文凭证。已存在的明文凭证在下次读取时 MUST 自动迁移为密文。

#### Scenario: 凭证加密落库

- **WHEN** 用户完成任意一种登录
- **THEN** 数据库 `SyncSourceConfig.token` 字段为 `v1.` 前缀的密文，无法直接读出 serviceToken

#### Scenario: 密钥缺失

- **WHEN** `SYNC_TOKEN_SECRET` 未配置时服务启动
- **THEN** 同步功能不可用并输出告警日志，主应用其他功能正常

#### Scenario: 明文凭证懒迁移

- **WHEN** 系统读取到升级前保存的明文 JSON 凭证
- **THEN** 正常使用该凭证并将其重写为密文

### Requirement: 健康数据同步与映射

系统 SHALL 从小米健康 API 拉取指定时间范围（默认最近 7 天）的步数、心率、睡眠、体重数据，并映射写入 Exercise、Sleep、Weight 表。睡眠起止时间 MUST 映射为 `bedTime`/`wakeTime` 并计算时长；体重数据 MUST 映射体重值及可得的体脂等字段；拉取失败的数据类型 MUST 记录错误且不中断其他类型。

#### Scenario: 全量类型同步成功

- **WHEN** 用户凭证有效并触发同步
- **THEN** 系统分别创建/更新运动、睡眠、体重记录，并返回各类型同步条数

#### Scenario: 单一类型失败不影响其他类型

- **WHEN** 体重数据接口异常但睡眠接口正常
- **THEN** 睡眠记录正常写入，结果中体重计 0 条且 errors 含体重错误原因

### Requirement: 幂等写入

系统 SHALL 为同步产生的记录写入 `sourceId`（格式 `{source}_{标识}`），并利用 `@@unique([date, sourceId])` 约束以 upsert 方式写入，重复同步同一时间范围 MUST NOT 产生重复记录。手动录入的记录（sourceId 为 NULL）MUST NOT 被同步过程修改或删除。

#### Scenario: 重复同步不产生重复记录

- **WHEN** 对同一时间范围连续触发两次同步
- **THEN** 第二次同步更新既有记录，数据库记录总数不变

#### Scenario: 手动记录不受影响

- **WHEN** 用户某天同时存在手动录入的体重记录与同步产生的体重记录
- **THEN** 两条记录并存，同步 upsert 不触碰手动记录

### Requirement: Token 过期自动刷新

系统 SHALL 在健康 API 返回 401 且凭证含 passToken 时，自动执行一次刷新流程重试原请求；刷新失败或没有 passToken 时 MUST 返回"凭证已失效，需重新登录"的错误。每次同步任务内刷新 MUST 至多尝试一次，防止无限循环。

#### Scenario: 401 后自动刷新成功

- **WHEN** 同步中 API 返回 401 且凭证含有效 passToken
- **THEN** 系统刷新 serviceToken 并重试，同步继续完成

#### Scenario: 无法刷新时提示重新登录

- **WHEN** API 返回 401 且凭证无 passToken 或刷新失败
- **THEN** 同步任务标记 failed，错误信息提示重新登录

### Requirement: 定时同步调度

系统 SHALL 在服务启动（Node.js 运行时）时为每个 `enabled=true` 的同步配置按 cron 表达式创建定时任务，配置变更时 MUST 更新或移除对应任务。调度器仅在长驻 Node.js 进程内运行。

#### Scenario: 启动时加载定时任务

- **WHEN** 服务启动且存在启用中的同步配置
- **THEN** 调度器为每个配置创建 cron 任务并输出加载数量日志

#### Scenario: 停用配置移除任务

- **WHEN** 用户将同步总开关设为关闭
- **THEN** 对应 cron 任务被移除，不再自动触发
