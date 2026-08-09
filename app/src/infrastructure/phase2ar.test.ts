import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

type CountResult = {
  reports: number;
  workflowStageRuns: number;
  modelCalls: number;
};

const root = process.cwd();

const dbPath = (name: string): string => path.join(root, "prisma", name);
const dbUrl = (name: string): string => `file:./${name}`;

const cleanDb = (name: string): void => {
  for (const suffix of ["", "-journal"]) {
    const filePath = dbPath(`${name}${suffix}`);
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
};

const runCommand = (args: string[], databaseName: string): CommandResult => {
  const result = spawnSync(args[0] ?? "", args.slice(1), {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl(databaseName),
    },
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const expectCommand = (args: string[], databaseName: string): CommandResult => {
  const result = runCommand(args, databaseName);
  expect(result.status, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`).toBe(0);
  return result;
};

const withClient = async <T>(databaseName: string, fn: (client: PrismaClient) => Promise<T>): Promise<T> => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = dbUrl(databaseName);
  const client = new PrismaClient();
  try {
    return await fn(client);
  } finally {
    await client.$disconnect();
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
  }
};

const migrateAndSeed = (databaseName: string): void => {
  cleanDb(databaseName);
  expectCommand(["npm", "run", "db:migrate"], databaseName);
  expectCommand(["npm", "run", "db:seed"], databaseName);
};

const getCounts = async (databaseName: string): Promise<CountResult> =>
  withClient(databaseName, async (client) => ({
    reports: await client.report.count(),
    workflowStageRuns: await client.workflowStageRun.count(),
    modelCalls: await client.modelCall.count(),
  }));

describe("Phase 2A-R seed and workflow persistence", () => {
  it("does not delete reports on repeated seed", async () => {
    const databaseName = "phase2ar_seed_report.db";
    migrateAndSeed(databaseName);
    expectCommand(["npm", "run", "export:t21"], databaseName);
    const before = await getCounts(databaseName);

    expectCommand(["npm", "run", "db:seed"], databaseName);
    expectCommand(["npm", "run", "db:seed"], databaseName);
    const after = await getCounts(databaseName);

    expect(before.reports).toBe(2);
    expect(after.reports).toBeGreaterThanOrEqual(before.reports);
    cleanDb(databaseName);
  }, 15_000);

  it("does not delete workflow stage attempts on repeated seed", async () => {
    const databaseName = "phase2ar_seed_attempt.db";
    migrateAndSeed(databaseName);
    const before = await getCounts(databaseName);

    expectCommand(["npm", "run", "db:seed"], databaseName);
    expectCommand(["npm", "run", "db:seed"], databaseName);
    const after = await getCounts(databaseName);

    expect(before.workflowStageRuns).toBe(13);
    expect(after.workflowStageRuns).toBeGreaterThanOrEqual(before.workflowStageRuns);
    cleanDb(databaseName);
  });

  it("persists retryable and non-retryable attempts in SQLite", async () => {
    const databaseName = "phase2ar_attempts.db";
    migrateAndSeed(databaseName);
    expectCommand(["npx", "tsx", "scripts/persist_workflow_scenarios.ts"], databaseName);

    const result = await withClient(databaseName, async (client) => {
      const retryAttempts = await client.workflowStageRun.findMany({
        where: { researchRunId: "T21-accept-retry-rate-limit", stageCode: "CLAIM_EXTRACTION" },
        orderBy: { attempt: "asc" },
      });
      const blockedAttempts = await client.workflowStageRun.findMany({
        where: { researchRunId: "T21-accept-blocked-content", stageCode: "CLAIM_EXTRACTION" },
        orderBy: { attempt: "asc" },
      });
      return { retryAttempts, blockedAttempts };
    });

    expect(result.retryAttempts.map((attempt) => attempt.status)).toEqual(["failed", "succeeded"]);
    expect(result.retryAttempts[0]?.errorCode).toBe("RATE_LIMIT");
    expect(result.retryAttempts[1]?.retryOfId).not.toBeNull();
    expect(result.blockedAttempts).toHaveLength(1);
    expect(result.blockedAttempts[0]?.status).toBe("failed");
    expect(result.blockedAttempts[0]?.errorCode).toBe("CONTENT_BLOCKED");
    cleanDb(databaseName);
  });

  it("can read persisted attempts after a separate process exits", () => {
    const databaseName = "phase2ar_restart_attempts.db";
    migrateAndSeed(databaseName);
    expectCommand(["npx", "tsx", "scripts/persist_workflow_scenarios.ts"], databaseName);

    const result = expectCommand(
      [
        "node",
        "-e",
        "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); (async()=>{ const rows=await p.workflowStageRun.findMany({where:{researchRunId:'T21-accept-retry-rate-limit',stageCode:'CLAIM_EXTRACTION'},orderBy:{attempt:'asc'}}); console.log(JSON.stringify(rows.map(r=>({attempt:r.attempt,status:r.status,errorCode:r.errorCode})))); await p.$disconnect(); })().catch(async e=>{ console.error(e); await p.$disconnect(); process.exit(1); });",
      ],
      databaseName,
    );

    expect(result.stdout).toContain("\"attempt\":1");
    expect(result.stdout).toContain("\"attempt\":2");
    expect(result.stdout).toContain("RATE_LIMIT");
    cleanDb(databaseName);
  });
});

describe("Phase 2A-R custom migrations", () => {
  it("runs migration 1 then migration 2 on an empty database", async () => {
    const databaseName = "phase2ar_migrate_empty.db";
    cleanDb(databaseName);

    const result = expectCommand(["npm", "run", "db:migrate"], databaseName);
    expect(result.stdout).toContain("20260715230000_init");
    expect(result.stdout).toContain("20260716000000_phase2ar_migration_history_smoke");

    const counts = await withClient(databaseName, async (client) => {
      const migrations = await client.$queryRawUnsafe<Array<{ id: string; mode: string }>>(
        `SELECT "id", "mode" FROM "_LocalMigration" ORDER BY "id"`,
      );
      const smoke = await client.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='MigrationSmoke'`,
      );
      return { migrations, smoke };
    });

    expect(counts.migrations.map((migration) => migration.mode)).toEqual(["applied", "applied"]);
    expect(counts.smoke).toHaveLength(1);
    cleanDb(databaseName);
  });

  it("baselines migration 1 and applies migration 2 on an existing database without history", async () => {
    const databaseName = "phase2ar_migrate_existing.db";
    cleanDb(databaseName);
    const sql = readFileSync(path.join(root, "prisma", "migrations", "20260715230000_init", "migration.sql"), "utf8");
    const statements = sql
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(/;\s*(?:\r?\n|$)/)
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    await withClient(databaseName, async (client) => {
      for (const statement of statements) {
        await client.$executeRawUnsafe(statement);
      }
    });

    expectCommand(["npm", "run", "db:migrate"], databaseName);
    const migrations = await withClient(databaseName, async (client) =>
      client.$queryRawUnsafe<Array<{ id: string; mode: string }>>(
        `SELECT "id", "mode" FROM "_LocalMigration" ORDER BY "id"`,
      ),
    );

    expect(migrations.map((migration) => migration.mode)).toEqual(["baselined", "applied"]);
    cleanDb(databaseName);
  });

  it("does not repeat migrations on repeated migrate", async () => {
    const databaseName = "phase2ar_migrate_repeat.db";
    cleanDb(databaseName);
    expectCommand(["npm", "run", "db:migrate"], databaseName);
    expectCommand(["npm", "run", "db:migrate"], databaseName);

    const migrations = await withClient(databaseName, async (client) =>
      client.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "_LocalMigration"`),
    );

    expect(migrations).toHaveLength(2);
    cleanDb(databaseName);
  });
});
