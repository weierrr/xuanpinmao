import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type MigrationFile = {
  id: string;
  path: string;
  sql: string;
  checksum: string;
  statements: string[];
};

type MigrationRow = {
  id: string;
  checksum: string;
};

const migrationsRoot = path.join(process.cwd(), "prisma", "migrations");

const splitSqlStatements = (sql: string): string[] => {
  const withoutComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  return withoutComments
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
};

const checksum = (content: string): string => createHash("sha256").update(content).digest("hex");

const tableExists = async (tableName: string): Promise<boolean> => {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    tableName,
  );
  return rows.length > 0;
};

const loadMigrations = async (): Promise<MigrationFile[]> => {
  const entries = (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const migrations: MigrationFile[] = [];
  for (const id of entries) {
    const migrationPath = path.join(migrationsRoot, id, "migration.sql");
    const sql = await readFile(migrationPath, "utf8");
    migrations.push({
      id,
      path: migrationPath,
      sql,
      checksum: checksum(sql),
      statements: splitSqlStatements(sql),
    });
  }
  return migrations;
};

const ensureMigrationHistory = async (): Promise<void> => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_LocalMigration" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "statements" INTEGER NOT NULL,
      "mode" TEXT NOT NULL
    )
  `);
};

const getAppliedMigrations = async (): Promise<Map<string, MigrationRow>> => {
  const rows = await prisma.$queryRawUnsafe<MigrationRow[]>(`SELECT "id", "checksum" FROM "_LocalMigration"`);
  return new Map(rows.map((row) => [row.id, row]));
};

const recordMigration = async (migration: MigrationFile, mode: "applied" | "baselined"): Promise<void> => {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_LocalMigration" ("id", "checksum", "statements", "mode") VALUES (?, ?, ?, ?)`,
    migration.id,
    migration.checksum,
    migration.statements.length,
    mode,
  );
};

const applyMigration = async (migration: MigrationFile): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    for (const statement of migration.statements) {
      await tx.$executeRawUnsafe(statement);
    }
    await tx.$executeRawUnsafe(
      `INSERT INTO "_LocalMigration" ("id", "checksum", "statements", "mode") VALUES (?, ?, ?, ?)`,
      migration.id,
      migration.checksum,
      migration.statements.length,
      "applied",
    );
  });
};

const main = async (): Promise<void> => {
  const migrations = await loadMigrations();
  await ensureMigrationHistory();
  const applied = await getAppliedMigrations();
  const projectTableExists = await tableExists("Project");
  const results: Array<{ id: string; status: "applied" | "baselined" | "skipped"; statements: number }> = [];

  for (const migration of migrations) {
    const appliedRow = applied.get(migration.id);
    if (appliedRow) {
      if (appliedRow.checksum !== migration.checksum) {
        throw new Error(`Migration checksum mismatch: ${migration.id}`);
      }
      results.push({ id: migration.id, status: "skipped", statements: migration.statements.length });
      continue;
    }

    if (migration.id === "20260715230000_init" && projectTableExists) {
      await recordMigration(migration, "baselined");
      results.push({ id: migration.id, status: "baselined", statements: migration.statements.length });
      continue;
    }

    await applyMigration(migration);
    results.push({ id: migration.id, status: "applied", statements: migration.statements.length });
  }

  console.log(
    JSON.stringify(
      {
        status: "migrated",
        databaseUrl: process.env.DATABASE_URL ?? "missing",
        migrations: results,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
