# sync-management-api

## Purpose

提供小米健康数据同步的服务端 HTTP API，包括认证、数据源列表、同步配置管理、手动触发同步、任务历史查询以及登录（含二维码轮询）。

## Requirements

### Requirement: 同步 API 认证

`/api/v1/sync/*` 下所有端点 SHALL 要求用户认证（登录会话或 API Key）。未认证请求 MUST 返回 401。触发同步、修改配置、发起登录等写操作 MUST 要求写权限，只读 token MUST 返回 403。所有配置与任务数据 MUST 按当前用户隔离，不得跨用户读写。

#### Scenario: 未认证访问被拒绝

- **WHEN** 不带凭据请求任意 `/api/v1/sync/*` 端点
- **THEN** 返回 401

#### Scenario: 只读 token 触发同步被拒绝

- **WHEN** 使用只读分享 token 调用 `POST /api/v1/sync/trigger`
- **THEN** 返回 403

#### Scenario: 跨用户隔离

- **WHEN** 用户 A 查询同步任务历史
- **THEN** 仅返回用户 A 的任务，不包含其他用户数据

### Requirement: 数据源列表

系统 SHALL 提供 `GET /api/v1/sync/sources` 返回已注册数据源（id、名称、描述、配置字段 schema），供前端动态渲染配置表单。

#### Scenario: 返回数据源及配置 schema

- **WHEN** 已认证用户请求数据源列表
- **THEN** 返回包含 miapi 的列表及其 configSchema（账号、密码、cron 等字段定义）

### Requirement: 同步配置管理

系统 SHALL 提供 `GET/POST /api/v1/sync/config`：查询当前用户的同步配置（开关、cron、绑定状态、最后同步时间）与保存配置。保存密码凭据时 MUST NOT 在后续 GET 响应中回显密码明文。token 字段 MUST 加密存储。

#### Scenario: 保存并查询配置

- **WHEN** 用户提交账号凭据与 cron 保存配置，随后查询配置
- **THEN** 配置保存成功，查询结果含绑定状态与 cron，不含密码或 token 明文

#### Scenario: 更新 cron 即时生效

- **WHEN** 用户修改同步频率并保存
- **THEN** 调度器中对应定时任务按新 cron 更新

### Requirement: 手动触发同步

系统 SHALL 提供 `POST /api/v1/sync/trigger`，支持可选的 `startDate`/`endDate` 参数，创建同步任务并执行，返回任务结果（各类型同步条数与错误列表）。未绑定凭证时 MUST 返回 400 并提示先登录。

#### Scenario: 触发成功

- **WHEN** 已绑定凭证的用户触发同步
- **THEN** 创建 SyncJob，执行完成后返回各类型 syncedRecords 计数

#### Scenario: 未绑定凭证

- **WHEN** 未登录小米账号的用户触发同步
- **THEN** 返回 400，提示先完成登录绑定

### Requirement: 同步任务历史

系统 SHALL 提供 `GET /api/v1/sync/jobs`，按时间倒序返回当前用户的同步任务（状态、时间范围、结果、错误），支持 `limit` 参数（默认 10）。

#### Scenario: 查询任务历史

- **WHEN** 用户请求任务历史
- **THEN** 返回最近的任务列表，含 status、syncedRecords 摘要与错误信息

### Requirement: 登录端点与二维码轮询

系统 SHALL 提供 `POST /api/v1/sync/login`（密码或手动 Token 登录）与 `POST /api/v1/sync/login/qr`（生成二维码，返回 sessionId 与二维码图片 URL）、`POST /api/v1/sync/login/qr-poll`（轮询扫码状态，返回 waiting/scanned/expired/error）。二维码会话 MUST 有 10 分钟 TTL 并被定期清理。扫码成功后 MUST 将加密凭证保存到当前用户的同步配置。

#### Scenario: 密码登录绑定

- **WHEN** 用户提交正确的小米账号密码到 login 端点
- **THEN** 系统完成认证，加密保存凭证并返回成功

#### Scenario: 二维码全流程

- **WHEN** 用户请求二维码后扫码确认，前端持续轮询
- **THEN** 轮询状态从 waiting 变为 scanned，凭证已加密保存

#### Scenario: 二维码会话过期被清理

- **WHEN** 二维码会话创建超过 10 分钟仍未扫码
- **THEN** 轮询返回会话不存在或 expired，内存中会话已被清理
