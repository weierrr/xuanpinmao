import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

export type ExportedReportPaths = {
  runId: string;
  directory: string;
  markdownPath: string;
  htmlPath: string;
  markdownChecksum: string;
  htmlChecksum: string;
  version: number;
};

const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");

const parseArray = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");

export const exportRunReports = async (prisma: PrismaClient, runId: string): Promise<ExportedReportPaths> => {
  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: {
      project: true,
      runSpec: true,
      sources: true,
      claims: true,
      riskModules: true,
      economicsScenarios: true,
      workflowStageRuns: { orderBy: [{ stageCode: "asc" }, { attempt: "asc" }] },
      decision: { include: { missingDataItems: true } },
      reports: true,
    },
  });

  if (!run || !run.decision) {
    throw new Error(`run not found or missing decision: ${runId}`);
  }

  const version = run.reports.length + 1;
  const generatedAt = new Date();
  const directory = path.join(process.cwd(), "exports", runId, `v${String(version).padStart(3, "0")}-${generatedAt.toISOString().replaceAll(":", "")}`);
  await mkdir(directory, { recursive: true });

  const missingTitles = run.decision.missingDataItems.map((item) => `${item.priority} ${item.title}`);
  const moduleRows = run.riskModules
    .sort((left, right) => left.moduleCode.localeCompare(right.moduleCode))
    .map(
      (module) =>
        `| ${module.moduleCode} | ${module.moduleName} | ${module.relevance} | ${module.executionStatus} | ${module.evidenceSufficiency} | ${module.decisionUsability} | ${module.nextAction} |`,
    )
    .join("\n");
  const economicsRows = run.economicsScenarios
    .sort((left, right) => left.quantity - right.quantity)
    .map(
      (scenario) =>
        `| ${scenario.quantity} | ${scenario.netRevenue?.toString() ?? "未知"} | ${scenario.supplierCost?.toString() ?? "未知"} | ${scenario.internationalShipping?.toString() ?? "未知"} | ${scenario.cm1?.toString() ?? "未知"} | ${scenario.breakEvenCpa?.toString() ?? "不适用"} | ${scenario.breakEvenRoas?.toString() ?? "不适用"} |`,
    )
    .join("\n");
  const stageRows = run.workflowStageRuns
    .map((stage) => `| ${stage.stageCode} | ${stage.attempt} | ${stage.status} | ${stage.errorCode ?? ""} |`)
    .join("\n");

  const markdown = `# T21 Fixture 商品尽调报告

> 数据来源：测试数据 Fixture。不得作为其他真实商品证据。

| 项目 | 值 |
| --- | --- |
| Run ID | ${run.id} |
| 生成时间 | ${generatedAt.toISOString()} |
| 项目 | ${run.project.name} |
| RunSpec | ${run.runSpec.productName} |
| 正式主状态 | ${run.decision.formalStatus} |
| 是否允许发布 Listing | ${run.decision.listingAllowed ? "是" : "否"} |
| 是否允许启动广告测试 | ${run.decision.adTestAllowed ? "是" : "否"} |
| Source 数量 | ${run.sources.length} |
| Claim 数量 | ${run.claims.length} |
| 模块数量 | ${run.riskModules.length} |

## 决策

${run.decision.rationale}

决定状态的 Claim：${parseArray(run.decision.determiningClaimIds).join(", ")}

## 最小补证

${missingTitles.map((title) => `- ${title}`).join("\n")}

## 13阶段运行

| 阶段 | Attempt | 状态 | 错误 |
| --- | ---: | --- | --- |
${stageRows}

## 风险模块

| 模块 | 名称 | 相关性 | 执行状态 | 证据充分性 | 决策可用性 | 下一动作 |
| --- | --- | --- | --- | --- | --- | --- |
${moduleRows}

## 单位经济

未知字段保留为“未知”，不得默认为 0。

| 件数 | 收入 | 采购情景 | 国际物流 | CM1 | 盈亏平衡 CPA | 盈亏平衡 ROAS |
| ---: | ---: | ---: | ---: | --- | --- | --- |
${economicsRows}

## 证据计数

- Source：${run.sources.length}
- Claim：${run.claims.length}
- 15模块：${run.riskModules.length}
- 正式单位经济：未完成
`;

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>T21 Fixture 商品尽调报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 40px; color: #222222; background: #fffefc; line-height: 1.55; }
    h1, h2, h3 { color: #0f3e17; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0 28px; }
    th, td { border: 1px solid #efeeeb; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #b6ced5; }
    .badge { display: inline-block; padding: 3px 8px; border: 1px solid #b45309; color: #92400e; background: #fffbeb; font-size: 12px; }
  </style>
</head>
<body>
  <p class="badge">测试数据 Fixture</p>
  <h1>T21 Fixture 商品尽调报告</h1>
  <table>
    <tbody>
      <tr><th>Run ID</th><td>${escapeHtml(run.id)}</td></tr>
      <tr><th>生成时间</th><td>${escapeHtml(generatedAt.toISOString())}</td></tr>
      <tr><th>项目</th><td>${escapeHtml(run.project.name)}</td></tr>
      <tr><th>正式主状态</th><td>${escapeHtml(run.decision.formalStatus)}</td></tr>
      <tr><th>发布 Listing</th><td>${run.decision.listingAllowed ? "是" : "否"}</td></tr>
      <tr><th>广告测试</th><td>${run.decision.adTestAllowed ? "是" : "否"}</td></tr>
      <tr><th>Source / Claim / 模块</th><td>${run.sources.length} / ${run.claims.length} / ${run.riskModules.length}</td></tr>
    </tbody>
  </table>
  <h2>决策</h2>
  <p>${escapeHtml(run.decision.rationale)}</p>
  <h2>最小补证</h2>
  <ul>${missingTitles.map((title) => `<li>${escapeHtml(title)}</li>`).join("")}</ul>
  <h2>风险模块</h2>
  <pre>${escapeHtml(moduleRows)}</pre>
  <h2>单位经济</h2>
  <p>未知字段保留为“未知”，不得默认为 0。</p>
  <pre>${escapeHtml(economicsRows)}</pre>
</body>
</html>
`;

  const markdownChecksum = sha256(markdown);
  const htmlChecksum = sha256(html);
  const markdownPath = path.join(directory, "T21_report.md");
  const htmlPath = path.join(directory, "T21_report.html");
  await writeFile(markdownPath, markdown, "utf8");
  await writeFile(htmlPath, html, "utf8");

  await prisma.report.createMany({
    data: [
      {
        id: `report-${runId}-md-v${version}`,
        researchRunId: runId,
        format: "markdown",
        version,
        filePath: markdownPath,
        checksum: markdownChecksum,
        formalStatus: run.decision.formalStatus,
        generatedAt,
        supersedesReportId: null,
      },
      {
        id: `report-${runId}-html-v${version}`,
        researchRunId: runId,
        format: "html",
        version,
        filePath: htmlPath,
        checksum: htmlChecksum,
        formalStatus: run.decision.formalStatus,
        generatedAt,
        supersedesReportId: null,
      },
    ],
  });

  return {
    runId,
    directory,
    markdownPath,
    htmlPath,
    markdownChecksum,
    htmlChecksum,
    version,
  };
};
