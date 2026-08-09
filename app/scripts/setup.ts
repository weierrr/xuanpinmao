import { constants } from "node:fs";
import { access, copyFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const envPath = path.join(root, ".env");
const envExamplePath = path.join(root, ".env.example");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const run = (script: string): void => {
  const result = spawnSync(npmCommand, ["run", script], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db" },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Setup command failed: npm run ${script}`);
  }
};

const main = async (): Promise<void> => {
  if (!(await exists(envPath))) {
    await copyFile(envExamplePath, envPath);
    console.log("Created .env from .env.example");
  } else {
    console.log("Keeping existing .env");
  }

  run("db:generate");
  run("db:migrate");
  run("db:seed");
  console.log("Setup complete. The seeded T21 data is a regression fixture, not a live research result.");
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
