-- AlterTable: 添加 sourceId 列（用于同步去重）
ALTER TABLE "weights" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "diets" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "sleeps" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

-- AlterTable: 添加 extraData 列（补充 migration 7 未执行的情况）
ALTER TABLE "weights" ADD COLUMN IF NOT EXISTS "extraData" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "extraData" TEXT;
ALTER TABLE "diets" ADD COLUMN IF NOT EXISTS "extraData" TEXT;
ALTER TABLE "sleeps" ADD COLUMN IF NOT EXISTS "extraData" TEXT;

-- CreateIndex: (date, sourceId) 唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS "weights_date_sourceId_key" ON "weights"("date", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "exercises_date_sourceId_key" ON "exercises"("date", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "diets_date_sourceId_key" ON "diets"("date", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "sleeps_date_sourceId_key" ON "sleeps"("date", "sourceId");

-- CreateTable: sync_source_configs
CREATE TABLE IF NOT EXISTS "sync_source_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cron" TEXT NOT NULL DEFAULT '0 9 * * *',
    "config" TEXT NOT NULL DEFAULT '{}',
    "token" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_source_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sync_jobs
CREATE TABLE IF NOT EXISTS "sync_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceConfigId" TEXT NOT NULL,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sync_logs
CREATE TABLE IF NOT EXISTS "sync_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "sync_source_configs" ADD CONSTRAINT "sync_source_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_sourceConfigId_fkey" FOREIGN KEY ("sourceConfigId") REFERENCES "sync_source_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "sync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
