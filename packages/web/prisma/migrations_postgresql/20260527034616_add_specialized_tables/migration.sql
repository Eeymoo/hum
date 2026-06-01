-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diets" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "diets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sleeps" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "sleeps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weights" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "weights_pkey" PRIMARY KEY ("id")
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
