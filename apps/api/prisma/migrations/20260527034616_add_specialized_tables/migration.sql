-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "deleteAt" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "diets" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "deleteAt" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "sleeps" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "deleteAt" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "weights" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "deleteAt" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "exercises_date_idx" ON "exercises"("date");

-- CreateIndex
CREATE INDEX "exercises_type_date_idx" ON "exercises"("type", "date");

-- CreateIndex
CREATE INDEX "diets_date_idx" ON "diets"("date");

-- CreateIndex
CREATE INDEX "sleeps_date_idx" ON "sleeps"("date");

-- CreateIndex
CREATE INDEX "weights_date_idx" ON "weights"("date");
