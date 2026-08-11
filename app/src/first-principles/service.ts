import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { readEvidencePackage } from "../research/evidence-package";
import { readLiveResearchArtifacts } from "../research/live-research";
import type { ResearchClaim } from "../research/live-types";
import { generateLiveResearchReports } from "../research/live-report";
import { firstPrinciplesBundleSchema, firstPrinciplesResourcesSchema, type FirstPrinciplesBundle, type FirstPrinciplesResources } from "./types";
import { validateFirstPrinciplesBundle, type FirstPrinciplesValidationContext } from "./validation";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const currentRunFile = path.join(process.cwd(), ".runtime", "codex-native", "current-run.json");
export const researchPackagePath = (runId: string): string => path.join(process.cwd(), "output", "research", runId);
export const codexNativeRunPath = (runId: string): string => path.join(process.cwd(), "output", "codex-native", runId);
export const firstPrinciplesPaths = (runId: string) => {
  const root = codexNativeRunPath(runId);
  return {
    root,
    task: path.join(root, "first-principles-task.json"),
    bundle: path.join(root, "first-principles-bundle.json"),
    validation: path.join(root, "first-principles-validation.json"),
    commercialLink: path.join(root, "commercial-intelligence-first-principles.json"),
    summary: path.join(root, "first-principles-summary.md"),
  };
};

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export type CurrentResearchRunCandidate = {
  researchRunId: string;
  packagePath: string;
  createdAt: string;
};

export const resolveCurrentResearchRunCandidate = (
  candidates: CurrentResearchRunCandidate[],
): CurrentResearchRunCandidate | undefined =>
  [...new Map(candidates.map((candidate) => [candidate.researchRunId, candidate])).values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.researchRunId.localeCompare(a.researchRunId))[0];

export const selectCurrentResearchRun = async (): Promise<{ researchRunId: string; packagePath: string }> => {
  const candidates: CurrentResearchRunCandidate[] = [];
  if (await exists(currentRunFile)) {
    const current = JSON.parse(await readFile(currentRunFile, "utf8")) as { researchRunId?: string; packagePath?: string };
    if (current.researchRunId) {
      const packagePath = current.packagePath ?? researchPackagePath(current.researchRunId);
      try {
        const manifest = JSON.parse(await readFile(path.join(packagePath, "manifest.json"), "utf8")) as { createdAt?: string };
        candidates.push({ researchRunId: current.researchRunId, packagePath, createdAt: manifest.createdAt ?? "" });
      } catch {
        // Ignore a stale pointer and recover from the available evidence packages below.
      }
    }
  }

  const researchRoot = path.join(process.cwd(), "output", "research");
  const entries = await readdir(researchRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packagePath = path.join(researchRoot, entry.name);
    try {
      const manifest = JSON.parse(await readFile(path.join(packagePath, "manifest.json"), "utf8")) as {
        researchRunId?: string;
        createdAt?: string;
      };
      if (manifest.researchRunId) candidates.push({ researchRunId: manifest.researchRunId, packagePath, createdAt: manifest.createdAt ?? "" });
    } catch {
      // Ignore incomplete directories when resolving the current completed run.
    }
  }
  const selected = resolveCurrentResearchRunCandidate(candidates);
  if (!selected) throw new Error("No current Research Run could be resolved");
  await mkdir(path.dirname(currentRunFile), { recursive: true });
  await writeFile(currentRunFile, json({ researchRunId: selected.researchRunId, packagePath: selected.packagePath }), "utf8");
  return { researchRunId: selected.researchRunId, packagePath: selected.packagePath };
};

const resourcesFromInput = (input: Awaited<ReturnType<typeof readEvidencePackage>>["researchInput"]): FirstPrinciplesResources =>
  firstPrinciplesResourcesSchema.parse({
    budget: input.budget ?? null,
    available_time: input.availableTime ?? null,
    team_size: input.teamSize ?? null,
    current_supplier_resources: input.currentSupplierResources ?? [],
    current_channel_assets: input.currentChannelAssets ?? [],
    current_content_assets: input.currentContentAssets ?? [],
    acceptable_moq: input.acceptableMoq ?? null,
    target_margin: input.targetMargin ?? null,
    unacceptable_risks: input.unacceptableRisks ?? [],
    preferred_business_model: input.preferredBusinessModel ?? null,
    validation_goal: input.validationGoal ?? null,
  });

const resourceInputComplete = (resources: FirstPrinciplesResources): boolean =>
  resources.budget !== null && resources.available_time !== null && resources.team_size !== null && resources.validation_goal !== null;

export const loadFirstPrinciplesContext = async (
  prisma: PrismaClient,
  runId: string,
): Promise<FirstPrinciplesValidationContext & { packagePath: string; resources: FirstPrinciplesResources; claims: ResearchClaim[] }> => {
  const packagePath = researchPackagePath(runId);
  const [evidencePackage, liveArtifacts, run, decision] = await Promise.all([
    readEvidencePackage(packagePath),
    readLiveResearchArtifacts(packagePath),
    prisma.researchRun.findUnique({ where: { id: runId }, select: { dataOrigin: true } }),
    prisma.decision.findUnique({ where: { researchRunId: runId }, select: { formalStatus: true, listingAllowed: true, adTestAllowed: true } }),
  ]);
  if (!run) throw new Error(`Research Run not found in database: ${runId}`);
  const resources = resourcesFromInput(evidencePackage.researchInput);
  return {
    researchRunId: runId,
    product: evidencePackage.researchInput.productName,
    market: evidencePackage.researchInput.targetMarket,
    claims: liveArtifacts.claims,
    dataOrigin: run.dataOrigin,
    resourceInputComplete: resourceInputComplete(resources),
    formalDecision: decision ?? undefined,
    packagePath,
    resources,
  };
};

const bundleTemplate = (runId: string, product: string, market: string, resources: FirstPrinciplesResources): Record<string, unknown> => ({
  schema_version: "1.0",
  run_id: runId,
  product,
  market,
  generated_at: "ISO-8601 timestamp",
  methodology: "SACL",
  resources,
  problem_reframe: "ProblemReframe",
  fact_hypothesis_unknown: { facts: [], hypotheses: [], unknowns: [] },
  demand_atoms: [],
  supply_atoms: [],
  constraints: { hard: [], soft: [], pseudo: [] },
  opportunity_hypotheses: "2-4 distinct OpportunityHypothesis objects with 8 score dimensions",
  recommended_opportunity_id: null,
  recommendation_rationale: "Evidence-bounded recommendation",
  alternatives_not_recommended: [],
  validation_plan: "At least 3 experiments for the recommendation in a 7-14 day window",
  decision_summary: {
    first_principles_recommendation: "Opportunity to validate",
    product_selection_decision: "PROCEED_TO_SAMPLE | HOLD_RESEARCH | REJECT",
    formal_sku_decision: "HOLD_SUPPLY unless existing formal gates say otherwise",
    listing_allowed: false,
    ad_test_allowed: false,
  },
});

export const prepareFirstPrinciples = async (prisma: PrismaClient, runId: string): Promise<Record<string, unknown>> => {
  const context = await loadFirstPrinciplesContext(prisma, runId);
  const paths = firstPrinciplesPaths(runId);
  await mkdir(paths.root, { recursive: true });
  const task = {
    task_version: "1.0",
    task: "first-principles-opportunity-engine",
    methodology: "SACL",
    research_run_id: runId,
    product: context.product,
    market: context.market,
    evidence_package: path.relative(process.cwd(), context.packagePath),
    allowed_claim_ids: context.claims.map((claim) => claim.id),
    claims: context.claims,
    resources: context.resources,
    guardrails: [
      "Use only the current run's claims and explicit user inputs",
      "Do not migrate competitor claims into target-SKU facts",
      "Do not treat public supplier candidates as formal quotes",
      "Keep unknowns unknown",
      "Do not unlock Formal SKU, Listing, or Ad Test gates",
    ],
    output_file: path.relative(process.cwd(), paths.bundle),
    bundle_template: bundleTemplate(runId, context.product, context.market, context.resources),
  };
  await writeFile(paths.task, json(task), "utf8");
  return { status: "prepared", taskFile: paths.task, bundleFile: paths.bundle, ...task };
};

export const validateFirstPrinciplesFile = async (prisma: PrismaClient, runId: string, filePath: string) => {
  const context = await loadFirstPrinciplesContext(prisma, runId);
  const raw = JSON.parse(await readFile(path.resolve(filePath), "utf8")) as unknown;
  const result = validateFirstPrinciplesBundle(raw, context);
  const paths = firstPrinciplesPaths(runId);
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.validation, json(result), "utf8");
  return { ...result, file: path.resolve(filePath), validationFile: paths.validation };
};

const commercialIntelligenceLink = (bundle: FirstPrinciplesBundle): Record<string, unknown> => {
  const recommended = bundle.opportunity_hypotheses.find((item) => item.id === bundle.recommended_opportunity_id) ?? null;
  return {
    schema_version: "1.0",
    run_id: bundle.run_id,
    generated_at: bundle.generated_at,
    source_artifact: "first-principles-bundle.json",
    C02: { demand_atom_ids: bundle.demand_atoms.map((item) => item.id) },
    C05: { supply_atom_ids: bundle.supply_atoms.map((item) => item.id), constraint_ids: Object.values(bundle.constraints).flat().map((item) => item.id) },
    C06: { recommended_opportunity_id: bundle.recommended_opportunity_id },
    C07: recommended ? { value_proposition: recommended.core_value_proposition, explicit_non_goals: recommended.explicit_non_goals } : null,
    C08: { validation_experiment_ids: bundle.validation_plan.map((item) => item.id) },
    product_selection_reference: recommended ? { opportunity_id: recommended.id, score: recommended.score } : null,
    formal_gate_override: false,
  };
};

type WorkflowStagePersistence = {
  workflowStageRun: {
    upsert: (args: Parameters<PrismaClient["workflowStageRun"]["upsert"]>[0]) => Promise<{ id: string }>;
  };
};

export const persistFirstPrinciplesStage = async (
  persistence: WorkflowStagePersistence,
  runId: string,
  bundle: FirstPrinciplesBundle,
  taskFile: string,
  bundleFile: string,
): Promise<{ id: string }> => {
  const now = new Date();
  const stageId = `fps-${createHash("sha256").update(runId).digest("hex").slice(0, 20)}`;
  return persistence.workflowStageRun.upsert({
    where: { researchRunId_stageCode_attempt: { researchRunId: runId, stageCode: "first_principles", attempt: 1 } },
    create: {
      id: stageId,
      researchRunId: runId,
      stageCode: "first_principles",
      attempt: 1,
      status: "succeeded",
      inputArtifactRef: path.relative(process.cwd(), taskFile),
      outputArtifactRef: path.relative(process.cwd(), bundleFile),
      startedAt: new Date(bundle.generated_at),
      completedAt: now,
      log: "Validated and imported Codex-native First-Principles Bundle. No external model API was called.",
    },
    update: {
      status: "succeeded",
      inputArtifactRef: path.relative(process.cwd(), taskFile),
      outputArtifactRef: path.relative(process.cwd(), bundleFile),
      completedAt: now,
      errorCode: null,
      errorMessage: null,
      log: "Validated and imported Codex-native First-Principles Bundle. Idempotent upsert preserved run isolation.",
    },
  });
};

export const importFirstPrinciples = async (prisma: PrismaClient, runId: string, filePath: string) => {
  const validation = await validateFirstPrinciplesFile(prisma, runId, filePath);
  if (!validation.valid) throw new Error(`First-Principles validation failed: ${validation.errors.map((item) => item.code).join(", ")}`);
  const bundle = firstPrinciplesBundleSchema.parse(JSON.parse(await readFile(path.resolve(filePath), "utf8")));
  const paths = firstPrinciplesPaths(runId);
  await mkdir(paths.root, { recursive: true });
  if (path.resolve(filePath) !== path.resolve(paths.bundle)) await writeFile(paths.bundle, json(bundle), "utf8");
  await writeFile(paths.commercialLink, json(commercialIntelligenceLink(bundle)), "utf8");

  const stage = await persistFirstPrinciplesStage(prisma, runId, bundle, paths.task, paths.bundle);
  return {
    status: "imported",
    idempotentKey: `${runId}:first_principles:1`,
    workflowStageRunId: stage.id,
    bundleFile: paths.bundle,
    commercialIntelligenceFile: paths.commercialLink,
    validation,
  };
};

export const readFirstPrinciplesBundle = async (runId: string): Promise<FirstPrinciplesBundle> =>
  firstPrinciplesBundleSchema.parse(JSON.parse(await readFile(firstPrinciplesPaths(runId).bundle, "utf8")));

const bullets = (items: string[]): string => items.map((item) => `- ${item}`).join("\n");

export const firstPrinciplesSummaryMarkdown = (bundle: FirstPrinciplesBundle): string => {
  const recommended = bundle.opportunity_hypotheses.find((item) => item.id === bundle.recommended_opportunity_id);
  return `# 第一性原理机会重构：${bundle.product} / ${bundle.market}

## 问题重述

${bundle.problem_reframe.reframed_problem}

## 已知事实
${bullets(bundle.fact_hypothesis_unknown.facts.map((item) => `${item.statement} (${item.supporting_claim_ids.join(", ")})`))}

## 假设与待验证
${bullets([...bundle.fact_hypothesis_unknown.hypotheses, ...bundle.fact_hypothesis_unknown.unknowns].map((item) => `${item.classification}: ${item.statement}`))}

## 原子需求
${bullets(bundle.demand_atoms.map((item) => `${item.id}: ${item.user_segment} / ${item.scenario} / ${item.pain_or_job} -> ${item.desired_outcome}`))}

## 原子供给
${bullets(bundle.supply_atoms.map((item) => `${item.id}: ${item.name} (${item.target_sku_verified ? "target SKU verified" : "candidate only"})`))}

## 约束
${bullets(Object.values(bundle.constraints).flat().map((item) => `${item.type}: ${item.statement} -> ${item.design_response}`))}

## 机会组合
${bullets(bundle.opportunity_hypotheses.map((item) => `${item.id}: ${item.title} / ${item.score}/100 / ${item.core_value_proposition}`))}

## 推荐机会

${recommended ? `**${recommended.title} (${recommended.score}/100)**\n\n${bundle.recommendation_rationale}` : "当前没有可推荐机会。"}

## 为什么不推荐其他方向
${bullets(bundle.alternatives_not_recommended.map((item) => `${item.opportunity_id}: ${item.reason}`))}

## 7-14 天验证计划
${bullets(bundle.validation_plan.map((item) => `${item.id}: ${item.test_type}, ${item.duration_days} 天, 预算上限 ${item.budget_cap}, PASS ${item.pass_threshold}, FAIL ${item.fail_threshold}, STOP ${item.stop_condition}`))}

## 决策边界

| 层级 | 状态 |
| --- | --- |
| First-Principles Recommendation | ${bundle.decision_summary.first_principles_recommendation} |
| Product Selection Decision | ${bundle.decision_summary.product_selection_decision} |
| Formal SKU Decision | ${bundle.decision_summary.formal_sku_decision} |
| Listing Allowed | ${bundle.decision_summary.listing_allowed ? "YES" : "NO"} |
| Ad Test Allowed | ${bundle.decision_summary.ad_test_allowed ? "YES" : "NO"} |
`;
};

export const writeFirstPrinciplesSummary = async (runId: string): Promise<{ file: string; markdown: string }> => {
  const bundle = await readFirstPrinciplesBundle(runId);
  const markdown = firstPrinciplesSummaryMarkdown(bundle);
  const file = firstPrinciplesPaths(runId).summary;
  await writeFile(file, markdown, "utf8");
  return { file, markdown };
};

export const firstPrinciplesUrls = (runId: string, baseUrl = "http://localhost:3000") => ({
  home: `${baseUrl}/`,
  preSampleBrief: `${baseUrl}/research/${runId}/brief`,
  research: `${baseUrl}/research/${runId}`,
  firstPrinciples: `${baseUrl}/research/${runId}/first-principles`,
  commercialIntelligence: `${baseUrl}/research/${runId}/commercial-intelligence`,
  decision: `${baseUrl}/research/${runId}/decision`,
  htmlReport: `${baseUrl}/api/research/${runId}/report-html`,
});

export const finalizeFirstPrinciplesRun = async (prisma: PrismaClient, runId: string) => {
  const paths = firstPrinciplesPaths(runId);
  const validation = await validateFirstPrinciplesFile(prisma, runId, paths.bundle);
  if (!validation.valid) throw new Error(`First-Principles finalization failed: ${validation.errors.map((item) => item.code).join(", ")}`);
  const [bundle, evidencePackage, artifacts, summary] = await Promise.all([
    readFirstPrinciplesBundle(runId),
    readEvidencePackage(researchPackagePath(runId)),
    readLiveResearchArtifacts(researchPackagePath(runId)),
    writeFirstPrinciplesSummary(runId),
  ]);
  const reports = await generateLiveResearchReports(researchPackagePath(runId), evidencePackage, artifacts.claims, artifacts.analysis, bundle);
  return {
    status: "finalized",
    runId,
    summaryFile: summary.file,
    markdownReport: reports.markdownPath,
    htmlReport: reports.htmlPath,
    productSelectionDecision: bundle.decision_summary.product_selection_decision,
    formalSkuDecision: bundle.decision_summary.formal_sku_decision,
    listingAllowed: bundle.decision_summary.listing_allowed,
    adTestAllowed: bundle.decision_summary.ad_test_allowed,
  };
};

export const exportFirstPrinciplesRun = async (runId: string) => {
  const paths = firstPrinciplesPaths(runId);
  const packagePath = researchPackagePath(runId);
  const files = [
    paths.task,
    paths.bundle,
    paths.validation,
    paths.commercialLink,
    paths.summary,
    path.join(packagePath, "reports", "decision-report.md"),
    path.join(packagePath, "reports", "analysis-report.html"),
  ];
  const missing = [];
  for (const file of files) if (!(await exists(file))) missing.push(file);
  if (missing.length > 0) throw new Error(`Cannot export incomplete run; missing: ${missing.join(", ")}`);
  for (const briefFile of [
    path.join(packagePath, "reports", "pre-sample-decision-brief.md"),
    path.join(packagePath, "reports", "pre-sample-decision-brief.html"),
  ]) {
    if (await exists(briefFile)) files.push(briefFile);
  }
  for (const vocFile of [
    "voc-research-task.json",
    "voc-corpus.json",
    "voc-validation.json",
    "voc-summary.json",
    "voc-summary.md",
  ].map((name) => path.join(paths.root, name))) {
    if (await exists(vocFile)) files.push(vocFile);
  }
  return { status: "exported", runId, files };
};
