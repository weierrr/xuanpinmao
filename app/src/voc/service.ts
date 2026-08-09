import { createHash } from "node:crypto";
import { accessSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { codexNativeRunPath, researchPackagePath } from "../first-principles/service";
import { readEvidencePackage } from "../research/evidence-package";
import { vocCorpusSchema, vocSummarySchema, type VocCorpus, type VocObservation, type VocSummary } from "./types";
import { validateVocCorpus } from "./validation";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const vocPaths = (runId: string) => {
  const root = codexNativeRunPath(runId);
  return {
    root,
    task: path.join(root, "voc-research-task.json"),
    corpus: path.join(root, "voc-corpus.json"),
    validation: path.join(root, "voc-validation.json"),
    summaryJson: path.join(root, "voc-summary.json"),
    summaryMarkdown: path.join(root, "voc-summary.md"),
  };
};

export const prepareVocResearch = async (runId: string) => {
  const evidencePackage = await readEvidencePackage(researchPackagePath(runId));
  const paths = vocPaths(runId);
  await mkdir(paths.root, { recursive: true });
  const task = {
    task_version: "1.0",
    task: "voice-of-customer-evidence",
    research_run_id: runId,
    product: evidencePackage.researchInput.productName,
    market: evidencePackage.researchInput.targetMarket,
    standard: "docs/VOICE_OF_CUSTOMER_RESEARCH_STANDARD.md",
    skill_check: {
      skill: "web-access",
      status: "available",
      path_or_loader: "Codex web-access Skill + browser runtime",
      search_capability: true,
      page_read_capability: true,
      snapshot_capability: true,
      dynamic_page_capability: true,
      comments_expand_capability: "platform-dependent",
    },
    allowed_source_ids: evidencePackage.sources.map((source) => source.id),
    existing_sources: evidencePackage.sources.map((source) => ({
      source_id: source.id,
      title: source.title,
      url: source.url,
      snapshot_path: source.snapshotPath ?? null,
    })),
    requirements: [
      "Read page bodies; search snippets are discovery only",
      "Trace every observation to current-run Source, URL, and Snapshot",
      "Keep competitor and parent-listing experience out of target-SKU facts",
      "Collect and report counterevidence",
      "Do not bypass authentication, CAPTCHA, or anti-bot controls",
      "Remove personal identifiers and retain only brief excerpts",
    ],
    output_file: path.relative(process.cwd(), paths.corpus),
  };
  await writeFile(paths.task, json(task), "utf8");
  return { status: "prepared", taskFile: paths.task, corpusFile: paths.corpus, task };
};

export const validateVocFile = async (runId: string, filePath: string) => {
  const evidencePackage = await readEvidencePackage(researchPackagePath(runId));
  const raw = JSON.parse(await readFile(path.resolve(filePath), "utf8")) as unknown;
  const result = validateVocCorpus(raw, evidencePackage, (candidate) => {
    try {
      accessSync(candidate);
      return true;
    } catch {
      return false;
    }
  });
  const paths = vocPaths(runId);
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.validation, json(result), "utf8");
  return { ...result, file: path.resolve(filePath), validationFile: paths.validation };
};

const themeRows = (observations: VocObservation[], denominator: number) => {
  const grouped = new Map<string, VocObservation[]>();
  for (const observation of observations) {
    grouped.set(observation.theme, [...(grouped.get(observation.theme) ?? []), observation]);
  }
  return [...grouped.entries()]
    .map(([theme, items]) => ({
      theme,
      count: items.length,
      denominator,
      source_families: [...new Set(items.map((item) => item.source_family))],
      sentiments: {
        negative: items.filter((item) => item.sentiment === "negative").length,
        neutral: items.filter((item) => item.sentiment === "neutral").length,
        positive: items.filter((item) => item.sentiment === "positive").length,
        mixed: items.filter((item) => item.sentiment === "mixed").length,
      },
      scope_note: [...new Set(items.map((item) => item.product_scope))].join(", "),
    }))
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme));
};

export const summarizeVocCorpus = (corpus: VocCorpus): VocSummary => {
  const observations = corpus.observations;
  const families = new Set(observations.map((item) => item.source_family));
  const platforms = new Set(observations.map((item) => item.platform));
  const negativeOrNeutral = observations.filter((item) => item.sentiment === "negative" || item.sentiment === "neutral").length;
  const positiveOrCounter = observations.filter((item) => item.observation_type === "positive_evidence" || item.observation_type === "counterevidence").length;
  const alternativeObservations = observations.filter((item) => item.observation_type === "alternative").length;
  let confidence: VocSummary["confidence"] = "INSUFFICIENT";
  let confidenceRationale = "No valid comment-level observations are available.";
  if (observations.length > 0) {
    confidence = "LOW";
    confidenceRationale = "The bounded corpus has comment-level evidence, but triangulation or counterevidence is insufficient.";
  }
  if (observations.length >= 12 && families.size >= 2 && positiveOrCounter > 0) {
    confidence = "MEDIUM";
    confidenceRationale = "Recurring themes are traceable across at least two source families and include counterevidence.";
  }
  if (observations.length >= 30 && families.size >= 3 && negativeOrNeutral >= 10 && positiveOrCounter >= 5) {
    confidence = "HIGH";
    confidenceRationale = "The bounded corpus is triangulated across three source families with material critical evidence and counterevidence.";
  }
  const blockers = [];
  if (families.size < 2) blockers.push("Fewer than two independent source families.");
  if (positiveOrCounter === 0) blockers.push("No positive or counterevidence observations.");
  if (!corpus.amazon_comment_level_evidence) blockers.push("No Amazon comment-level evidence was collected.");

  return vocSummarySchema.parse({
    schema_version: "1.0",
    run_id: corpus.run_id,
    generated_at: new Date().toISOString(),
    confidence,
    confidence_rationale: confidenceRationale,
    coverage: {
      valid_observations: observations.length,
      negative_or_neutral: negativeOrNeutral,
      positive_or_counterevidence: positiveOrCounter,
      alternative_observations: alternativeObservations,
      source_count: corpus.source_pages.length,
      source_family_count: families.size,
      platform_count: platforms.size,
      duplicate_count: 0,
      excluded_count: 0,
    },
    top_pain_points: themeRows(observations.filter((item) => item.observation_type === "pain" || item.observation_type === "objection"), observations.length).slice(0, 8),
    desired_outcomes: themeRows(observations.filter((item) => item.observation_type === "desired_outcome" || item.observation_type === "workaround"), observations.length).slice(0, 8),
    positive_and_counterevidence: themeRows(observations.filter((item) => item.observation_type === "positive_evidence" || item.observation_type === "counterevidence"), observations.length).slice(0, 8),
    representative_excerpts: observations.flatMap((item) =>
      item.quote_excerpt
        ? [{
            theme: item.theme,
            excerpt: item.quote_excerpt,
            url: item.page_url,
            source_family: item.source_family,
          }]
        : []).slice(0, 8),
    blockers,
    limitations: corpus.limitations,
    amazon_comment_level_evidence: corpus.amazon_comment_level_evidence,
    denominator_definition: corpus.denominator_definition,
  });
};

export const vocSummaryMarkdown = (summary: VocSummary): string => {
  const themes = (items: VocSummary["top_pain_points"]) =>
    items.length === 0
      ? "- 无"
      : items.map((item) => `- ${item.theme}: ${item.count}/${item.denominator}; 来源族：${item.source_families.join("、")}; 范围：${item.scope_note}`).join("\n");
  return `# 用户之声证据摘要

## 覆盖与置信度

- 置信度：${summary.confidence}
- 有效观察：${summary.coverage.valid_observations}
- 负面或中性：${summary.coverage.negative_or_neutral}
- 正向或反证：${summary.coverage.positive_or_counterevidence}
- 替代方案观察：${summary.coverage.alternative_observations}
- 来源页面：${summary.coverage.source_count}
- 独立来源族：${summary.coverage.source_family_count}
- 平台：${summary.coverage.platform_count}
- 分母：${summary.denominator_definition}

${summary.confidence_rationale}

## 主要痛点
${themes(summary.top_pain_points)}

## 期望结果与替代做法
${themes(summary.desired_outcomes)}

## 正向证据与反证
${themes(summary.positive_and_counterevidence)}

## 代表性短摘录
${summary.representative_excerpts.length === 0 ? "- 无" : summary.representative_excerpts.map((item) => `- [${item.theme}](${item.url})：${item.excerpt}`).join("\n")}

## 阻塞项
${summary.blockers.length === 0 ? "- 无" : summary.blockers.map((item) => `- ${item}`).join("\n")}

## 限制
${summary.limitations.map((item) => `- ${item}`).join("\n")}

Amazon 评论级证据：${summary.amazon_comment_level_evidence ? "已取得" : "未取得"}
`;
};

export const writeVocSummary = async (runId: string) => {
  const paths = vocPaths(runId);
  const corpus = vocCorpusSchema.parse(JSON.parse(await readFile(paths.corpus, "utf8")));
  const summary = summarizeVocCorpus(corpus);
  const markdown = vocSummaryMarkdown(summary);
  await Promise.all([
    writeFile(paths.summaryJson, json(summary), "utf8"),
    writeFile(paths.summaryMarkdown, markdown, "utf8"),
  ]);
  return { status: "summarized", summary, jsonFile: paths.summaryJson, markdownFile: paths.summaryMarkdown, markdown };
};

export const readVocSummary = async (runId: string): Promise<VocSummary | null> => {
  try {
    return vocSummarySchema.parse(JSON.parse(await readFile(vocPaths(runId).summaryJson, "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
};

export const importVoc = async (prisma: PrismaClient, runId: string, filePath: string) => {
  const validation = await validateVocFile(runId, filePath);
  if (!validation.valid) throw new Error(`VOC validation failed: ${validation.errors.map((item) => item.code).join(", ")}`);
  const corpus = vocCorpusSchema.parse(JSON.parse(await readFile(path.resolve(filePath), "utf8")));
  const paths = vocPaths(runId);
  if (path.resolve(filePath) !== path.resolve(paths.corpus)) await writeFile(paths.corpus, json(corpus), "utf8");
  const summaryResult = await writeVocSummary(runId);
  const stageId = `voc-${createHash("sha256").update(runId).digest("hex").slice(0, 20)}`;
  const now = new Date();
  const stage = await prisma.workflowStageRun.upsert({
    where: { researchRunId_stageCode_attempt: { researchRunId: runId, stageCode: "voc_evidence", attempt: 1 } },
    create: {
      id: stageId,
      researchRunId: runId,
      stageCode: "voc_evidence",
      attempt: 1,
      status: "succeeded",
      inputArtifactRef: path.relative(process.cwd(), paths.task),
      outputArtifactRef: path.relative(process.cwd(), paths.corpus),
      startedAt: new Date(corpus.generated_at),
      completedAt: now,
      log: "Validated and imported current-run VOC corpus. No external model API was called.",
    },
    update: {
      status: "succeeded",
      inputArtifactRef: path.relative(process.cwd(), paths.task),
      outputArtifactRef: path.relative(process.cwd(), paths.corpus),
      completedAt: now,
      errorCode: null,
      errorMessage: null,
      log: "Validated and imported current-run VOC corpus with idempotent run isolation.",
    },
  });
  return {
    status: "imported",
    idempotentKey: `${runId}:voc_evidence:1`,
    workflowStageRunId: stage.id,
    corpusFile: paths.corpus,
    validation,
    summary: summaryResult.summary,
  };
};
