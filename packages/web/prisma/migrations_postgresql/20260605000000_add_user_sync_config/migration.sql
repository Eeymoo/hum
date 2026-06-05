-- CreateTable: user_sync_configs
-- 用户同步总配置（开关-单选-配置 三段式架构）
CREATE TABLE IF NOT EXISTS "user_sync_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "providerConfig" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sync_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: userId 唯一约束（每个用户只有一条同步配置）
CREATE UNIQUE INDEX IF NOT EXISTS "user_sync_configs_userId_key" ON "user_sync_configs"("userId");

-- AddForeignKey
ALTER TABLE "user_sync_configs" ADD CONSTRAINT "user_sync_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 注意: SyncSourceConfig.enabled 字段保留但不再作为主要控制手段，
-- 改由 UserSyncConfig.enabled + UserSyncConfig.provider 联合控制
