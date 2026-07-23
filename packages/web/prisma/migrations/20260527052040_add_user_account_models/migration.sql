-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "name" TEXT,
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
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
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "new_api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastUsed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Create temporary orphan user for existing api_keys
INSERT INTO "users" ("id", "createdAt", "updatedAt", "deleteAt") 
SELECT '00000000-0000-0000-0000-000000000001', datetime('now'), datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "id" = '00000000-0000-0000-0000-000000000001');

-- Copy api_keys with orphan user mapping
INSERT INTO "new_api_keys" ("createdAt", "deleteAt", "id", "key", "lastUsed", "name", "userId") 
SELECT "createdAt", "deleteAt", "id", "key", "lastUsed", COALESCE("name", 'Unknown Device'), '00000000-0000-0000-0000-000000000001' 
FROM "api_keys";
DROP TABLE "api_keys";
ALTER TABLE "new_api_keys" RENAME TO "api_keys";
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

CREATE TABLE "new_diets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "mealType" TEXT NOT NULL,
    "calories" INTEGER,
    "protein" REAL,
    "carbs" REAL,
    "fat" REAL,
    "fiber" REAL,
    "sodium" REAL,
    "foods" TEXT NOT NULL,
    "water" INTEGER,
    "note" TEXT,
    "attachments" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "diets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_diets" ("attachments", "calories", "carbs", "createdAt", "date", "deleteAt", "fat", "fiber", "foods", "id", "mealType", "note", "protein", "sodium", "updatedAt", "water") SELECT "attachments", "calories", "carbs", "createdAt", "date", "deleteAt", "fat", "fiber", "foods", "id", "mealType", "note", "protein", "sodium", "updatedAt", "water" FROM "diets";
DROP TABLE "diets";
ALTER TABLE "new_diets" RENAME TO "diets";
CREATE INDEX "diets_date_idx" ON "diets"("date");

CREATE TABLE "new_exercises" (
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
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "exercises_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_exercises" ("activities", "attachments", "caloriesBurned", "createdAt", "date", "deleteAt", "duration", "feeling", "heartRateAvg", "heartRateMax", "id", "location", "note", "type", "updatedAt") SELECT "activities", "attachments", "caloriesBurned", "createdAt", "date", "deleteAt", "duration", "feeling", "heartRateAvg", "heartRateMax", "id", "location", "note", "type", "updatedAt" FROM "exercises";
DROP TABLE "exercises";
ALTER TABLE "new_exercises" RENAME TO "exercises";
CREATE INDEX "exercises_date_idx" ON "exercises"("date");
CREATE INDEX "exercises_type_date_idx" ON "exercises"("type", "date");

CREATE TABLE "new_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "tags" TEXT,
    "note" TEXT,
    "attachments" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_records" ("attachments", "createdAt", "data", "date", "deleteAt", "id", "note", "tags", "type", "updatedAt") SELECT "attachments", "createdAt", "data", "date", "deleteAt", "id", "note", "tags", "type", "updatedAt" FROM "records";
DROP TABLE "records";
ALTER TABLE "new_records" RENAME TO "records";
CREATE INDEX "records_type_date_idx" ON "records"("type", "date");
CREATE INDEX "records_createdAt_idx" ON "records"("createdAt");

CREATE TABLE "new_sleeps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "duration" REAL NOT NULL,
    "bedTime" TEXT NOT NULL,
    "wakeTime" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "deepSleep" REAL,
    "remSleep" REAL,
    "awakenings" INTEGER,
    "feeling" INTEGER,
    "note" TEXT,
    "attachments" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "sleeps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sleeps" ("attachments", "awakenings", "bedTime", "createdAt", "date", "deepSleep", "deleteAt", "duration", "feeling", "id", "note", "quality", "remSleep", "updatedAt", "wakeTime") SELECT "attachments", "awakenings", "bedTime", "createdAt", "date", "deepSleep", "deleteAt", "duration", "feeling", "id", "note", "quality", "remSleep", "updatedAt", "wakeTime" FROM "sleeps";
DROP TABLE "sleeps";
ALTER TABLE "new_sleeps" RENAME TO "sleeps";
CREATE INDEX "sleeps_date_idx" ON "sleeps"("date");

CREATE TABLE "new_weights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "weight" REAL NOT NULL,
    "bodyFat" REAL,
    "muscleMass" REAL,
    "bmi" REAL,
    "water" REAL,
    "boneMass" REAL,
    "visceralFat" INTEGER,
    "note" TEXT,
    "attachments" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "weights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_weights" ("attachments", "bmi", "bodyFat", "boneMass", "createdAt", "date", "deleteAt", "id", "muscleMass", "note", "updatedAt", "visceralFat", "water", "weight") SELECT "attachments", "bmi", "bodyFat", "boneMass", "createdAt", "date", "deleteAt", "id", "muscleMass", "note", "updatedAt", "visceralFat", "water", "weight" FROM "weights";
DROP TABLE "weights";
ALTER TABLE "new_weights" RENAME TO "weights";
CREATE INDEX "weights_date_idx" ON "weights"("date");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
