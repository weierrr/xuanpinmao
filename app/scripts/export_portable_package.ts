import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const targetArgument = process.argv.find((argument) => argument.startsWith("--target="));
const target = path.resolve(targetArgument?.slice("--target=".length) ?? path.join(root, "agent-package"));

const rootFiles = [
  ".env.example",
  ".gitignore",
  "INSTALL.md",
  "PORTABLE_VALIDATION.md",
  "QUICK_START.md",
  "eslint.config.mjs",
  "next-env.d.ts",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
  "vitest.research.config.ts",
  "vitest.setup.ts",
];

const directories = ["src", "public", "fixtures/T21", "fixtures/research-runs", "prisma/migrations", "scripts"];
const individualFiles: Array<[string, string]> = [
  ["docs/portable-package-readme.md", "README.md"],
  ["docs/CODEX_USAGE.md", "docs/CODEX_USAGE.md"],
  ["docs/agent-usage.html", "docs/agent-usage.html"],
  ["docs/web-access-setup.md", "docs/web-access-setup.md"],
  ["docs/prompts/live-web-research.md", "docs/prompts/live-web-research.md"],
  ["docs/yoga-pants-decision-whiteboard-prototype.html", "docs/yoga-pants-decision-whiteboard-prototype.html"],
  ["docs/productization/Phase_4_First_Principles_Opportunity_Engine.md", "docs/productization/Phase_4_First_Principles_Opportunity_Engine.md"],
  ["docs/research/web-access-execution-template.md", "docs/research/web-access-execution-template.md"],
  ["instructions/项目指令_v1.5-8K.md", "instructions/项目指令_v1.5-8K.md"],
  ["prisma/schema.prisma", "prisma/schema.prisma"],
  ["prisma/migrate.ts", "prisma/migrate.ts"],
  ["prisma/seed.ts", "prisma/seed.ts"],
];

const excludedName = (source: string): boolean => {
  const name = path.basename(source);
  return (
    name === ".DS_Store" ||
    name === ".env" ||
    name === "node_modules" ||
    name === ".next" ||
    name === "output" ||
    name === "exports" ||
    name === "logs" ||
    name === "__pycache__" ||
    name.endsWith(".pyc") ||
    name.endsWith(".db") ||
    name.endsWith(".sqlite") ||
    name.endsWith(".log") ||
    name.endsWith(".dataless-backup") ||
    / 2\.[^.]+$/.test(name)
  );
};

const copyFileTo = async (source: string, destination: string): Promise<void> => {
  const absoluteSource = path.join(root, source);
  const absoluteDestination = path.join(target, destination);
  await mkdir(path.dirname(absoluteDestination), { recursive: true });
  await cp(absoluteSource, absoluteDestination);
};

const listFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(absolute)));
    else files.push(path.relative(target, absolute));
  }
  return files;
};

const assertNoLocalArtifacts = async (): Promise<void> => {
  const files = await listFiles(target);
  const forbidden = files.filter((file) =>
    /(^|\/)(node_modules|\.next|output|exports|logs)(\/|$)|(^|\/)\.env$|\.(db|sqlite|log)$/.test(file),
  );
  if (forbidden.length > 0) throw new Error(`Forbidden portable files: ${forbidden.join(", ")}`);

  for (const file of files) {
    const filePath = path.join(target, file);
    const info = await stat(filePath);
    if (info.size > 5_000_000) throw new Error(`Unexpected large file in portable package: ${file}`);
    if (/\.(png|jpg|jpeg|gif|webp|ico|woff2?)$/i.test(file)) continue;
    const content = await readFile(filePath, "utf8");
    if (/\/Users\/[^/]+|\/var\/folders\/|[A-Z]:\\\\Users\\\\/i.test(content)) {
      throw new Error(`Personal path found in portable package: ${file}`);
    }
    if (/sk-(?!test(?:secret)?\b)[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}/.test(content)) {
      throw new Error(`Possible secret found in portable package: ${file}`);
    }
  }
};

const main = async (): Promise<void> => {
  if (target === root || !target.startsWith(path.dirname(root))) {
    throw new Error("Portable target must be a sibling or child of the project directory.");
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  for (const file of rootFiles) await copyFileTo(file, file);
  for (const directory of directories) {
    await cp(path.join(root, directory), path.join(target, directory), {
      recursive: true,
      filter: (source) => !excludedName(source),
    });
  }
  for (const [source, destination] of individualFiles) await copyFileTo(source, destination);

  await assertNoLocalArtifacts();
  const files = await listFiles(target);
  await writeFile(
    path.join(target, "PORTABLE_PACKAGE_MANIFEST.txt"),
    `${files.join("\n")}\n`,
    "utf8",
  );
  console.log(JSON.stringify({ status: "exported", target, files: files.length + 1 }, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
