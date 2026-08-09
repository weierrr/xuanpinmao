import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { firstPrinciplesBundleSchema } from "../first-principles/types";
import { codexNativeRunPath, firstPrinciplesPaths } from "../first-principles/service";
import { vocCorpusSchema } from "../voc/types";
import { vocPaths } from "../voc/service";
import { buildConceptMessageArchitecture } from "../marketing-translation/concept";
import { demandStatusZh } from "./presentation";
import { demandFieldArtifactSchema, type DemandFieldArtifact } from "./types";
import { validateDemandFieldArtifact } from "./validation";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const demandFieldPaths = (runId: string) => {
  const root = codexNativeRunPath(runId);
  return {
    root,
    task: path.join(root, "demand-field-task.json"),
    artifact: path.join(root, "demand-field.json"),
    validation: path.join(root, "demand-field-validation.json"),
    summary: path.join(root, "demand-field-summary.md"),
  };
};

const readInputs = async (runId: string) => {
  const [corpus, firstPrinciples] = await Promise.all([
    readFile(vocPaths(runId).corpus, "utf8").then((body) => vocCorpusSchema.parse(JSON.parse(body))),
    readFile(firstPrinciplesPaths(runId).bundle, "utf8").then((body) => firstPrinciplesBundleSchema.parse(JSON.parse(body))),
  ]);
  return { corpus, firstPrinciples };
};

export const prepareDemandField = async (runId: string) => {
  const { corpus, firstPrinciples } = await readInputs(runId);
  const paths = demandFieldPaths(runId);
  await mkdir(paths.root, { recursive: true });
  const task = {
    task_version: "1.0",
    task: "first-principles-demand-field-reconstruction",
    research_run_id: runId,
    product: corpus.product,
    market: corpus.market,
    input_files: {
      voc_corpus: path.relative(process.cwd(), vocPaths(runId).corpus),
      first_principles_bundle: path.relative(process.cwd(), firstPrinciplesPaths(runId).bundle),
    },
    allowed_observation_ids: corpus.observations.map((item) => item.observation_id),
    allowed_demand_atom_ids: firstPrinciples.demand_atoms.map((item) => item.id),
    guardrails: [
      "Model aggregated behavioral audiences, never individual people or account histories",
      "Every audience, scenario, need and opportunity relationship must cite current-run VOC Observation IDs",
      "Separate direct adjacent-product evidence from task-chain inference",
      "Keep inferred adjacent products at hypothesis status",
      "Show counterevidence and evidence gaps",
      "Do not change the current product decision",
      "Adjacent opportunities require a new Research Run and cannot be approved here",
    ],
    output_file: path.relative(process.cwd(), paths.artifact),
  };
  await writeFile(paths.task, json(task), "utf8");
  return { status: "prepared", taskFile: paths.task, artifactFile: paths.artifact, task };
};

export const validateDemandFieldFile = async (runId: string, filePath: string) => {
  const { corpus, firstPrinciples } = await readInputs(runId);
  const raw = JSON.parse(await readFile(path.resolve(filePath), "utf8")) as unknown;
  const validation = validateDemandFieldArtifact(raw, corpus, firstPrinciples);
  const paths = demandFieldPaths(runId);
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.validation, json(validation), "utf8");
  return { ...validation, file: path.resolve(filePath), validationFile: paths.validation };
};

export const demandFieldSummaryMarkdown = (artifact: DemandFieldArtifact): string => {
  const opportunityRows = artifact.adjacent_opportunities.length === 0
    ? "| 无 | - | - | - | - |"
    : artifact.adjacent_opportunities.map((item) =>
      `| ${item.title} | ${item.relationship_types.join(" / ")} | ${item.relationship_strength} | ${item.evidence_status} | ${item.status} |`).join("\n");
  return `# 连续选品机会地图：${artifact.product} / ${artifact.market}

## 决策边界

- 当前商品结论保持不变：是
- 相邻机会已获批准：否
- 进入单品尽调前必须创建新 Research Run：是

## 聚合人群

${artifact.audience_clusters.map((item) => `### ${item.label}

${item.definition}

- 支持观察：${item.supporting_observation_ids.length}
- 明确排除的推断：${item.excluded_demographic_inferences.join("；")}
`).join("\n")}

## 任务链

${[...artifact.task_chain].sort((a, b) => a.sequence - b.sequence)
    .map((item) => `${item.sequence}. **${item.label}**：${item.job}（${item.relative_to_current_product}）`)
    .join("\n")}

## 相邻机会

| 候选机会 | 关系 | 关系强度 | 证据状态 | 下一步 |
| --- | --- | --- | --- | --- |
${opportunityRows}

${artifact.adjacent_opportunities.map((item) => {
  const marketing = item.concept_marketing ?? buildConceptMessageArchitecture(artifact, item);
  return `### ${item.title}

${item.rationale}

- 直接商品证据：${item.direct_product_evidence ? "有" : "无"}
- 为什么未批准：${item.why_not_approved}
- 下一轮研究：${item.next_research_queries.join("；")}

#### 概念级营销表达

> 状态：概念测试草案，不是正式 Listing 或广告文案。

- 目标细分用户：${marketing.targetSegment}
- 核心任务或痛点：${marketing.coreJobOrPain}
- 差异化产品结构：${marketing.differentiatedProductStructure}
- 核心价值主张：${marketing.valueProposition}
- 一句话概念：${marketing.oneSentenceConcept}
- 证据强度：${demandStatusZh(marketing.evidenceStrength)}

| 产品结构 / 卖点 | 用户利益 | 使用场景 | 情绪价值 | 概念话术 | 证据状态 |
| --- | --- | --- | --- | --- | --- |
${marketing.messagePillars.map((pillar) => `| ${pillar.productSellingPoint.replaceAll("|", "\\|")} | ${pillar.customerBenefit.replaceAll("|", "\\|")} | ${pillar.useScenario.replaceAll("|", "\\|")} | ${pillar.emotionalValue.replaceAll("|", "\\|")} | ${pillar.marketingCopy.replaceAll("|", "\\|")} | ${demandStatusZh(pillar.evidenceStatus)} |`).join("\n")}

待验证假设：
${marketing.hypothesesToValidate.map((hypothesis) => `- ${hypothesis}`).join("\n")}

禁止或高风险 Claim：
${marketing.prohibitedClaims.map((claim) => `- ${claim.claim}：${claim.reason}`).join("\n")}
`;
}).join("\n")}

## 限制

${artifact.limitations.map((item) => `- ${item}`).join("\n")}
`;
};

export const writeDemandFieldSummary = async (runId: string) => {
  const paths = demandFieldPaths(runId);
  await access(paths.artifact);
  const artifact = demandFieldArtifactSchema.parse(JSON.parse(await readFile(paths.artifact, "utf8")));
  const markdown = demandFieldSummaryMarkdown(artifact);
  await writeFile(paths.summary, markdown, "utf8");
  return { status: "summarized", summaryFile: paths.summary, markdown };
};
