import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OpportunityDiscoveryPlan } from "@/opportunity-discovery/types";
import type { LiveResearchAnalysis, ResearchClaim } from "@/research/live-types";
import type { EvidencePackage, ResearchSource } from "@/research/types";
import { reportTextZh } from "@/report/report-copy";
import {
  researchWhiteboardSchema,
  researchWhiteboardStageCodes,
  type ResearchWhiteboard,
  type ResearchWhiteboardSource,
  type ResearchWhiteboardReportModule,
  type ResearchWhiteboardStageCode,
  type ResearchWhiteboardStageStatus,
} from "./types";

export const researchWhiteboardPath = (discoveryId: string): string =>
  path.join(process.cwd(), "output", "discovery", discoveryId, "research-whiteboard.json");

const emptyStage = (code: ResearchWhiteboardStageCode, now: string) => ({
  code,
  status: code === "scope" ? "complete" as const : "pending" as const,
  queryCount: 0,
  sourceCount: 0,
  recordCount: 0,
  summary: code === "scope" ? "研究对象、市场与输入线索已经确认。" : "等待 Agent 开始处理。",
  sources: [],
  updatedAt: now,
});

export const createResearchWhiteboard = (
  plan: OpportunityDiscoveryPlan,
  now = new Date(),
): ResearchWhiteboard => {
  const at = now.toISOString();
  const stages = Object.fromEntries(
    researchWhiteboardStageCodes.map((code) => [code, emptyStage(code, at)]),
  );
  return researchWhiteboardSchema.parse({
    schemaVersion: "1.0",
    discoveryId: plan.discoveryId,
    product: plan.categoryKeyword,
    market: plan.targetMarket,
    channel: plan.salesChannel,
    status: "waiting",
    createdAt: at,
    updatedAt: at,
    stages,
    activity: [{
      id: `scope-${now.getTime()}`,
      at,
      stage: "scope",
      status: "complete",
      message: "研究对象已在页面内确认，等待开始证据采集。",
    }],
    reportModules: [],
  });
};

export const initializeResearchWhiteboard = async (
  plan: OpportunityDiscoveryPlan,
  now = new Date(),
): Promise<ResearchWhiteboard> => {
  const whiteboard = createResearchWhiteboard(plan, now);
  await writeFile(researchWhiteboardPath(plan.discoveryId), `${JSON.stringify(whiteboard, null, 2)}\n`, "utf8");
  return whiteboard;
};

export const readResearchWhiteboard = async (discoveryId: string): Promise<ResearchWhiteboard> =>
  researchWhiteboardSchema.parse(JSON.parse(await readFile(researchWhiteboardPath(discoveryId), "utf8")));

const overallStatus = (whiteboard: ResearchWhiteboard): ResearchWhiteboard["status"] => {
  const values = Object.values(whiteboard.stages);
  if (values.some((stage) => stage.status === "blocked")) return "blocked";
  if (["market_report", "customer_report", "competitor_report", "product_report", "marketing_report", "validation_report"]
    .every((code) => whiteboard.stages[code as ResearchWhiteboardStageCode].status === "complete")) return "completed";
  if (values.some((stage) => stage.code.endsWith("_report") && stage.status === "in_progress")) return "reporting";
  if (whiteboard.stages.synthesis.status === "in_progress" || whiteboard.stages.synthesis.status === "complete") return "analyzing";
  if (values.some((stage) => stage.status === "in_progress" || (stage.code !== "scope" && stage.status === "complete"))) return "researching";
  return "waiting";
};

export type ResearchWhiteboardUpdate = {
  stage: ResearchWhiteboardStageCode;
  status: ResearchWhiteboardStageStatus;
  message: string;
  queryCount?: number;
  sourceCount?: number;
  recordCount?: number;
  researchRunId?: string;
  source?: ResearchWhiteboardSource;
};

export const updateResearchWhiteboard = async (
  discoveryId: string,
  update: ResearchWhiteboardUpdate,
  now = new Date(),
): Promise<ResearchWhiteboard> => {
  const current = await readResearchWhiteboard(discoveryId);
  const at = now.toISOString();
  const previousStage = current.stages[update.stage];
  const sources = update.source
    ? [...previousStage.sources.filter((item) => item.url !== update.source?.url), update.source]
    : previousStage.sources;
  const stage = {
    ...previousStage,
    status: update.status,
    queryCount: update.queryCount ?? previousStage.queryCount,
    sourceCount: update.sourceCount ?? Math.max(previousStage.sourceCount, sources.length),
    recordCount: update.recordCount ?? previousStage.recordCount,
    summary: update.message,
    sources,
    updatedAt: at,
  };
  const next = {
    ...current,
    researchRunId: update.researchRunId ?? current.researchRunId,
    updatedAt: at,
    stages: { ...current.stages, [update.stage]: stage },
    activity: [
      ...current.activity,
      { id: `${update.stage}-${now.getTime()}`, at, stage: update.stage, status: update.status, message: update.message },
    ].slice(-60),
  };
  const validated = researchWhiteboardSchema.parse({ ...next, status: overallStatus(next) });
  await writeFile(researchWhiteboardPath(discoveryId), `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return validated;
};

const sourceKind = (source: ResearchSource): ResearchWhiteboardSource["kind"] => ({
  market: "market",
  competitor: "competitor",
  supplier: "supplier",
  regulation: "official",
  other: "other",
}[source.sourceType] as ResearchWhiteboardSource["kind"]);

const sourceStatus = (source: ResearchSource): ResearchWhiteboardSource["status"] =>
  source.accessStatus === "blocked" || source.accessStatus === "unavailable"
    ? "blocked"
    : source.evidenceStatus === "verified" ? "verified" : "candidate";

const moduleItem = (
  text: string,
  sourceIds: string[] = [],
  level: "fact" | "directional" | "hypothesis" | "unknown" = "directional",
) => ({ text, sourceIds, level });

export const buildWhiteboardReportModules = (
  analysis: LiveResearchAnalysis,
  claims: ResearchClaim[],
  now = new Date(),
): ResearchWhiteboardReportModule[] => {
  const at = now.toISOString();
  const translation = analysis.marketingTranslation;
  const claimSourceIds = (category: ResearchClaim["category"]) => [...new Set(
    claims.filter((claim) => claim.category === category).map((claim) => claim.sourceId),
  )];
  const unknowns = analysis.unknowns;
  return [
    {
      code: "market", title: "市场与机会", question: "有没有市场、需求趋势、价格空间、竞争强度。",
      conclusion: reportTextZh(analysis.marketOpportunity.verdict),
      items: [
        moduleItem(`需求：${reportTextZh(analysis.marketOpportunity.demand.rationale)}`, analysis.marketOpportunity.demand.sourceIds, "fact"),
        moduleItem(`竞争：${reportTextZh(analysis.marketOpportunity.competition.rationale)}`, analysis.marketOpportunity.competition.sourceIds, "fact"),
        moduleItem(`趋势：${reportTextZh(analysis.marketOpportunity.trend.rationale)}`, analysis.marketOpportunity.trend.sourceIds),
        moduleItem(`价格与变现：${reportTextZh(analysis.marketOpportunity.monetization.rationale)}`, analysis.marketOpportunity.monetization.sourceIds),
      ],
      unknowns: unknowns.filter((item) => /market|trend|growth|price|cost|margin|市场|趋势|成本|利润/i.test(item)).map(reportTextZh), updatedAt: at,
    },
    {
      code: "customer", title: "用户画像", question: "谁在买、什么场景触发、最焦虑什么、为什么下单。",
      conclusion: `${reportTextZh(analysis.competitorInsight.targetAudience)} 核心购买动机是${reportTextZh(analysis.customerInsight.functionalMotives[0] ?? "解决明确使用问题")}。`,
      items: [
        ...analysis.customerInsight.painPoints.map((item) => moduleItem(`焦虑：${reportTextZh(item)}`, analysis.customerInsight.sourceIds, "fact")),
        ...analysis.customerInsight.functionalMotives.map((item) => moduleItem(`下单理由：${reportTextZh(item)}`, analysis.customerInsight.sourceIds, "directional")),
        ...analysis.customerInsight.emotionalMotives.map((item) => moduleItem(`情绪动机：${reportTextZh(item)}`, analysis.customerInsight.sourceIds, "directional")),
      ],
      unknowns: unknowns.filter((item) => /buyer|conversion|purchase|user|用户|购买|转化/i.test(item)).map(reportTextZh), updatedAt: at,
    },
    {
      code: "competitor", title: "竞品分析", question: "谁在卖、靠什么吸引点击、靠什么建立信任、靠什么成交。",
      conclusion: analysis.competitorInsight.whyItSells.map(reportTextZh).join("；"),
      items: [
        moduleItem(`点击钩子：${reportTextZh(analysis.competitorInsight.homepageMessaging)}`, analysis.competitorInsight.sourceIds, "fact"),
        moduleItem(`信任机制：${reportTextZh(analysis.competitorInsight.socialProof)}`, analysis.competitorInsight.sourceIds, "fact"),
        moduleItem(`成交方式：${reportTextZh(analysis.competitorInsight.cta)}；${reportTextZh(analysis.competitorInsight.bundleStrategy)}`, analysis.competitorInsight.sourceIds, "fact"),
        moduleItem(`价格结构：${reportTextZh(analysis.competitorInsight.pricePositioning)}`, analysis.competitorInsight.sourceIds, "fact"),
      ],
      unknowns: unknowns.filter((item) => /competitor|brand|sku|model|竞品|品牌|型号/i.test(item)).map(reportTextZh), updatedAt: at,
    },
    {
      code: "product", title: "产品方案", question: "应该做成什么样、必要产品要求、寻源关键词、不能踩的坑。",
      conclusion: `${reportTextZh(analysis.positioning.coreSellingPoint)} 当前建议：${analysis.productDecision.status === "PROCEED_TO_SAMPLE" ? "进入受控寻源与买样" : analysis.productDecision.status === "HOLD_SUPPLY" ? "继续补证后再寻源" : "暂不继续"}。`,
      items: [
        moduleItem(`目标用户：${reportTextZh(analysis.positioning.targetCustomer)}`, analysis.productDecision.sourceIds, "directional"),
        ...analysis.positioning.differentiation.map((item) => moduleItem(`产品要求：${reportTextZh(item)}`, analysis.productDecision.sourceIds, "hypothesis")),
        moduleItem(`寻源起点：${reportTextZh(analysis.competitorInsight.skuSummary)}`, claimSourceIds("supplier"), "directional"),
      ],
      unknowns: unknowns.filter((item) => /supplier|sku|model|material|moq|quote|供应|型号|材料|报价/i.test(item)).map(reportTextZh), updatedAt: at,
    },
    {
      code: "marketing", title: "营销打法", question: "核心价值主张、广告钩子、内容素材、可说与不可说。",
      conclusion: reportTextZh(translation?.valueProposition ?? analysis.positioning.coreSellingPoint),
      items: [
        ...(translation?.messagePillars ?? []).map((item) => moduleItem(`可测试表达：${item.marketingCopy}`, item.supportingClaimIds, item.evidenceStatus === "supported" ? "fact" : item.evidenceStatus === "hypothesis" ? "hypothesis" : "directional")),
        ...(translation?.prohibitedClaims ?? []).map((item) => moduleItem(`不可说：${item.claim}。${item.reason}`, [], "unknown")),
      ],
      unknowns: (translation?.usageBoundaries ?? [analysis.actionBoundary.reason]).map(reportTextZh), updatedAt: at,
    },
    {
      code: "validation", title: "验证方案", question: "买什么样品、测试什么、成本红线、通过和停止条件。",
      conclusion: reportTextZh(analysis.actionBoundary.reason),
      items: [
        ...analysis.productDecision.rationale.map((item) => moduleItem(reportTextZh(item), analysis.productDecision.sourceIds, "directional")),
        ...(translation?.validationExperiments ?? []).map((item) => moduleItem(`${item.name}：通过 ${item.passThreshold}；停止 ${item.stopCondition}`, [], "hypothesis")),
      ],
      unknowns: unknowns.map(reportTextZh), updatedAt: at,
    },
  ];
};

export const syncWhiteboardFromResearch = async (
  discoveryId: string,
  evidencePackage: EvidencePackage,
  claims: ResearchClaim[],
  analysis: LiveResearchAnalysis,
  now = new Date(),
): Promise<ResearchWhiteboard> => {
  const current = await readResearchWhiteboard(discoveryId);
  const at = now.toISOString();
  const queriesPath = path.join(evidencePackage.packagePath, "search_log.json");
  const queryCount = await access(queriesPath).then(async () => {
    const parsed = JSON.parse(await readFile(queriesPath, "utf8")) as { queries?: unknown[] };
    return parsed.queries?.length ?? 0;
  }).catch(() => 0);
  const groups: Record<"market" | "customer" | "competitor" | "supply" | "compliance", ResearchSource[]> = {
    market: evidencePackage.sources.filter((source) => source.sourceType === "market"),
    customer: evidencePackage.sources.filter((source) => source.id.includes("VOC") || claims.some((claim) => claim.category === "customer" && claim.sourceId === source.id)),
    competitor: evidencePackage.sources.filter((source) => source.sourceType === "competitor"),
    supply: evidencePackage.sources.filter((source) => source.sourceType === "supplier"),
    compliance: evidencePackage.sources.filter((source) => source.sourceType === "regulation"),
  };
  const stages = { ...current.stages };
  for (const [code, sources] of Object.entries(groups) as Array<[keyof typeof groups, ResearchSource[]]>) {
    stages[code] = {
      ...stages[code], status: "complete", queryCount, sourceCount: sources.length,
      recordCount: claims.filter((claim) => sources.some((source) => source.id === claim.sourceId)).length,
      summary: `本轮保留 ${sources.length} 个来源，并形成 ${claims.filter((claim) => sources.some((source) => source.id === claim.sourceId)).length} 条可追溯判断。`,
      sources: sources.map((source) => ({ id: source.id, label: source.title, url: source.url, kind: sourceKind(source), status: sourceStatus(source) })), updatedAt: at,
    };
  }
  const reportModules = buildWhiteboardReportModules(analysis, claims, now);
  stages.synthesis = { ...stages.synthesis, status: "complete", sourceCount: evidencePackage.sources.length, recordCount: claims.length, summary: "已把市场、用户、竞品、供应与合规证据整理为六大选品结论。", updatedAt: at };
  for (const reportModule of reportModules) {
    const code = `${reportModule.code}_report` as ResearchWhiteboardStageCode;
    stages[code] = { ...stages[code], status: "complete", sourceCount: new Set(reportModule.items.flatMap((item) => item.sourceIds)).size, recordCount: reportModule.items.length, summary: reportModule.conclusion, updatedAt: at };
  }
  stages.execution = { ...stages.execution, status: "complete", summary: "后续新增评论、价格、API 数据、供应商回复或样品结果时，以新证据批次回流并生成新版本。", updatedAt: at };
  const next = researchWhiteboardSchema.parse({
    ...current, researchRunId: evidencePackage.manifest.researchRunId, status: "completed", updatedAt: at, stages, reportModules,
    activity: [...current.activity, { id: `report-${now.getTime()}`, at, stage: "execution", status: "complete", message: "六大模块白板报告已生成，所有结论保留来源与缺口。" }].slice(-60),
  });
  await writeFile(researchWhiteboardPath(discoveryId), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
};
