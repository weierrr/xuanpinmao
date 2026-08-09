import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const main = async (): Promise<void> => {
  const root = process.cwd();
  const targetArgument = process.argv.find((argument) => argument.startsWith("--target="));
  const target = path.resolve(targetArgument?.slice("--target=".length) ?? path.join(root, "exports", "share", "xuanpinmao-complete-test-kit-latest"));
  const appTarget = path.join(target, "app");
  const pluginTarget = path.join(target, "plugins", "product-research-workbench");
  const pluginSource = path.join(root, "codex-plugin", "product-research-workbench");
  const manifest = JSON.parse(await readFile(path.join(pluginSource, ".codex-plugin", "plugin.json"), "utf8")) as { version: string };

  if (target === root || !target.startsWith(path.join(root, "exports"))) {
    throw new Error("Complete test kit target must be inside this project's exports directory.");
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  const child = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const childProcess = child.spawn(process.execPath, ["--import", "tsx", path.join(root, "scripts", "export_portable_package.ts"), `--target=${appTarget}`], {
      cwd: root,
      stdio: "inherit",
    });
    childProcess.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Portable export failed with code ${code}`)));
  });

  await mkdir(path.dirname(pluginTarget), { recursive: true });
  await cp(pluginSource, pluginTarget, { recursive: true });
  await mkdir(path.join(target, ".agents", "plugins"), { recursive: true });
  await writeFile(path.join(target, ".agents", "plugins", "marketplace.json"), `${JSON.stringify({
  name: "xuanpinmao",
  interface: { displayName: "选品猫测试版" },
  plugins: [{
    name: "product-research-workbench",
    source: { source: "local", path: "./plugins/product-research-workbench" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Productivity",
  }],
  }, null, 2)}\n`, "utf8");

  const readme = `# 选品猫完整测试包

这不是单独的提示词插件，而是可运行的完整测试环境，包含选品猫应用、实时调研白板、最新版 Codex 插件和本地 Marketplace。

插件版本：\`${manifest.version}\`

## 安装应用

\`\`\`bash
cd app
npm install
npm run setup
npm run doctor
npm run test:portable
npm run dev
\`\`\`

打开 <http://localhost:3000>。

## 安装插件

在测试包根目录执行：

\`\`\`bash
codex plugin marketplace add "当前测试包根目录的绝对路径"
codex plugin add product-research-workbench@xuanpinmao
\`\`\`

如果通过 GitHub 安装，直接执行：

\`\`\`bash
codex plugin marketplace add weierrr/xuanpinmao --ref main
codex plugin add product-research-workbench@xuanpinmao
\`\`\`

安装后必须新建 Codex 对话，再输入“使用选品猫调研一个新类目”。

## 更新

\`\`\`bash
codex plugin marketplace upgrade xuanpinmao
codex plugin add product-research-workbench@xuanpinmao
\`\`\`

## 正确流程

\`\`\`text
组合填写关键词、图片和竞品链接
→ 页面内确认研究对象
→ 自动打开实时白板
→ 创建与白板绑定的独立 Research Run
→ 可视化来源、查询、采集、去重和有效记录
→ 生成市场与机会、用户画像、竞品分析、产品方案、营销打法、验证方案
→ 默认交付白板页面与 reports/whiteboard-report.html
→ 新证据以批次回流并生成新版本
\`\`\`

如果流程跳过页面确认、没有打开白板，或把旧版纵向报告当成主报告，请停止该轮并检查是否在安装插件后创建了新对话。

历史 Run、密钥、浏览器状态和开发者本机数据库均未包含在分享包中。\`fixtures/T21\` 只用于回归测试，不能作为新类目的证据。
`;
  await writeFile(path.join(target, "README.md"), readme, "utf8");
  await writeFile(path.join(target, "AGENTS.md"), `# 选品猫发行仓库\n\n当用户要求安装本仓库时：\n\n1. 执行 \`codex plugin marketplace add weierrr/xuanpinmao --ref main\`。\n2. 执行 \`codex plugin add product-research-workbench@xuanpinmao\`。\n3. 在 \`app\` 目录运行 \`npm install && npm run setup && npm run test:portable\`。\n4. 告诉用户新建一个 Codex 对话，再调用选品猫。\n\n不要把 fixtures/T21 当作新类目的真实证据。\n`, "utf8");
  console.log(JSON.stringify({ status: "exported", target, pluginVersion: manifest.version }, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
