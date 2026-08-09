import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { codexNativeRunPath } from "../first-principles/service";
import type { SellerDecisionStatus, ValidationTestType } from "./types";

const zhText = z.string().trim().min(2).refine((value) => /[\u3400-\u9fff]/u.test(value), {
  message: "seller-facing text must contain Simplified Chinese",
});
const zhList = z.array(zhText).min(1).max(8);
const englishQuestion = z.string().trim().min(4);

const localizedValidationStepSchema = z.object({
  internalType: z.enum(["concept_test", "supplier_validation", "sample_test", "pricing_test", "unit_economics_check"]),
  method: zhText,
  scope: zhText,
  metric: zhText,
  pass: zhText,
  fail: zhText,
  stop: zhText,
  nextIfPass: zhText,
  nextIfFail: zhText,
});

const researchMorePlanItemSchema = z.object({
  question: zhText,
  suggestedSources: zhList.max(4),
  pass: zhText,
  fail: zhText,
  budgetCap: z.string().trim().min(1),
  stop: zhText,
});

export const sellerBriefLocalizationSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  language: z.literal("zh-CN"),
  generatedAt: z.iso.datetime(),
  conclusion: zhText,
  whyContinue: z.object({
    users: zhList.max(5),
    scenarios: zhList.max(5),
    painPoints: zhList.max(5),
    currentAlternatives: zhList.max(5),
    competitorReasons: zhList.max(5),
    opportunityEvidence: zhList.max(5),
    majorUnknowns: zhList.max(7),
  }),
  recommendation: z.object({
    title: zhText,
    targetCustomer: zhText,
    targetScenario: zhText,
    productConcept: zhText,
    coreValue: zhText,
    whyFirst: zhText,
    alternativesDeferred: zhList.max(4),
    evidenceStrength: zhText,
  }),
  mustHave: zhList,
  nextStageRequirements: zhList,
  mustNotHave: z.object({
    productScope: zhList,
    marketingClaims: zhList,
    evidenceAndSupplyChain: zhList,
  }),
  supplierHandoff: z.object({
    productDirection: zhText,
    structureAndMaterialDirections: zhList,
    sampleScope: zhText,
    supplierConfirmations: zhList,
    requestedDocuments: zhList,
    publicPageLimitations: zhList,
  }),
  supplierInquiryGroups: z.array(z.object({
    title: zhText,
    questionsZh: z.array(zhText).min(1).max(5),
    questionsEn: z.array(englishQuestion).min(1).max(5),
  })).min(3).max(8),
  validationSteps: z.array(localizedValidationStepSchema).length(5),
  researchMore: z.object({
    possibleOpportunities: zhList.max(4),
    keyMissingEvidence: zhList.max(8),
    researchPlan: z.array(researchMorePlanItemSchema).min(1).max(6),
    upgradeConditions: zhList.max(8),
    doNotInvest: zhList.max(8),
  }).optional(),
  notWorthPursuing: z.object({
    stopReasons: zhList.max(5),
    supportingEvidence: zhList.max(8),
    whyNotMoreResearch: zhList.max(5),
    reassessmentConditions: zhList.max(6),
    doNotInvest: zhList.max(8),
  }).optional(),
});

export type SellerBriefLocalization = z.infer<typeof sellerBriefLocalizationSchema>;

export const sellerBriefLocalizationPath = (runId: string): string =>
  path.join(codexNativeRunPath(runId), "seller-brief-localization.json");

export const readSellerBriefLocalization = async (runId: string): Promise<SellerBriefLocalization> => {
  const file = sellerBriefLocalizationPath(runId);
  const localization = sellerBriefLocalizationSchema.parse(JSON.parse(await readFile(file, "utf8")) as unknown);
  if (localization.runId !== runId) throw new Error(`Seller Brief localization Run mismatch: ${localization.runId}`);

  const internalTypes = localization.validationSteps.map((item) => item.internalType);
  const expected: ValidationTestType[] = [
    "concept_test",
    "supplier_validation",
    "sample_test",
    "pricing_test",
    "unit_economics_check",
  ];
  if (new Set(internalTypes).size !== expected.length || expected.some((type) => !internalTypes.includes(type))) {
    throw new Error("Seller Brief localization must map all five validation test types exactly once");
  }
  return localization;
};

export const statusLabels: Record<SellerDecisionStatus, string> = {
  NOT_WORTH_PURSUING: "不建议进入供应链阶段",
  RESEARCH_MORE: "存在机会，但需要继续补证",
  READY_FOR_SOURCING: "可以开始供应商候选研究和受控买样",
  SAMPLE_VALIDATION_REQUIRED: "已有候选样品，等待实物验证",
};

export const validationTypeLabels: Record<ValidationTestType, string> = {
  concept_test: "产品概念测试",
  supplier_validation: "供应商能力确认",
  sample_test: "样品实测",
  pricing_test: "价格接受度测试",
  unit_economics_check: "正式成本核算",
};

export const evidenceStatusLabels: Record<string, string> = {
  verified: "已验证",
  needs_review: "待复核",
};
