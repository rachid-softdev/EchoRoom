#!/usr/bin/env npx tsx
/**
 * Prisma Migration Rollback Utility
 *
 * Rolls back Prisma migrations by executing companion `.down.sql` files
 * in reverse chronological order.
 *
 * Usage:
 *   npx tsx prisma/rollback.ts --step 2            # Roll back the last 2 migrations
 *   npx tsx prisma/rollback.ts --to 20260531163244  # Roll back to a specific migration
 *   npx tsx prisma/rollback.ts --step 1 --force     # Skip confirmation (prod safety)
 *
 * Arguments:
 *   --to <timestamp>   Roll back all migrations applied AFTER this timestamp.
 *                      The migration with this timestamp will become the current one.
 *   --step <N>         Roll back the N most recent migrations.
 *   --force            Skip confirmation prompt. Required in production (NODE_ENV=production).
 *
 * Conventions:
 *   - Each migration directory must have a companion `.down.sql` file for rollback support.
 *     Example: prisma/migrations/20260531163244_sprint2/migration.down.sql
 *   - If no `.down.sql` is found, the migration is skipped with a warning.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MigrationRecord {
  migration_name: string;
  finished_at: Date | null;
}

interface ParsedArgs {
  to: string | undefined;
  step?: number;
  force: boolean;
}

interface DownSqlFile {
  name: string;
  /** Sort key: raw timestamp from migration name prefix */
  sortKey: string;
  downSql: string | null;
  filePath: string;
}

// ─── CLI Argument Parsing ─────────────────────────────────────────────────────

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = { to: undefined, force: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--to":
        parsed.to = args[++i];
        if (!parsed.to || /^\d{14}$/.test(parsed.to) === false) {
          console.error("❌ --to must be a 14-digit migration timestamp (e.g. 20260531163244)");
          process.exit(1);
        }
        break;
      case "--step":
        const stepStr = args[++i];
        if (stepStr === undefined) {
          console.error("❌ --step requires a value");
          process.exit(1);
        }
        parsed.step = Number.parseInt(stepStr, 10);
        if (Number.isNaN(parsed.step) || parsed.step < 1) {
          console.error("❌ --step must be a positive integer");
          process.exit(1);
        }
        break;
      case "--force":
        parsed.force = true;
        break;
      default:
        console.error(`❌ Unknown argument: ${args[i]}`);
        console.error("Usage: npx tsx prisma/rollback.ts {--to <ts> | --step <N>} [--force]");
        process.exit(1);
    }
  }

  if (parsed.to === undefined && parsed.step === undefined) {
    console.error("❌ Provide either --to <timestamp> or --step <N>");
    process.exit(1);
  }

  return parsed;
}

// ─── Migration Resolution ─────────────────────────────────────────────────────

/**
 * Reads all migration directories and their companion `.down.sql` files.
 * Returns them sorted by timestamp descending (most recent first).
 */
function discoverDownSqlFiles(migrationsDir: string): DownSqlFile[] {
  const { readdirSync } = require("node:fs");
  const entries = readdirSync(migrationsDir, { withFileTypes: true });

  const results: DownSqlFile[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirPath = join(migrationsDir, entry.name);
    const downFilePath = join(dirPath, "migration.down.sql");

    let downSql: string | null = null;
    try {
      downSql = readFileSync(downFilePath, "utf-8");
    } catch {
      // No .down.sql file — this migration cannot be rolled back automatically
    }

    // Extract timestamp from directory name: "<timestamp>_<name>"
    const match = entry.name.match(/^(\d{14})/);
    const sortKey = match?.[1] ?? "";

    results.push({
      name: entry.name,
      sortKey,
      downSql,
      filePath: downFilePath,
    });
  }

  // Sort by timestamp descending (most recent first)
  results.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  return results;
}

/**
 * Fetches applied migrations from the `_prisma_migrations` table,
 * ordered by finished_at descending (most recently applied first).
 */
async function getAppliedMigrations(
  prisma: PrismaClient,
): Promise<MigrationRecord[]> {
  const rows = await prisma.$queryRawUnsafe<MigrationRecord[]>(
    `SELECT migration_name, finished_at
     FROM _prisma_migrations
     WHERE rolled_back_at IS NULL
     ORDER BY finished_at DESC`,
  );
  return rows;
}

/**
 * Determines which migrations to rollback based on CLI arguments.
 */
function resolveRollbackTarget(
  args: ParsedArgs,
  applied: MigrationRecord[],
  allDownSql: DownSqlFile[],
): DownSqlFile[] {
  const appliedNames = new Set(applied.map((m) => m.migration_name));

  // Filter to only applied migrations that have a .down.sql
  const candidates = allDownSql.filter(
    (m) => appliedNames.has(m.name),
  );

  if (args.to !== undefined) {
    // Rollback everything applied AFTER the target migration
    const targetIndex = candidates.findIndex(
      (m) => m.sortKey <= args.to!,
    );
    const toRollback =
      targetIndex === -1
        ? candidates // All migrations are after the target (nothing to keep)
        : candidates.slice(0, targetIndex);

    if (toRollback.length === 0) {
      console.log(
        `ℹ️  No migrations to roll back. Current state is at or before ${args.to}.`,
      );
    }

    return toRollback;
  }

  // --step N: roll back the N most recent applied migrations
  const count = Math.min(args.step!, candidates.length);
  return candidates.slice(0, count);
}

// ─── Rollback Execution ───────────────────────────────────────────────────────

async function executeRollback(
  prisma: PrismaClient,
  migrations: DownSqlFile[],
  force: boolean,
  _migrationsDir: string,
): Promise<void> {
  if (migrations.length === 0) {
    console.log("✅ Nothing to roll back.");
    return;
  }

  console.log(`\n🔄 Preparing to roll back ${migrations.length} migration(s):`);
  for (const m of migrations) {
    const hasDown = m.downSql !== null;
    console.log(
      `   ${hasDown ? "✔️" : "⚠️"} ${m.name}${hasDown ? "" : " [NO .down.sql — will skip]"}`,
    );
  }

  // Warn about skipped migrations before confirmation
  const skipped = migrations.filter((m) => m.downSql === null);
  if (skipped.length > 0) {
    console.warn(
      `\n⚠️  ${skipped.length} migration(s) have no .down.sql file and will be skipped.`,
    );
    console.warn(
      "   Manual rollback may be required for these. Check the migration SQL manually.",
    );
  }

  // Confirmation prompt (skipped with --force)
  const isProd = process.env['NODE_ENV'] === "production";
  if (!force) {
    if (isProd) {
      console.error(
        "\n❌ NODE_ENV=production detected. Use --force to confirm rollback in production.",
      );
      process.exit(1);
    }

    console.log("\n📋 Rollback plan:");
    for (const m of migrations) {
      const status = m.downSql !== null ? "ROLLBACK" : "SKIP (no .down.sql)";
      console.log(`   ${status}: ${m.name}`);
    }

    const readline = require("node:readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(
        "\n⚠️  Are you sure you want to proceed? This is destructive. (yes/no): ",
        resolve,
      );
    });
    rl.close();

    if (answer.toLowerCase() !== "yes") {
      console.log("❌ Rollback cancelled.");
      process.exit(0);
    }
  }

  // Execute rollback for each migration in order (reverse chronological)
  let rolledBack = 0;
  for (const migration of migrations) {
    if (migration.downSql === null) {
      console.warn(`⚠️  Skipping ${migration.name} — no migration.down.sql found at:`);
      console.warn(`    ${migration.filePath}`);
      continue;
    }

    console.log(`\n⏪ Rolling back: ${migration.name}...`);

    try {
      // Execute the down SQL in a transaction
      await prisma.$executeRawUnsafe(`

        -- EchoRoom: Rollback migration ${migration.name}
        ${migration.downSql}

      `);

      // Remove the migration record from _prisma_migrations
      await prisma.$executeRawUnsafe(
        `DELETE FROM _prisma_migrations WHERE migration_name = $1`,
        migration.name,
      );

      console.log(`✅ Rolled back: ${migration.name}`);
      rolledBack++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to roll back ${migration.name}: ${message}`);
      console.error("   The database may be in an inconsistent state.");
      console.error(
        "   Check _prisma_migrations table and the state of your tables manually.",
      );
      process.exit(1);
    }
  }

  console.log(
    `\n✅ Rollback complete. ${rolledBack} migration(s) rolled back.`,
  );

  if (skipped.length > 0) {
    console.warn(
      `\n⚠️  ${skipped.length} migration(s) were skipped (no .down.sql).`,
    );
    console.warn("   These may need manual rollback. Review them before proceeding.");
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  EchoRoom — Prisma Migration Rollback    ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const args = parseArgs(process.argv.slice(2));

  // Resolve the migrations directory (relative to this script's location)
  const migrationsDir = resolve(__dirname, "migrations");

  // Discover all .down.sql files
  console.log("🔍 Discovering migration directories...");
  const allDownSql = discoverDownSqlFiles(migrationsDir);
  console.log(`   Found ${allDownSql.length} migration directories.`);

  // Connect to the database
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log("📦 Connected to database.");

    // Get applied migrations
    const applied = await getAppliedMigrations(prisma);
    console.log(`   ${applied.length} migration(s) currently applied.`);

    // Resolve the rollback target
    const toRollback = resolveRollbackTarget(args, applied, allDownSql);

    // Execute the rollback
    await executeRollback(prisma, toRollback, args.force, migrationsDir);
  } finally {
    await prisma.$disconnect();
    console.log("🔌 Disconnected from database.");
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
