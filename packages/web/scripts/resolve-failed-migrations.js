#!/usr/bin/env node
/**
 * Pre-migration script: resolve any failed migrations before running migrate deploy.
 *
 * When a migration has previously failed (e.g. due to a duplicate column or table),
 * Prisma blocks all subsequent migrations. This script marks known failed/no-op
 * migrations as applied so that `prisma migrate deploy` can continue.
 *
 * The PostgreSQL init migration is a "fully merged" migration that already includes
 * all columns, tables and foreign keys that migrations 2-5 tried to add individually.
 * Those migrations have been converted to no-ops, but their failed entries in the
 * database need to be resolved first.
 */

const { execSync } = require('child_process');

const MIGRATIONS_TO_RESOLVE = [
  '20260527031126_add_delete_at',
  '20260527034616_add_specialized_tables',
  '20260527052040_add_user_account_models',
  '20260527072345_add_password_field',
];

for (const migrationId of MIGRATIONS_TO_RESOLVE) {
  try {
    console.log(`🔧 Resolving migration ${migrationId} as applied...`);
    execSync(`npx prisma migrate resolve --applied ${migrationId}`, {
      stdio: 'pipe',
    });
    console.log(`✅ Migration ${migrationId} resolved.`);
  } catch {
    console.log(`ℹ️  Migration ${migrationId} does not need resolving (skipped).`);
  }
}
