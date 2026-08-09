export type SellerDecisionStatus =
  | "NOT_WORTH_PURSUING"
  | "RESEARCH_MORE"
  | "READY_FOR_SOURCING"
  | "SAMPLE_VALIDATION_REQUIRED";

export type ValidationTestType =
  | "concept_test"
  | "supplier_validation"
  | "sample_test"
  | "pricing_test"
  | "unit_economics_check";

export type PreSampleValidationStep = {
  internalType: ValidationTestType;
  name: string;
  method: string;
  scope: string;
  budgetCap: string;
  durationDays: number;
  metric: string;
  pass: string;
  fail: string;
  stop: string;
  nextIfPass: string;
  nextIfFail: string;
};

export type SupplierInquiryGroup = {
  title: string;
  questionsZh: string[];
  questionsEn: string[];
};

export type ResearchMorePlanItem = {
  question: string;
  suggestedSources: string[];
  pass: string;
  fail: string;
  budgetCap: string;
  stop: string;
};

export type PreSampleDecisionBrief = {
  runId: string;
  product: string;
  market: string;
  generatedAt: string;
  language: "zh-CN";
  status: SellerDecisionStatus;
  statusLabel: string;
  conclusion: string;
  scopeNotice: string;
  whyContinue: {
    users: string[];
    scenarios: string[];
    painPoints: string[];
    currentAlternatives: string[];
    competitorReasons: string[];
    opportunityEvidence: string[];
    majorUnknowns: string[];
  };
  recommendation: {
    title: string;
    internalTitle: string;
    targetCustomer: string;
    targetScenario: string;
    productConcept: string;
    coreValue: string;
    whyFirst: string;
    alternativesDeferred: string[];
    evidenceStrength: string;
  };
  mustHave: string[];
  nextStageRequirements: string[];
  mustNotHave: {
    productScope: string[];
    marketingClaims: string[];
    evidenceAndSupplyChain: string[];
  };
  supplierHandoff: {
    productDirection: string;
    structureAndMaterialDirections: string[];
    sampleScope: string;
    supplierConfirmations: string[];
    requestedDocuments: string[];
    publicPageLimitations: string[];
  };
  supplierInquiryGroups: SupplierInquiryGroup[];
  validationSteps: PreSampleValidationStep[];
  estimatedValidationBudget: {
    currency: string;
    amount: number | null;
    label: string;
    budgetFit: "UNKNOWN" | "WITHIN_USER_BUDGET" | "OVER_USER_BUDGET";
    budgetFitLabel: string;
    note: string;
  };
  stopConditionGroups: Array<{
    title: string;
    conditions: string[];
  }>;
  researchMore?: {
    possibleOpportunities: string[];
    keyMissingEvidence: string[];
    researchPlan: ResearchMorePlanItem[];
    upgradeConditions: string[];
    doNotInvest: string[];
  };
  notWorthPursuing?: {
    stopReasons: string[];
    supportingEvidence: string[];
    whyNotMoreResearch: string[];
    reassessmentConditions: string[];
    doNotInvest: string[];
  };
  evidenceTrust: {
    sourceCount: number;
    verifiedCount: number;
    needsReviewCount: number;
    unresolvedCount: number;
    verifiedExplanation: string;
    needsReviewExplanation: string;
    sources: Array<{
      title: string;
      url: string;
      status: string;
      statusLabel: string;
    }>;
  };
  voiceOfCustomer: {
    available: boolean;
    confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
    confidenceRationale: string;
    validObservations: number;
    negativeOrNeutral: number;
    positiveOrCounterevidence: number;
    sourceCount: number;
    sourceFamilyCount: number;
    platformCount: number;
    denominatorDefinition: string;
    topPainPoints: Array<{
      theme: string;
      count: number;
      denominator: number;
      sourceFamilies: string[];
      scopeNote: string;
    }>;
    desiredOutcomes: string[];
    counterevidence: string[];
    representativeExcerpts: Array<{
      theme: string;
      excerpt: string;
      url: string;
    }>;
    blockers: string[];
    limitations: string[];
    amazonCommentLevelEvidence: boolean;
  };
  advancedAuditUrls: {
    research: string;
    firstPrinciples: string;
  };
  decisionBoundaries: {
    formalPurchase: string;
    supplierReliability: string;
    listing: string;
    adTest: string;
  };
  marketingTranslation?: MarketingTranslation;
};
import type { MarketingTranslation } from "../marketing-translation/types";
