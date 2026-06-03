-- AlterTable: 添加 sourceId 列（用于同步去重）
ALTER TABLE "weights" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "exercises" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "diets" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "sleeps" ADD COLUMN "sourceId" TEXT;

-- 注意：extraData 列已在 migration 20260529000000 中添加，此处不再重复

-- CreateIndex: (date, sourceId) 唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS "weights_date_sourceId_key" ON "weights"("date", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "exercises_date_sourceId_key" ON "exercises"("date", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "diets_date_sourceId_key" ON "diets"("date", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "sleeps_date_sourceId_key" ON "sleeps"("date", "sourceId");

-- CreateTable: sync_source_configs
CREATE TABLE IF NOT EXISTS "sync_source_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cron" TEXT NOT NULL DEFAULT '0 9 * * *',
    "config" TEXT NOT NULL DEFAULT '{}',
    "token" TEXT,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: sync_jobs
CREATE TABLE IF NOT EXISTS "sync_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceConfigId" TEXT NOT NULL
);

-- CreateTable: sync_logs
CREATE TABLE IF NOT EXISTS "sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sync_source_configs_userId_sourceId_key" ON "sync_source_configs"("userId", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sync_jobs_userId_sourceId_idx" ON "sync_jobs"("userId", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sync_jobs_createdAt_idx" ON "sync_jobs"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sync_logs_jobId_idx" ON "sync_logs"("jobId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sync_logs_createdAt_idx" ON "sync_logs"("createdAt");
