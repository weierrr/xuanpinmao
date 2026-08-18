import "@testing-library/jest-dom/vitest";
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const fixtureOutputRoot = path.join(process.cwd(), "fixtures", "research-runs", "output");
const localOutputRoot = path.join(process.cwd(), "output");

for (const bucket of ["research", "codex-native"] as const) {
  const sourceBucket = path.join(fixtureOutputRoot, bucket);
  if (!existsSync(sourceBucket)) continue;

  for (const entry of readdirSync(sourceBucket, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const source = path.join(sourceBucket, entry.name);
    const destination = path.join(localOutputRoot, bucket, entry.name);
    if (!existsSync(destination)) {
      mkdirSync(path.dirname(destination), { recursive: true });
      cpSync(source, destination, { recursive: true, errorOnExist: false, force: false });
    }
  }
}
