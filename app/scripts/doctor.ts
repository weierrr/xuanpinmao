import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type CheckStatus = "PASS" | "WARNING" | "FAIL";
type Check = { name: string; status: CheckStatus; detail: string; required: boolean };

const root = process.cwd();
const checks: Check[] = [];

const record = (name: string, status: CheckStatus, detail: string, required = true): void => {
  checks.push({ name, status, detail, required });
};

const commandVersion = (command: string, args: string[]): string =>
  execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim().split("\n")[0] ?? "unknown";

const loadDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return "";
  const match = /^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m.exec(readFileSync(envPath, "utf8"));
  return match?.[1]?.trim() ?? "";
};

const main = async (): Promise<void> => {
  const [major, minor] = process.versions.node.split(".").map(Number);
  record("Node.js", major > 18 || (major === 18 && minor >= 18) ? "PASS" : "FAIL", process.versions.node);

  try {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    record("npm", "PASS", commandVersion(npmCommand, ["--version"]));
  } catch (error) {
    record("npm", "FAIL", error instanceof Error ? error.message : String(error));
  }

  const prismaBinary = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
  try {
    record("Prisma CLI", existsSync(prismaBinary) ? "PASS" : "FAIL", existsSync(prismaBinary) ? commandVersion(prismaBinary, ["--version"]) : "not installed");
  } catch (error) {
    record("Prisma CLI", "FAIL", error instanceof Error ? error.message : String(error));
  }

  const databaseUrl = loadDatabaseUrl();
  record("Environment", databaseUrl.startsWith("file:") ? "PASS" : "FAIL", databaseUrl ? "DATABASE_URL is configured; no model API key is required" : "DATABASE_URL is missing");

  if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
  const databasePath = path.join(root, "prisma", databaseUrl.replace(/^file:\.\//, ""));
  const databaseExists = databaseUrl.startsWith("file:./") && existsSync(databasePath);
  record("SQLite database", databaseExists ? "PASS" : "FAIL", databaseExists ? "local database is initialized" : "run npm run setup");

  if (databaseExists) {
    const prisma = new PrismaClient();
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      record("Database query", "PASS", "Prisma can query SQLite");
    } catch (error) {
      record("Database query", "FAIL", error instanceof Error ? error.message : String(error));
    } finally {
      await prisma.$disconnect();
    }
  }

  const skillCandidates = [
    path.join(os.homedir(), ".agents", "skills", "web-access", "SKILL.md"),
    path.join(os.homedir(), ".codex", "skills", "web-access", "SKILL.md"),
  ];
  const webAccessEnabled = skillCandidates.some(existsSync);
  record(
    "web-access Skill",
    webAccessEnabled ? "PASS" : "WARNING",
    webAccessEnabled
      ? "detected in a known local Codex skill path; confirm capability with a live Smoke Test"
      : "未在已知本地路径检测到 web-access，请在 Codex 中执行真实联网 Smoke Test 确认能力。",
    false,
  );

  for (const check of checks) {
    console.log(`${check.status}  ${check.name}: ${check.detail}`);
  }

  if (checks.some((check) => check.required && check.status === "FAIL")) process.exitCode = 1;
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
