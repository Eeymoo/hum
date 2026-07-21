# sync-cli

## Purpose

提供小米健康数据同步相关的 CLI 命令，支持手动触发同步、查看同步历史与重新登录绑定。

## Requirements

### Requirement: 手动触发同步命令

CLI SHALL 提供 `hum sync` 命令，通过项目统一的 `request` 封装调用服务端触发同步（MUST NOT 使用 `execSync` 调用 curl），支持 `--start`/`--end` 指定日期范围，输出各类型同步条数与错误信息。未配置 API Key 时 MUST 提示先登录并以非零码退出。

#### Scenario: 触发并输出结果

- **WHEN** 用户执行 `hum sync`
- **THEN** CLI 调用触发端点并输出运动/睡眠/体重的同步条数

#### Scenario: 未配置认证

- **WHEN** 未登录状态下执行 `hum sync`
- **THEN** 提示先运行 `hum auth login`，以非零码退出，不发起请求

### Requirement: 同步历史命令

CLI SHALL 支持 `hum sync --status` 查看最近同步任务（状态、时间、条数、错误）。

#### Scenario: 查看历史

- **WHEN** 用户执行 `hum sync --status`
- **THEN** 输出最近任务列表，含成功/失败标识与错误详情

### Requirement: 重新登录命令

CLI SHALL 支持 `hum sync --login` 引导用户完成小米账号绑定（密码方式），凭据经交互输入，密码输入 MUST 不回显。

#### Scenario: 交互式登录绑定

- **WHEN** 用户执行 `hum sync --login` 并输入正确凭据
- **THEN** 绑定成功并提示可执行 `hum sync` 同步数据
