import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const distributionRoot = path.dirname(new URL(import.meta.url).pathname);
const source = path.join(distributionRoot, "app");
const targetArgument = process.argv.find((item) => item.startsWith("--target="));
const target = path.resolve(targetArgument?.slice(9) ?? path.join(os.homedir(), "xuanpinmao-app"));
const protectedNames = new Set([".env", "node_modules", ".next", "output", "logs"]);
await mkdir(target, { recursive: true });
const { readdir } = await import("node:fs/promises");
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (protectedNames.has(entry.name)) continue;
  await cp(path.join(source, entry.name), path.join(target, entry.name), { recursive: true, force: true });
}
const plugin = JSON.parse(await readFile(path.join(distributionRoot, "plugins", "product-research-workbench", ".codex-plugin", "plugin.json"), "utf8"));
await writeFile(path.join(target, ".xuanpinmao-release.json"), JSON.stringify({ version: plugin.version, source: "weierrr/xuanpinmao", updatedAt: new Date().toISOString() }, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ status: "installed", target, version: plugin.version }, null, 2));
