import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { readFirstPrinciplesBundle, researchPackagePath } from "../first-principles/service";
import { prisma } from "../infrastructure/prisma";
import { buildPreSampleDecisionBrief, localizeVocTheme, readDemandFieldArtifact, sumBudgetCaps } from "../pre-sample/service";
import { readVocEvidence } from "./voc-evidence";
import { demandFieldTextZh, demandRelationshipZh, demandStatusZh } from "../demand-field/presentation";
import {
  consumerDecisionStagePresentation,
  consumerPsychologyEvidenceStatusLabel,
  consumerPsychologyMechanismLabel,
  consumerPsychologyScopeLabel,
} from "../consumer-psychology/presentation";
import { readConsumerDecisionChain } from "../consumer-psychology/service";
import { readConclusionGovernance } from "../conclusion-governance/service";
import type { ConclusionGovernanceArtifact } from "../conclusion-governance/types";
import { buildCommercialViabilityCard } from "../commercial-viability/service";
import { buildPriceMarketStructure } from "../market-structure/service";
import { buildEstimatedUnitEconomicsModel } from "../estimated-unit-economics/service";
import { buildSecondCategoryValidation } from "../cross-category-validation/service";
import { buildOpportunityValidationRoadmap } from "../opportunity-validation/builder";
import { buildUnifiedActionQueue } from "../action-priority/builder";
import { buildInitialValidationExecutionLedger } from "../validation-execution/builder";
import { readValidationExecutionLedger } from "../validation-execution/service";
import { sourceTitleZh, statusZh } from "../presentation/zh";
import { readEvidencePackage } from "../research/evidence-package";
import { readLiveResearchArtifacts } from "../research/live-research";
import { readSearchLog } from "../research/search-log";
import { parsePriceAnchor, parsePriceRange } from "./price-anchors";
import { visualShapingOpportunityFor } from "./visual-shaping-opportunity";
import { competitorBenchmarkAuditRunId, competitorBenchmarksFor } from "./competitor-benchmarks";
import type { FirstPrinciplesBundle } from "../first-principles/types";
import type { SearchLogView } from "../research/search-log";
import {
  reportChapters,
  type CompetitorStanceRow,
  type ReportBuildPlan,
  type ReportConsumerPsychology,
  type ReportConclusionGovernance,
  type ReportGovernedConclusion,
  type ReportDemandField,
  type RunReport,
} from "./types";

const buildConclusionGovernance = (
  artifact: ConclusionGovernanceArtifact | null,
): ReportConclusionGovernance | null => {
  if (!artifact) return null;

  const current = artifact.conclusions.filter((item) => item.status === "current");
  const byId = new Map(artifact.conclusions.map((item) => [item.id, item]));
  const currentByTopic: ReportConclusionGovernance["currentByTopic"] = {};
  const reportConclusionById = new Map<string, ReportGovernedConclusion>();
  for (const conclusion of current) {
    const reportConclusion = {
      id: conclusion.id,
      topic: conclusion.topic,
      subjectLabel: conclusion.subject.label,
      statement: conclusion.statement,
      evidenceStatus: conclusion.evidence_status,
      sourceRunId: conclusion.source_run_id,
      sourceType: conclusion.source_type,
      effectiveAt: conclusion.effective_at,
      rationale: conclusion.rationale,
      claimBoundary: conclusion.claim_boundary,
      chapterIds: conclusion.chapter_ids,
    };
    currentByTopic[conclusion.topic] = [
      ...(currentByTopic[conclusion.topic] ?? []),
      reportConclusion,
    ];
    reportConclusionById.set(conclusion.id, reportConclusion);
  }

  const currentByChapter: ReportConclusionGovernance["currentByChapter"] = {};
  for (const binding of artifact.chapter_bindings) {
    const chapter = currentByChapter[binding.chapter_id] ?? {};
    chapter[binding.topic] = binding.conclusion_ids.flatMap((id) => {
      const conclusion = reportConclusionById.get(id);
      return conclusion ? [conclusion] : [];
    });
    currentByChapter[binding.chapter_id] = chapter;
  }

  return {
    currentByTopic,
    currentByChapter,
    overrides: current
      .filter((item) => ["supersedes", "refines"].includes(item.relation))
      .map((item) => ({
        currentId: item.id,
        topic: item.topic,
        currentStatement: item.statement,
        rationale: item.rationale,
        previous: item.previous_conclusion_ids.map((id) => ({
          id,
          statement: byId.get(id)?.statement ?? id,
        })),
      })),
    currentCount: current.length,
    topicCount: new Set(current.map((item) => item.topic)).size,
    supersededCount: artifact.conclusions.filter((item) => item.status === "superseded").length,
    boundChapterCount: new Set(artifact.chapter_bindings.map((item) => item.chapter_id)).size,
    conflictCount: 0,
    overallBoundary: artifact.overall_boundary,
  };
};

/**
 * Dimensions where a competitor observation and our own requirement can be
 * read against each other.
 *
 * Matched by keyword rather than array position: the brief's wording differs
 * per category, and a row that finds nothing on either side is dropped instead
 * of being padded with a placeholder.
 */
const stanceDimensions: ReadonlyArray<{
  dimension: string;
  competitor: (insight: LiveCompetitorInsight) => string | undefined;
  ours: RegExp;
}> = [
  {
    dimension: "材料与接触安全",
    competitor: (insight) => insight.materials,
    ours: /面料|材质|克重/,
  },
  {
    dimension: "结构与核心功能",
    competitor: (insight) => insight.sellingPoints.find((point) => /lift|smooth|scrunch|sculpt/i.test(point)),
    ours: /塑形|提臀|中缝|结构/,
  },
  {
    dimension: "关键性能与耐用性",
    competitor: (insight) => insight.sellingPoints.find((point) => /opacity|squat/i.test(point)),
    ours: /不透|洗涤|回弹/,
  },
  {
    dimension: "尺寸与适配边界",
    competitor: (insight) => insight.sizeSystem,
    ours: /尺码|体型|测量/,
  },
  {
    dimension: "首轮产品范围",
    competitor: (insight) => insight.skuSummary,
    ours: /扩展|首轮|款式/,
  },
];

type LiveCompetitorInsight = Awaited<ReturnType<typeof readLiveResearchArtifacts>>["analysis"]["competitorInsight"];

const buildCompetitorStance = (
  insight: LiveCompetitorInsight,
  requirements: readonly string[],
): CompetitorStanceRow[] =>
  stanceDimensions
    .map((spec) => ({
      dimension: spec.dimension,
      competitor: spec.competitor(insight) ?? "",
      ours: requirements.filter((requirement) => spec.ours.test(requirement)),
    }))
    .filter((row) => row.competitor !== "" && row.ours.length > 0);

const buildDemandField = (
  artifact: Awaited<ReturnType<typeof readDemandFieldArtifact>>,
): ReportDemandField | null => {
  if (!artifact) return null;

  return {
    audienceLabels: artifact.audience_clusters.map((cluster) => demandFieldTextZh(cluster.label)),
    taskChain: [...artifact.task_chain]
      .sort((a, b) => a.sequence - b.sequence)
      .map((step) => ({
        sequence: step.sequence,
        label: demandFieldTextZh(step.label),
        stageLabel: demandStatusZh(step.relative_to_current_product),
      })),
    opportunities: artifact.adjacent_opportunities.map((opportunity) => ({
      id: opportunity.id,
      title: demandFieldTextZh(opportunity.title),
      category: demandFieldTextZh(opportunity.candidate_category),
      relationshipTypes: opportunity.relationship_types,
      relationships: opportunity.relationship_types.map(demandRelationshipZh),
      relationshipStrength: opportunity.relationship_strength,
      strengthLabel: demandStatusZh(opportunity.relationship_strength),
      evidenceStatus: opportunity.evidence_status,
      evidenceStatusLabel: demandStatusZh(opportunity.evidence_status),
      status: opportunity.status,
      statusLabel: demandStatusZh(opportunity.status),
      directProductEvidence: opportunity.direct_product_evidence,
      supportCount: opportunity.supporting_observation_ids.length,
      counterevidenceCount: opportunity.counterevidence_observation_ids.length,
      rationale: demandFieldTextZh(opportunity.rationale),
      whyNotApproved: demandFieldTextZh(opportunity.why_not_approved),
      nextResearchQueries: opportunity.next_research_queries,
      validationQuestions: opportunity.validation_questions.map(demandFieldTextZh),
    })),
    currentDecisionUnchanged: artifact.decision_boundary.current_product_decision_unchanged,
    opportunitiesNotApproved: artifact.decision_boundary.adjacent_opportunities_not_approved,
    newRunRequired: artifact.decision_boundary.new_research_run_required,
  };
};

const buildConsumerPsychology = (
  artifact: Awaited<ReturnType<typeof readConsumerDecisionChain>>,
): ReportConsumerPsychology | null => {
  if (!artifact) return null;

  return {
    stages: artifact.stages.map((stage) => {
      const presentation = consumerDecisionStagePresentation[stage.stage];
      return {
        id: stage.id,
        stage: stage.stage,
        label: presentation.label,
        shortLabel: presentation.shortLabel,
        question: presentation.question,
        mechanismLabel: consumerPsychologyMechanismLabel[stage.mechanism],
        scopeLabel: consumerPsychologyScopeLabel[stage.scope],
        evidenceStatus: stage.evidence_status,
        evidenceStatusLabel: consumerPsychologyEvidenceStatusLabel[stage.evidence_status],
        conclusion: stage.conclusion,
        supportCount:
          stage.supporting_observation_ids.length
          + stage.supporting_claim_ids.length
          + stage.supporting_demand_atom_ids.length,
        counterevidenceCount:
          stage.counterevidence_observation_ids.length
          + stage.counterevidence_claim_ids.length,
        unknowns: stage.unknowns,
        validationNeeded: stage.validation_needed,
        claimBoundary: stage.claim_boundary,
      };
    }),
    overallBoundary: artifact.overall_boundary,
    currentDecisionUnchanged: artifact.decision_boundary.current_product_decision_unchanged,
    targetSkuPerformanceNotProven: artifact.decision_boundary.target_sku_performance_not_proven,
    marketingRemainsDraft: artifact.decision_boundary.marketing_remains_draft_for_validation,
    noAutomaticApproval: artifact.decision_boundary.no_automatic_listing_or_ad_approval,
  };
};

const supplyCategoryLabels: Record<string, string> = {
  material: "面料与材料",
  structure: "结构与版型",
  feature: "功能配置",
  content_asset: "内容与证明资产",
  service: "服务与政策",
  supplier_capability: "供应商能力",
};

const customizationLabels: Record<string, string> = {
  existing: "现有款可用",
  light_customization: "轻定制",
  deep_customization: "深度定制",
};

const costVisibilityLabels: Record<string, string> = {
  clear: "清晰",
  partial: "部分可见",
  unknown: "未知",
};

const buildTrendAcquisition = (
  searchLog: SearchLogView,
  product: string,
  market: string,
): RunReport["marketChapter"]["trendAcquisition"] => {
  const attempt = searchLog.queries.find((query) => /google trends/i.test(query.surface));
  if (!attempt) return null;

  const queryTerms = attempt.query
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
  const params = new URLSearchParams({
    date: "today 5-y",
    geo: market.toUpperCase(),
    q: (queryTerms.length > 0 ? queryTerms : [product]).join(","),
  });

  return {
    query: attempt.query,
    outcome: attempt.outcome,
    executedAt: attempt.executedAt ?? null,
    note: attempt.note ?? null,
    url: `https://trends.google.com/trends/explore?${params.toString()}`,
  };
};

const buildPriceStructureOffers = (
  anchors: RunReport["priceAnchors"],
  runId: string,
) => [
  ...anchors.map((anchor) => ({
    id: `claim-price:${anchor.claimId}`,
    label: anchor.label,
    currentPrice: anchor.current,
    listPrice: anchor.original,
    currencySymbol: anchor.currencySymbol,
    url: anchor.url,
    claimId: anchor.claimId,
    sourceId: anchor.sourceId,
    sourceType: "current_run_claim" as const,
  })),
  ...competitorBenchmarksFor(runId).map((benchmark, index) => ({
    id: `benchmark-price:${String(index + 1).padStart(2, "0")}`,
    label: benchmark.label,
    currentPrice: benchmark.current,
    listPrice: benchmark.original,
    currencySymbol: benchmark.currencySymbol,
    url: benchmark.url,
    claimId: null,
    sourceId: `audit-run:${competitorBenchmarkAuditRunId}`,
    sourceType: "curated_benchmark" as const,
  })),
];

/**
 * Turns first-principles supply atoms into the build-side view.
 *
 * The three totals answer the seller's first cost questions: does anything need
 * deep customization, is any cost actually known, and has any of it been
 * verified on a real sample.
 */
const buildBuildPlan = (
  supplyAtoms: FirstPrinciplesBundle["supply_atoms"],
): ReportBuildPlan | null => {
  if (supplyAtoms.length === 0) return null;

  const atoms = supplyAtoms.map((atom) => ({
    id: atom.id,
    categoryLabel: supplyCategoryLabels[atom.category] ?? atom.category,
    name: atom.name,
    description: atom.description,
    customizationLabel: customizationLabels[atom.customization_level] ?? atom.customization_level,
    costVisibilityLabel: costVisibilityLabels[atom.cost_visibility] ?? atom.cost_visibility,
    independentlySourceable: atom.independently_sourceable,
    targetSkuVerified: atom.target_sku_verified,
  }));

  const order = Object.keys(supplyCategoryLabels);
  const categories = [...new Set(atoms.map((atom) => atom.categoryLabel))]
    .sort((a, b) => {
      const rank = (label: string) => {
        const key = order.find((item) => supplyCategoryLabels[item] === label);
        return key ? order.indexOf(key) : order.length;
      };
      return rank(a) - rank(b);
    })
    .map((label) => ({ label, atoms: atoms.filter((atom) => atom.categoryLabel === label) }));

  return {
    atoms,
    categories,
    totals: {
      total: atoms.length,
      deepCustomization: supplyAtoms.filter((atom) => atom.customization_level === "deep_customization").length,
      costKnown: supplyAtoms.filter((atom) => atom.cost_visibility === "clear").length,
      targetVerified: supplyAtoms.filter((atom) => atom.target_sku_verified).length,
      independentlySourceable: supplyAtoms.filter((atom) => atom.independently_sourceable).length,
    },
  };
};

const stageLabels: Record<string, string> = {
  initializing: "初始化",
  searching_web: "联网研究",
  collecting_evidence: "整理证据",
  analyzing_market: "分析市场",
  generating_decision: "生成决策",
  completed: "已完成",
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const isResearchRunId = (runId: string): boolean => /^[a-z0-9_-]+$/i.test(runId);

type ReportCompositionFile = {
  schema_version: "report-composition.v1";
  primary_run_id: string;
  audit_run_id: string;
  primary_label: string;
  audit_label: string;
  boundary: string;
};

const readReportComposition = async (runId: string): Promise<ReportCompositionFile | null> => {
  const filePath = path.join(process.cwd(), "config", "report-compositions", `${runId}.json`);
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as ReportCompositionFile;
    if (
      parsed.schema_version !== "report-composition.v1"
      || !isResearchRunId(parsed.primary_run_id)
      || !isResearchRunId(parsed.audit_run_id)
      || !parsed.primary_label
      || !parsed.audit_label
      || !parsed.boundary
    ) {
      throw new Error(`Invalid report composition: ${filePath}`);
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

/**
 * Aggregates every artifact a completed research run produces into the single
 * eight-chapter storyline. Pure aggregation: when a source is missing a value
 * the report says so rather than substituting a default.
 */
const buildSingleRunReport = async (runId: string, includePersistedExecution = true): Promise<RunReport> => {
  if (!isResearchRunId(runId)) throw new Error("Invalid research run id");
  const packagePath = researchPackagePath(runId);

  const [bundle, brief, artifacts, evidencePackage, demandFieldArtifact, consumerPsychologyArtifact, vocEvidence, searchLog] = await Promise.all([
    readFirstPrinciplesBundle(runId),
    buildPreSampleDecisionBrief(runId),
    readLiveResearchArtifacts(packagePath),
    readEvidencePackage(packagePath),
    readDemandFieldArtifact(runId),
    readConsumerDecisionChain(runId),
    readVocEvidence(runId, localizeVocTheme),
    readSearchLog(packagePath),
  ]);

  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: { riskModules: true, economicsScenarios: true },
  });

  const { analysis } = artifacts;
  const decisionSummary = bundle.decision_summary;
  const recommended = bundle.opportunity_hypotheses.find(
    (item) => item.id === bundle.recommended_opportunity_id,
  );

  const budget = sumBudgetCaps(bundle.validation_plan.map((experiment) => experiment.budget_cap));
  const briefRendered = brief.validationSteps.length > 0;
  const sourceTitleById = new Map(evidencePackage.sources.map((source) => [source.url, source.title]));
  const commercialViability = buildCommercialViabilityCard({
    bundle,
    economicsScenarioCount: run?.economicsScenarios.length ?? 0,
  });
  const priceAnchors = artifacts.claims
    .map((claim) => {
      const source = evidencePackage.sources.find((item) => item.id === claim.sourceId);
      return parsePriceAnchor(claim, source ? sourceTitleZh(source.title) : claim.sourceId, source?.url ?? null);
    })
    .filter((anchor): anchor is NonNullable<typeof anchor> => anchor !== null);
  const priceRange = parsePriceRange(analysis.positioning.recommendedPriceRange);
  const priceMarketStructure = buildPriceMarketStructure({
    runId,
    product: bundle.product,
    market: bundle.market,
    generatedAt: brief.generatedAt,
    offers: buildPriceStructureOffers(priceAnchors, runId),
    recommendedRange: priceRange,
  });
  const costCoverageScenario = run?.economicsScenarios.find((scenario) => scenario.quantity === 1)
    ?? run?.economicsScenarios[0]
    ?? null;
  const moneyNumber = (value: { toString(): string } | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  };
  const estimatedUnitEconomics = buildEstimatedUnitEconomicsModel({
    runId,
    generatedAt: brief.generatedAt,
    priceRange,
    formalScenarioCount: run?.economicsScenarios.length ?? 0,
    costCoverage: costCoverageScenario ? {
      supplierCost: moneyNumber(costCoverageScenario.supplierCost),
      packagingCost: moneyNumber(costCoverageScenario.packagingCost),
      domesticShipping: moneyNumber(costCoverageScenario.domesticShipping),
      internationalShipping: moneyNumber(costCoverageScenario.internationalShipping),
      unlistedDutyAndClearance: moneyNumber(costCoverageScenario.unlistedDutyAndClearance),
      paymentFee: moneyNumber(costCoverageScenario.paymentFee),
      refundReserve: moneyNumber(costCoverageScenario.refundReserve),
      chargebackReserve: moneyNumber(costCoverageScenario.chargebackReserve),
      defectAndReshipCost: moneyNumber(costCoverageScenario.defectAndReshipCost),
      otherVariableCost: moneyNumber(costCoverageScenario.otherVariableCost),
    } : null,
  });
  const buildPlan = buildBuildPlan(bundle.supply_atoms);
  const demandField = buildDemandField(demandFieldArtifact);
  const opportunityValidationRoadmap = buildOpportunityValidationRoadmap({
    runId,
    generatedAt: brief.generatedAt,
    demandField,
  });
  const unifiedActionQueue = buildUnifiedActionQueue({
    runId,
    generatedAt: brief.generatedAt,
    validationSteps: brief.validationSteps,
    opportunityRoadmap: opportunityValidationRoadmap,
    visualShapingOpportunity: visualShapingOpportunityFor(runId),
  });
  const baselineValidationExecutionLedger = buildInitialValidationExecutionLedger({
    runId,
    generatedAt: brief.generatedAt,
    actionQueue: unifiedActionQueue,
    validationSteps: brief.validationSteps,
    conclusionGovernance: null,
  });
  const validationExecutionLedger = includePersistedExecution
    ? await readValidationExecutionLedger(runId, baselineValidationExecutionLedger)
    : baselineValidationExecutionLedger;
  const consumerPsychology = buildConsumerPsychology(consumerPsychologyArtifact);
  const secondCategoryValidation = buildSecondCategoryValidation({
    runId,
    generatedAt: brief.generatedAt,
    product: bundle.product,
    listingAllowed: decisionSummary.listing_allowed,
    adTestAllowed: decisionSummary.ad_test_allowed,
    capabilities: {
      summary: true,
      commercialViability: commercialViability !== null,
      voiceOfCustomer: vocEvidence.observationCount > 0,
      buildPlan: buildPlan !== null,
      validationPlan: bundle.validation_plan.length > 0,
      actionBoundary: Object.values(brief.decisionBoundaries).every((value) => value.trim().length > 0),
      consumerPsychology: consumerPsychology !== null,
      priceMarketStructure: priceMarketStructure !== null,
      estimatedUnitEconomics: estimatedUnitEconomics !== null,
      conclusionGovernance: false,
      marketingDecisionChain: (brief.marketingTranslation?.decisionChain?.mappings.length ?? 0) > 0,
    },
    textCorpus: [
      bundle.product,
      brief.recommendation.title,
      brief.recommendation.coreValue,
      brief.recommendation.targetCustomer,
      brief.recommendation.targetScenario,
      brief.recommendation.productConcept,
      ...brief.whyContinue.users,
      ...brief.whyContinue.scenarios,
      ...brief.whyContinue.painPoints,
      ...brief.mustHave,
      ...brief.validationSteps.flatMap((step) => [step.name, step.method, step.pass, step.fail]),
      ...analysis.competitorInsight.sellingPoints,
      ...analysis.customerInsight.painPoints,
    ],
  });

  return {
    runId,
    product: bundle.product,
    market: bundle.market,
    generatedAt: brief.generatedAt,
    chapters: reportChapters(),
    evidenceLineage: null,

    summary: {
      decisions: {
        // The bundle states this in English; the localized brief is the
        // seller-facing wording of the same recommendation.
        firstPrinciplesRecommendation: `${brief.recommendation.title}：${brief.recommendation.whyFirst}`,
        productSelection: {
          value: decisionSummary.product_selection_decision,
          label: statusZh(decisionSummary.product_selection_decision),
        },
        formalSku: {
          value: decisionSummary.formal_sku_decision,
          label: statusZh(decisionSummary.formal_sku_decision),
        },
      },
      conclusion: brief.conclusion,
      scopeNotice: brief.scopeNotice,
      marketOverallScore: analysis.marketOpportunity.overall,
      marketVerdict: analysis.marketOpportunity.verdict,
      recommendedDirection: recommended ? brief.recommendation.title : null,
      nextStepCost: {
        experimentCount: bundle.validation_plan.length,
        totalDurationDays: bundle.validation_plan.reduce((sum, item) => sum + item.duration_days, 0),
        budgetCurrency: budget.currency,
        budgetAmount: budget.amount,
        budgetLabel: brief.estimatedValidationBudget.label,
      },
      criticalUnknowns: brief.whyContinue.majorUnknowns.slice(0, 3),
      listingAllowed: decisionSummary.listing_allowed,
      adTestAllowed: decisionSummary.ad_test_allowed,
    },
    commercialViability,

    marketChapter: {
      scores: [
        { label: "需求强度", ...analysis.marketOpportunity.demand },
        { label: "竞争程度", ...analysis.marketOpportunity.competition },
        { label: "趋势表现", ...analysis.marketOpportunity.trend },
        { label: "变现潜力", ...analysis.marketOpportunity.monetization },
      ],
      overall: analysis.marketOpportunity.overall,
      verdict: analysis.marketOpportunity.verdict,
      trendAcquisition: buildTrendAcquisition(searchLog, bundle.product, bundle.market),
    },
    priceMarketStructure,
    estimatedUnitEconomics,
    secondCategoryValidation,

    narrative: brief.whyContinue,
    recommendation: brief.recommendation,
    competitors: analysis.competitorInsight,
    // Our own requirements come from the localized brief, so the reader side of
    // the table stays in Chinese while the competitor side stays verbatim.
    competitorStance: buildCompetitorStance(analysis.competitorInsight, [
      ...brief.mustHave,
      ...brief.mustNotHave.productScope,
    ]),
    priceAnchors,
    priceRange,
    priceRangeText: analysis.positioning.recommendedPriceRange,
    customers: analysis.customerInsight,
    voice: brief.voiceOfCustomer,
    voicePlatformCounts: vocEvidence.platformCounts,
    sentimentSplit: vocEvidence.sentimentSplit,
    counterevidence: vocEvidence.counterevidence,
    positiveEvidenceCount: vocEvidence.positiveEvidenceCount,
    missingObservationDates: vocEvidence.missingObservationDates,
    observationDateCoverage: {
      total: vocEvidence.observationCount,
      dated: vocEvidence.datedObservationCount,
    },

    positioning: analysis.positioning,
    opportunities: [...bundle.opportunity_hypotheses].sort((a, b) => b.score - a.score),
    recommendedOpportunityId: bundle.recommended_opportunity_id,
    recommendationRationale: bundle.recommendation_rationale,
    alternativesNotRecommended: bundle.alternatives_not_recommended,
    mustHave: brief.mustHave,
    buildPlan,
    demandField,
    consumerPsychology,
    conclusionGovernance: null,
    opportunityValidationRoadmap,
    unifiedActionQueue,
    validationExecutionLedger,

    validationPlan: bundle.validation_plan,
    validationSteps: brief.validationSteps,
    validationBudget: brief.estimatedValidationBudget,
    stopConditionGroups: brief.stopConditionGroups,
    supplierHandoff: brief.supplierHandoff,
    supplierInquiryGroups: brief.supplierInquiryGroups,

    marketing: brief.marketingTranslation,
    prohibitedMarketingClaims: brief.mustNotHave.marketingClaims,
    mustNotHave: brief.mustNotHave,

    boundaries: brief.decisionBoundaries,
    entryConditions: decisionSummary.entry_conditions,
    boundaryRationale: decisionSummary.boundary_rationale,
    nextStageRequirements: brief.nextStageRequirements,

    appendix: {
      evidence: {
        sourceCount: brief.evidenceTrust.sourceCount,
        verifiedCount: brief.evidenceTrust.verifiedCount,
        needsReviewCount: brief.evidenceTrust.needsReviewCount,
        unresolvedCount: brief.evidenceTrust.unresolvedCount,
        verifiedExplanation: brief.evidenceTrust.verifiedExplanation,
        needsReviewExplanation: brief.evidenceTrust.needsReviewExplanation,
        sources: brief.evidenceTrust.sources.map((source) => ({
          title: source.title,
          // The external record stays in its original language; the localized
          // label above is only a reading aid.
          originalTitle: sourceTitleById.get(source.url) ?? source.title,
          url: source.url,
          status: source.status,
          statusLabel: source.statusLabel,
        })),
      },
      unknowns: analysis.unknowns,
      timeline: artifacts.status.history.map((item) => ({
        stage: item.stage,
        label: stageLabels[item.stage] ?? item.stage,
        at: item.at,
        note: item.note,
      })),
      auditUrls: {
        research: `/research/${runId}`,
        firstPrinciples: `/research/${runId}/first-principles`,
        evidence: `/runs/${runId}/evidence`,
      },
      searchLog,
      riskModuleCount: run?.riskModules.length ?? 0,
      economicsScenarioCount: run?.economicsScenarios.length ?? 0,
      // The export endpoint renders the seller brief, which is the same
      // artifact this report was built from, so it is always available here.
      // Older runs without that artifact fall back to the analysis report file.
      exportHtmlAvailable:
        briefRendered || (await fileExists(path.join(packagePath, "reports", "analysis-report.html"))),
    },
  };
};

/**
 * A composed report keeps one run's full analysis intact while attaching a
 * newer run's audit trail. The two evidence populations remain separately
 * labelled; no historical observation is rewritten to claim newer provenance.
 */
export const buildRunReport = async (runId: string): Promise<RunReport> => {
  if (!isResearchRunId(runId)) throw new Error("Invalid research run id");
  const composition = await readReportComposition(runId);
  if (!composition) return buildSingleRunReport(runId);

  const [primary, audit] = await Promise.all([
    buildSingleRunReport(composition.primary_run_id, false),
    buildSingleRunReport(composition.audit_run_id, false),
  ]);
  if (primary.product !== audit.product || primary.market !== audit.market) {
    throw new Error("A composed report requires matching product and market");
  }
  const conclusionGovernanceArtifact = await readConclusionGovernance(runId, {
    product: primary.product,
    market: primary.market,
  });
  const composedPriceMarketStructure = buildPriceMarketStructure({
    runId,
    product: primary.product,
    market: primary.market,
    generatedAt: audit.generatedAt,
    offers: buildPriceStructureOffers(primary.priceAnchors, runId),
    recommendedRange: primary.priceRange,
  });
  const composedOpportunityValidationRoadmap = buildOpportunityValidationRoadmap({
    runId,
    generatedAt: audit.generatedAt,
    demandField: primary.demandField,
  });
  const composedUnifiedActionQueue = buildUnifiedActionQueue({
    runId,
    generatedAt: audit.generatedAt,
    validationSteps: primary.validationSteps,
    opportunityRoadmap: composedOpportunityValidationRoadmap,
    visualShapingOpportunity: visualShapingOpportunityFor(runId),
  });
  const composedBaselineValidationExecutionLedger = buildInitialValidationExecutionLedger({
    runId,
    generatedAt: audit.generatedAt,
    actionQueue: composedUnifiedActionQueue,
    validationSteps: primary.validationSteps,
    conclusionGovernance: conclusionGovernanceArtifact,
  });
  const composedValidationExecutionLedger = await readValidationExecutionLedger(
    runId,
    composedBaselineValidationExecutionLedger,
  );

  return {
    ...primary,
    runId,
    generatedAt: audit.generatedAt,
    evidenceLineage: {
      primary: {
        runId: composition.primary_run_id,
        label: composition.primary_label,
        researchSourceCount: primary.appendix.evidence.sourceCount,
        voiceSourceCount: primary.voice.sourceCount,
        observationCount: primary.voice.validObservations,
        platformCount: primary.voice.platformCount,
        datedObservationCount: primary.observationDateCoverage.dated,
      },
      audit: {
        runId: composition.audit_run_id,
        label: composition.audit_label,
        researchSourceCount: audit.appendix.evidence.sourceCount,
        voiceSourceCount: audit.voice.sourceCount,
        observationCount: audit.voice.validObservations,
        platformCount: audit.voice.platformCount,
        datedObservationCount: audit.observationDateCoverage.dated,
        searchQueryCount: audit.appendix.searchLog.totals.total,
        searchLogFidelity: audit.appendix.searchLog.fidelity,
        productSelectionDecision: audit.summary.decisions.productSelection.label,
        formalSkuDecision: audit.summary.decisions.formalSku.label,
        limitations: [...new Set([
          ...audit.voice.limitations,
          ...audit.summary.criticalUnknowns,
        ])],
      },
      boundary: composition.boundary,
    },
    summary: {
      ...primary.summary,
      decisions: audit.summary.decisions,
      conclusion: audit.summary.conclusion,
      scopeNotice: audit.summary.scopeNotice,
      listingAllowed: audit.summary.listingAllowed,
      adTestAllowed: audit.summary.adTestAllowed,
    },
    marketChapter: {
      ...primary.marketChapter,
      trendAcquisition: audit.marketChapter.trendAcquisition,
    },
    priceMarketStructure: composedPriceMarketStructure ?? primary.priceMarketStructure,
    estimatedUnitEconomics: primary.estimatedUnitEconomics,
    secondCategoryValidation: audit.secondCategoryValidation ?? primary.secondCategoryValidation,
    commercialViability: audit.commercialViability ?? primary.commercialViability,
    consumerPsychology: audit.consumerPsychology ?? primary.consumerPsychology,
    // Psychology and marketing must come from the same evidence generation.
    // Keeping the historical translation here would recreate the exact
    // cross-chapter conflict that the audit run is meant to supersede.
    marketing: audit.marketing ?? primary.marketing,
    prohibitedMarketingClaims: audit.prohibitedMarketingClaims,
    conclusionGovernance: buildConclusionGovernance(conclusionGovernanceArtifact),
    opportunityValidationRoadmap: composedOpportunityValidationRoadmap,
    unifiedActionQueue: composedUnifiedActionQueue,
    validationExecutionLedger: composedValidationExecutionLedger,
    boundaries: audit.boundaries,
    entryConditions: audit.entryConditions,
    boundaryRationale: audit.boundaryRationale,
    nextStageRequirements: audit.nextStageRequirements,
    appendix: {
      ...primary.appendix,
      searchLog: audit.appendix.searchLog,
    },
  };
};
