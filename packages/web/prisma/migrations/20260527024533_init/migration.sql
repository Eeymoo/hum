-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "name" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" INTEGER,
    "password" TEXT,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "tags" TEXT,
    "note" TEXT,
    "attachments" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "weights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "bodyFat" DOUBLE PRECISION,
    "muscleMass" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "water" DOUBLE PRECISION,
    "boneMass" DOUBLE PRECISION,
    "visceralFat" INTEGER,
    "note" TEXT,
    "attachments" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "weights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "caloriesBurned" INTEGER,
    "activities" TEXT NOT NULL,
    "heartRateAvg" INTEGER,
    "heartRateMax" INTEGER,
    "feeling" INTEGER,
    "location" TEXT,
    "note" TEXT,
    "attachments" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "exercises_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "diets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "mealType" TEXT NOT NULL,
    "calories" INTEGER,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION,
    "sodium" DOUBLE PRECISION,
    "foods" TEXT NOT NULL,
    "water" INTEGER,
    "note" TEXT,
    "attachments" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "diets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sleeps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "duration" DOUBLE PRECISION NOT NULL,
    "bedTime" TEXT NOT NULL,
    "wakeTime" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "deepSleep" DOUBLE PRECISION,
    "remSleep" DOUBLE PRECISION,
    "awakenings" INTEGER,
    "feeling" INTEGER,
    "note" TEXT,
    "attachments" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "sleeps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "records_type_date_idx" ON "records"("type", "date");

-- CreateIndex
CREATE INDEX "records_createdAt_idx" ON "records"("createdAt");

-- CreateIndex
CREATE INDEX "weights_date_idx" ON "weights"("date");

-- CreateIndex
CREATE INDEX "exercises_date_idx" ON "exercises"("date");

-- CreateIndex
CREATE INDEX "exercises_type_date_idx" ON "exercises"("type", "date");

-- CreateIndex
CREATE INDEX "diets_date_idx" ON "diets"("date");

-- CreateIndex
CREATE INDEX "sleeps_date_idx" ON "sleeps"("date");
