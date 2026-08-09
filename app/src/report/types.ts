import type { FirstPrinciplesBundle, OpportunityHypothesis, ValidationExperiment } from "../first-principles/types";
import type { PreSampleDecisionBrief } from "../pre-sample/types";
import type { LiveResearchAnalysis } from "../research/live-types";
import type { PriceAnchor, PriceRange } from "./price-anchors";
import type { SearchLogView } from "../research/search-log";
import type { ConclusionTopic } from "../conclusion-governance/types";
import type { CommercialViabilityCard } from "../commercial-viability/types";
import type { PriceMarketStructure } from "../market-structure/types";
import type { EstimatedUnitEconomicsModel } from "../estimated-unit-economics/types";
import type { SecondCategoryValidation } from "../cross-category-validation/types";
import type { OpportunityValidationRoadmap } from "../opportunity-validation/types";
import type { UnifiedActionQueue } from "../action-priority/types";
import type { ValidationExecutionLedger } from "../validation-execution/types";

/**
 * The report is one linear storyline: chapters 0-7 answer a seller's real
 * decision questions in order, and everything auditable lives in the appendix.
 *
 * Every field below is aggregated from artifacts that already exist on disk.
 * No chapter introduces a conclusion that its sources do not already state.
 */
export const reportChapterIds = [
  "summary",
  "market",
  "competitors",
  "customers",
  "positioning",
  "validation",
  "marketing",
  "boundary",
] as const;

export type ReportChapterId = (typeof reportChapterIds)[number];

export type ReportChapterMeta = {
  id: ReportChapterId;
  /** Chapter number as shown to the reader (0-7). */
  index: number;
  /** Short label for the sticky navigation. */
  label: string;
  /** The seller question this chapter answers. */
  question: string;
};

const chapterCopy: Record<ReportChapterId, { label: string; question: string }> = {
  summary: { label: "结论摘要", question: "结论是什么，下一步要花多少" },
  market: { label: "市场值不值得做", question: "这个市场有没有机会" },
  competitors: { label: "别人为什么能卖", question: "竞品凭什么卖得出去" },
  customers: { label: "用户到底在买什么", question: "用户为什么掏钱" },
  positioning: { label: "那我该做成什么样", question: "定位与机会方向" },
  validation: { label: "怎么用最小成本验证", question: "验证计划与预算" },
  marketing: { label: "能怎么宣传、不能怎么宣传", question: "营销表达与合规红线" },
  boundary: { label: "现在允许做什么", question: "当前的行动边界" },
};

/** Total lookup: every chapter id resolves, so callers never handle a miss. */
export const chapterFor = (id: ReportChapterId): ReportChapterMeta => ({
  id,
  index: reportChapterIds.indexOf(id),
  label: chapterCopy[id].label,
  question: chapterCopy[id].question,
});

export const reportChapters = (): ReportChapterMeta[] => reportChapterIds.map(chapterFor);

/**
 * Which chapter the sticky rail should highlight.
 *
 * Chapters differ hugely in height (374px to 2400px), which makes
 * "topmost intersecting section" flip to the wrong entry and never reach the
 * short trailing ones. Reading offsets directly is exact: the active chapter is
 * the last one whose top has passed the reading line.
 *
 * Pure so it can be tested without a browser.
 */
export const activeChapterAt = (
  offsets: ReadonlyArray<{ id: string; top: number }>,
  readingLine: number,
  atBottom: boolean,
): string | null => {
  if (offsets.length === 0) return null;
  // At the very bottom the last chapter may be too short to cross the line,
  // so pin it — otherwise it could never become active.
  if (atBottom) return offsets[offsets.length - 1].id;

  let current = offsets[0].id;
  for (const offset of offsets) {
    if (offset.top <= readingLine) current = offset.id;
  }
  return current;
};

export type ReportDecisionLayers = {
  /** Layer 1 - what first-principles reasoning recommends. */
  firstPrinciplesRecommendation: string;
  /** Layer 2 - whether this product direction is worth sampling. */
  productSelection: { value: string; label: string };
  /** Layer 3 - whether the formal SKU may be supplied. Never merged into layer 2. */
  formalSku: { value: string; label: string };
};

export type ReportNextStepCost = {
  experimentCount: number;
  totalDurationDays: number;
  budgetCurrency: string;
  /** Null when the underlying budget caps are not machine-summable. */
  budgetAmount: number | null;
  budgetLabel: string;
};

export type ReportSummary = {
  decisions: ReportDecisionLayers;
  /** One-sentence rationale, taken verbatim from the pre-sample brief. */
  conclusion: string;
  scopeNotice: string;
  marketOverallScore: number;
  marketVerdict: string;
  /** Title of the recommended opportunity, or null when none is recommended. */
  recommendedDirection: string | null;
  nextStepCost: ReportNextStepCost;
  /** At most three, taken from the brief's major unknowns. */
  criticalUnknowns: string[];
  listingAllowed: boolean;
  adTestAllowed: boolean;
};

export type ReportScore = {
  label: string;
  score: number;
  rationale: string;
  sourceIds: string[];
};

export type ReportMarket = {
  scores: ReportScore[];
  overall: number;
  verdict: string;
  /** Recorded Google Trends attempt plus an official retry URL when available. */
  trendAcquisition: {
    query: string;
    outcome: "yielded_sources" | "no_relevant_results" | "blocked" | "not_executed";
    executedAt: string | null;
    note: string | null;
    url: string;
  } | null;
};

export type ReportEvidenceSource = {
  /** Localized label for reading. */
  title: string;
  /** Original source title, preserved as an external record. */
  originalTitle: string;
  url: string;
  status: string;
  statusLabel: string;
};

export type ReportVoice = PreSampleDecisionBrief["voiceOfCustomer"];

/** Complaints and satisfaction for the same theme, so neither reads alone. */
export type ReportSentimentRow = {
  theme: string;
  negative: number;
  positive: number;
};

/**
 * A direct rebuttal, not merely a happy customer.
 *
 * The corpus separates `positive_evidence` from `counterevidence`; collapsing
 * the two into one "positive or counterevidence" count overstates how much of
 * the corpus actually argues against a pain point.
 */
export type ReportCounterevidence = {
  theme: string;
  paraphrase: string;
  quote: string;
  platform: string;
  url: string;
  pageTitle: string;
};

export type ReportVoicePlatformCount = { platform: string; count: number };

/**
 * One row of the competitor-versus-our-spec table.
 *
 * Deliberately no "aligned / different" verdict column: placing the two side by
 * side is presentation, judging them would be generating a conclusion the
 * artifacts never state.
 */
export type CompetitorStanceRow = {
  dimension: string;
  /** Competitor observation, kept verbatim — never translated. */
  competitor: string;
  /** Our own requirement for the same dimension, from the localized brief. */
  ours: string[];
};

/**
 * An adjacent opportunity found in the demand field.
 *
 * These are discovered, never approved: the demand field states
 * `adjacent_opportunities_not_approved` and requires its own Research Run, so
 * the report carries `whyNotApproved` beside every candidate.
 */
export type ReportAdjacentOpportunity = {
  id: string;
  title: string;
  category: string;
  relationshipTypes: string[];
  relationships: string[];
  relationshipStrength: "strong" | "moderate" | "weak" | "uncertain";
  strengthLabel: string;
  evidenceStatus: "supported" | "directional" | "hypothesis";
  evidenceStatusLabel: string;
  status: "RESEARCH_MORE" | "NOT_PRIORITIZED";
  statusLabel: string;
  /** False when the corpus never names the product, only the underlying job. */
  directProductEvidence: boolean;
  supportCount: number;
  counterevidenceCount: number;
  rationale: string;
  whyNotApproved: string;
  nextResearchQueries: string[];
  validationQuestions: string[];
};

export type ReportDemandField = {
  audienceLabels: string[];
  taskChain: Array<{ sequence: number; label: string; stageLabel: string }>;
  opportunities: ReportAdjacentOpportunity[];
  /** Mirrors the artifact's own boundary flags. */
  currentDecisionUnchanged: boolean;
  opportunitiesNotApproved: boolean;
  newRunRequired: boolean;
};

export type ReportConsumerPsychologyStage = {
  id: string;
  stage: string;
  label: string;
  shortLabel: string;
  question: string;
  mechanismLabel: string;
  scopeLabel: string;
  evidenceStatus: "supported" | "directional" | "hypothesis" | "prohibited";
  evidenceStatusLabel: string;
  conclusion: string;
  supportCount: number;
  counterevidenceCount: number;
  unknowns: string[];
  validationNeeded: string[];
  claimBoundary: string;
};

export type ReportConsumerPsychology = {
  stages: ReportConsumerPsychologyStage[];
  overallBoundary: string;
  currentDecisionUnchanged: boolean;
  targetSkuPerformanceNotProven: boolean;
  marketingRemainsDraft: boolean;
  noAutomaticApproval: boolean;
};

export type ReportGovernedConclusion = {
  id: string;
  topic: ConclusionTopic;
  subjectLabel: string;
  statement: string;
  evidenceStatus: "supported" | "directional" | "hypothesis" | "prohibited";
  sourceRunId: string;
  sourceType: string;
  effectiveAt: string;
  rationale: string;
  claimBoundary: string;
  chapterIds: ReportChapterId[];
};

export type ReportConclusionOverride = {
  currentId: string;
  topic: ConclusionTopic;
  currentStatement: string;
  rationale: string;
  previous: Array<{ id: string; statement: string }>;
};

export type ReportConclusionGovernance = {
  currentByTopic: Partial<Record<ConclusionTopic, ReportGovernedConclusion[]>>;
  currentByChapter: Partial<
    Record<ReportChapterId, Partial<Record<ConclusionTopic, ReportGovernedConclusion[]>>>
  >;
  overrides: ReportConclusionOverride[];
  currentCount: number;
  topicCount: number;
  supersededCount: number;
  boundChapterCount: number;
  conflictCount: number;
  overallBoundary: string;
};

/**
 * A supply-side lever: what would actually have to be made or sourced.
 *
 * `customizationLevel` is the closest thing this system has to "does this need
 * tooling" — the cost question a seller asks first.
 */
export type ReportSupplyAtom = {
  id: string;
  categoryLabel: string;
  name: string;
  description: string;
  customizationLabel: string;
  costVisibilityLabel: string;
  independentlySourceable: boolean;
  targetSkuVerified: boolean;
};

export type ReportBuildPlan = {
  atoms: ReportSupplyAtom[];
  /** Grouped for reading; the order follows the category list. */
  categories: Array<{ label: string; atoms: ReportSupplyAtom[] }>;
  totals: {
    total: number;
    deepCustomization: number;
    costKnown: number;
    targetVerified: number;
    independentlySourceable: number;
  };
};

export type ReportAppendix = {
  evidence: {
    sourceCount: number;
    verifiedCount: number;
    needsReviewCount: number;
    unresolvedCount: number;
    verifiedExplanation: string;
    needsReviewExplanation: string;
    sources: ReportEvidenceSource[];
  };
  unknowns: string[];
  timeline: Array<{ stage: string; label: string; at: string; note: string }>;
  /** Deep links kept for auditors; not part of the main storyline. */
  auditUrls: { research: string; firstPrinciples: string; evidence: string };
  /** Present only when the run actually has the data behind it. */
  /** What was searched for, including searches that found nothing. */
  searchLog: SearchLogView;
  riskModuleCount: number;
  economicsScenarioCount: number;
  exportHtmlAvailable: boolean;
};

export type ReportEvidenceLineage = {
  primary: {
    runId: string;
    label: string;
    researchSourceCount: number;
    voiceSourceCount: number;
    observationCount: number;
    platformCount: number;
    datedObservationCount: number;
  };
  audit: {
    runId: string;
    label: string;
    researchSourceCount: number;
    voiceSourceCount: number;
    observationCount: number;
    platformCount: number;
    datedObservationCount: number;
    searchQueryCount: number;
    searchLogFidelity: SearchLogView["fidelity"];
    productSelectionDecision: string;
    formalSkuDecision: string;
    limitations: string[];
  };
  boundary: string;
};

export type RunReport = {
  runId: string;
  product: string;
  market: string;
  generatedAt: string;
  chapters: ReportChapterMeta[];
  /** Explicit when one report composes a historical analysis with a newer audit run. */
  evidenceLineage: ReportEvidenceLineage | null;
  summary: ReportSummary;
  /** Deterministic gate card; null only when no recommended opportunity exists. */
  commercialViability: CommercialViabilityCard | null;
  marketChapter: ReportMarket;
  /** Category-agnostic structure of observed public offers; never sales-weighted. */
  priceMarketStructure: PriceMarketStructure | null;
  /** Directional reverse model; never upgrades the formal unit-economics gate. */
  estimatedUnitEconomics: EstimatedUnitEconomicsModel | null;
  /** Present only for a configured cross-category validation candidate. */
  secondCategoryValidation: SecondCategoryValidation | null;
  /**
   * Seller-facing Chinese narrative. The commercial analysis on disk is
   * English, so the localized brief carries the reading text and the English
   * analysis below is kept alongside it as the original record.
   */
  narrative: PreSampleDecisionBrief["whyContinue"];
  recommendation: PreSampleDecisionBrief["recommendation"];
  competitors: LiveResearchAnalysis["competitorInsight"];
  /** Competitor practice beside our own requirement, dimension by dimension. */
  competitorStance: CompetitorStanceRow[];
  /** Parsed from claims; empty when no claim states a price with confidence. */
  priceAnchors: PriceAnchor[];
  /** Our recommended band, parsed from positioning. Null when unparseable. */
  priceRange: PriceRange | null;
  /** The raw positioning sentence, shown when the band cannot be parsed. */
  priceRangeText: string;
  customers: LiveResearchAnalysis["customerInsight"];
  voice: ReportVoice;
  /** Plain-language disclosure of where the seller-facing VOC corpus came from. */
  voicePlatformCounts: ReportVoicePlatformCount[];
  /** Same-theme complaint vs satisfaction, highest complaint first. */
  sentimentSplit: ReportSentimentRow[];
  /** Observations typed `counterevidence`, with their content. */
  counterevidence: ReportCounterevidence[];
  /** Split out of the merged "positive or counterevidence" figure. */
  positiveEvidenceCount: number;
  /**
   * True when no observation carries an original publication date, so a
   * long-standing complaint cannot be told apart from a recent spike.
   */
  missingObservationDates: boolean;
  observationDateCoverage: { total: number; dated: number };
  positioning: LiveResearchAnalysis["positioning"];
  opportunities: OpportunityHypothesis[];
  recommendedOpportunityId: string | null;
  recommendationRationale: string;
  alternativesNotRecommended: FirstPrinciplesBundle["alternatives_not_recommended"];
  mustHave: string[];
  /** Null when the run has no first-principles supply atoms. */
  buildPlan: ReportBuildPlan | null;
  /** Null when this run has no demand field artifact. */
  demandField: ReportDemandField | null;
  /** Null until a current-run psychology artifact passes strict validation. */
  consumerPsychology: ReportConsumerPsychology | null;
  /** Null unless this report has a validated cross-chapter conclusion registry. */
  conclusionGovernance: ReportConclusionGovernance | null;
  /** Research-only priority order for adjacent opportunities; never an approval gate. */
  opportunityValidationRoadmap: OpportunityValidationRoadmap | null;
  /** One global first action across current-product validation and adjacent exploration. */
  unifiedActionQueue: UnifiedActionQueue;
  /** Current-product execution status; actual values remain empty until evidence is recorded. */
  validationExecutionLedger: ValidationExecutionLedger;
  /** English reasoning artifact, kept for the appendix and cost arithmetic. */
  validationPlan: ValidationExperiment[];
  /** Localized steps: what the reader actually follows. */
  validationSteps: PreSampleDecisionBrief["validationSteps"];
  validationBudget: PreSampleDecisionBrief["estimatedValidationBudget"];
  stopConditionGroups: PreSampleDecisionBrief["stopConditionGroups"];
  supplierHandoff: PreSampleDecisionBrief["supplierHandoff"];
  supplierInquiryGroups: PreSampleDecisionBrief["supplierInquiryGroups"];
  marketing: PreSampleDecisionBrief["marketingTranslation"];
  prohibitedMarketingClaims: string[];
  mustNotHave: PreSampleDecisionBrief["mustNotHave"];
  boundaries: PreSampleDecisionBrief["decisionBoundaries"];
  entryConditions: string[];
  boundaryRationale: string;
  nextStageRequirements: string[];
  appendix: ReportAppendix;
};
