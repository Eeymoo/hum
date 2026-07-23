-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "lastUsed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleteAt" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_api_keys" ("createdAt", "id", "key", "lastUsed", "name") SELECT "createdAt", "id", "key", "lastUsed", "name" FROM "api_keys";
DROP TABLE "api_keys";
ALTER TABLE "new_api_keys" RENAME TO "api_keys";
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");
CREATE TABLE "new_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "note" TEXT,
    "attachments" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deleteAt" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_records" ("attachments", "createdAt", "data", "date", "id", "note", "tags", "type", "updatedAt") SELECT "attachments", "createdAt", "data", "date", "id", "note", "tags", "type", "updatedAt" FROM "records";
DROP TABLE "records";
ALTER TABLE "new_records" RENAME TO "records";
CREATE INDEX "records_type_date_idx" ON "records"("type", "date");
CREATE INDEX "records_createdAt_idx" ON "records"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
