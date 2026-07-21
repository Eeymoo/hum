/**
 * SyncSource - 所有数据源必须实现此接口
 * 
 * 扩展说明：新增数据源时，只需实现 SyncSource 接口并在 SyncRegistry 中注册即可。
 * 无需修改核心同步逻辑、cron 调度器或前端配置页面。
 * 步骤：
 * 1. 创建新文件实现 SyncSource 接口
 * 2. 在 registry.ts 的 registerBuiltinSources() 中添加注册
 * 3. 前端会自动识别新数据源
 */

// 配置字段定义
export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select' | 'cron';
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  defaultValue?: string;
}

// 认证 Token
export interface AuthToken {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  // Allow source-specific fields
  [key: string]: unknown;
}

// 同步选项
export interface SyncOptions {
  userId: string;          // Hum 系统用户 ID
  startDate?: Date;        // 同步起始日期
  endDate?: Date;          // 同步结束日期
  fullSync?: boolean;      // 是否全量同步
  config: Record<string, unknown>;  // 数据源配置
  token: AuthToken;        // 认证凭证
}

// 同步结果
export interface SyncResult {
  success: boolean;
  syncedRecords: {
    exercise: number;
    sleep: number;
    weight: number;
    diet: number;
  };
  errors: SyncError[];
  nextSyncDate?: Date;
}

export interface SyncError {
  type: string;     // 数据类型
  date?: string;    // 日期
  message: string;  // 错误信息
}

// 同步源接口 - 所有数据源必须实现
export interface SyncSource {
  id: string;
  name: string;
  description: string;
  configSchema: ConfigField[];
  authenticate(credentials: Record<string, unknown>): Promise<AuthToken>;
  sync(options: SyncOptions): Promise<SyncResult>;
}

// 同步任务状态
export type SyncJobStatus = 'pending' | 'running' | 'success' | 'failed';

// 同步日志级别
export type SyncLogLevel = 'info' | 'warn' | 'error';
