import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { codexNativeRunPath } from "../first-principles/service";
import type { ResearchClaim } from "../research/live-types";
import { readVocSummary } from "../voc/service";
import type { VocSummary } from "../voc/types";
import type { SellerDecisionStatus } from "./types";

export const readinessKeys = [
  "user_task_supported",
  "demand_beyond_competitors",
  "concrete_opportunity",
  "category_specific_must_have",
  "category_specific_must_not_have",
  "executable_supplier_direction",
  "bounded_validation_plan",
  "unknowns_resolvable_by_sourcing",
  "value_outweighs_complexity",
] as const;

export const structuralStopCodes = [
  "weak_user_value",
  "sufficient_substitutes",
  "commodity_without_differentiation",
  "disproportionate_validation",
  "unsupported_claim_dependency",
  "deep_customization_required",
  "systemic_usage_friction",
  "no_clear_purchase_reason",
] as const;

const assessmentItemSchema = z.object({
  supported: z.boolean(),
  claimIds: z.array(z.string().trim().min(1)),
  rationale: z.string().trim().min(5),
}).superRefine((item, context) => {
  if (item.supported && item.claimIds.length === 0) {
    context.addIssue({ code: "custom", path: ["claimIds"], message: "supported assessment items require current-run Claims" });
  }
});

export const decisionStateAssessmentSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  generatedAt: z.iso.datetime(),
  readiness: z.object(Object.fromEntries(readinessKeys.map((key) => [key, assessmentItemSchema])) as Record<
    (typeof readinessKeys)[number],
    typeof assessmentItemSchema
  >),
  credibleBoundedOpportunity: assessmentItemSchema,
  structuralStopSignals: z.array(z.object({
    code: z.enum(structuralStopCodes),
    ...assessmentItemSchema.shape,
  })).max(structuralStopCodes.length),
  missingEvidence: z.array(z.object({
    question: z.string().trim().min(5),
    whyItMatters: z.string().trim().min(5),
  })).max(12),
});

export type DecisionStateAssessment = z.infer<typeof decisionStateAssessmentSchema>;

export type DecisionStateResult = {
  status: Extract<SellerDecisionStatus, "READY_FOR_SOURCING" | "RESEARCH_MORE" | "NOT_WORTH_PURSUING">;
  reasonCodes: string[];
  supportedStopSignals: Array<(typeof structuralStopCodes)[number]>;
  missingReadiness: Array<(typeof readinessKeys)[number]>;
  assessmentAvailable: boolean;
};

export const decisionStateAssessmentPath = (runId: string): string =>
  path.join(codexNativeRunPath(runId), "decision-state-assessment.json");

export const deriveSellerDecisionState = (
  assessment: DecisionStateAssessment | null,
  claims: ResearchClaim[],
  expectedRunId?: string,
  vocSummary?: VocSummary | null,
): DecisionStateResult => {
  if (!assessment) {
    return {
      status: "RESEARCH_MORE",
      reasonCodes: ["ASSESSMENT_MISSING"],
      supportedStopSignals: [],
      missingReadiness: [...readinessKeys],
      assessmentAvailable: false,
    };
  }
  if (expectedRunId && assessment.runId !== expectedRunId) {
    throw new Error(`Decision assessment Run mismatch: ${assessment.runId}`);
  }

  const claimIds = new Set(claims.map((claim) => claim.id));
  const references = [
    ...Object.values(assessment.readiness).flatMap((item) => item.claimIds),
    ...assessment.credibleBoundedOpportunity.claimIds,
    ...assessment.structuralStopSignals.flatMap((item) => item.claimIds),
  ];
  const invalidClaimIds = [...new Set(references.filter((id) => !claimIds.has(id)))];
  if (invalidClaimIds.length > 0) {
    throw new Error(`Decision assessment references Claims outside the current Run: ${invalidClaimIds.join(", ")}`);
  }

  const missingReadiness = readinessKeys.filter((key) => !assessment.readiness[key].supported);
  const supportedStops = assessment.structuralStopSignals.filter((item) => item.supported);
  const independentStopClaims = new Set(supportedStops.flatMap((item) => item.claimIds));

  if (
    supportedStops.length >= 2 &&
    independentStopClaims.size >= 2 &&
    !assessment.credibleBoundedOpportunity.supported
  ) {
    return {
      status: "NOT_WORTH_PURSUING",
      reasonCodes: supportedStops.map((item) => item.code),
      supportedStopSignals: supportedStops.map((item) => item.code),
      missingReadiness,
      assessmentAvailable: true,
    };
  }

  if (
    missingReadiness.length === 0 &&
    supportedStops.length === 0 &&
    assessment.credibleBoundedOpportunity.supported
  ) {
    if (vocSummary) {
      if (vocSummary.run_id !== assessment.runId) {
        throw new Error(`VOC summary Run mismatch: ${vocSummary.run_id}`);
      }
      const vocReady =
        (vocSummary.confidence === "HIGH" || vocSummary.confidence === "MEDIUM") &&
        vocSummary.coverage.source_family_count >= 2 &&
        vocSummary.coverage.positive_or_counterevidence > 0 &&
        vocSummary.coverage.alternative_observations > 0;
      if (!vocReady) {
        return {
          status: "RESEARCH_MORE",
          reasonCodes: ["VOC_EVIDENCE_INSUFFICIENT"],
          supportedStopSignals: [],
          missingReadiness: [],
          assessmentAvailable: true,
        };
      }
    }
    return {
      status: "READY_FOR_SOURCING",
      reasonCodes: ["ALL_READY_CONDITIONS_SUPPORTED"],
      supportedStopSignals: [],
      missingReadiness: [],
      assessmentAvailable: true,
    };
  }

  return {
    status: "RESEARCH_MORE",
    reasonCodes: missingReadiness.length > 0 ? missingReadiness : ["CONFLICTING_EVIDENCE"],
    supportedStopSignals: supportedStops.map((item) => item.code),
    missingReadiness,
    assessmentAvailable: true,
  };
};

export const readDecisionStateAssessment = async (
  runId: string,
  claims: ResearchClaim[],
): Promise<{ assessment: DecisionStateAssessment | null; result: DecisionStateResult }> => {
  let assessment: DecisionStateAssessment | null = null;
  try {
    assessment = decisionStateAssessmentSchema.parse(
      JSON.parse(await readFile(decisionStateAssessmentPath(runId), "utf8")) as unknown,
    );
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const vocSummary = await readVocSummary(runId);
  return { assessment, result: deriveSellerDecisionState(assessment, claims, runId, vocSummary) };
};
