import { createHash } from "node:crypto";
import { z } from "zod";
import type { ClaimRecord, SourceRecord } from "./types";

export const extractedClaimSchema = z.object({
  atomicClaim: z.string().min(1),
  informationNature: z.string().min(1),
  verificationStatus: z.string().min(1),
  runSpecApplicability: z.string().min(1),
  dataCompleteness: z.string().min(1),
  decisionUse: z.string().min(1),
  confidence: z.string().min(1),
  sourceId: z.string().min(1),
  missingEvidence: z.string(),
  notes: z.string().nullable().optional(),
});

export const extractedClaimsResponseSchema = z.object({
  claims: z.array(extractedClaimSchema).min(1).max(10),
});

export type ExtractedClaim = z.infer<typeof extractedClaimSchema>;

export type ClaimExtractionValidationResult =
  | {
      ok: true;
      claims: ExtractedClaim[];
      invalidSourceIds: string[];
      competitorMigrationClaimIndexes: number[];
      inferencePolicyClaimIndexes: number[];
    }
  | {
      ok: false;
      errorCode: "SCHEMA_ERROR" | "INVALID_SOURCE_ID" | "COMPETITOR_EVIDENCE_MIGRATION" | "INFERENCE_POLICY_VIOLATION";
      errorMessage: string;
      invalidSourceIds: string[];
      competitorMigrationClaimIndexes: number[];
      inferencePolicyClaimIndexes: number[];
    };

const directDecisionEvidenceValues = new Set(["直接决策证据", "direct_decision_evidence", "direct"]);
const applicableValues = new Set(["适用", "applicable"]);
const lowConfidenceValues = new Set(["低", "low"]);

const isCompetitorSource = (source: SourceRecord): boolean =>
  source.sourceType.includes("竞品") ||
  source.targetEntity.includes("竞品") ||
  source.notes?.includes("不得迁移至目标商品") === true;

const isModelInference = (claim: ExtractedClaim): boolean =>
  claim.informationNature.includes("推断") || claim.informationNature.toLowerCase().includes("inference");

export const validateExtractedClaims = (
  payload: unknown,
  allowedSources: SourceRecord[],
): ClaimExtractionValidationResult => {
  const parsed = extractedClaimsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      errorCode: "SCHEMA_ERROR",
      errorMessage: parsed.error.message,
      invalidSourceIds: [],
      competitorMigrationClaimIndexes: [],
      inferencePolicyClaimIndexes: [],
    };
  }

  const sourceById = new Map(allowedSources.map((source) => [source.id, source]));
  const invalidSourceIds = [...new Set(parsed.data.claims.map((claim) => claim.sourceId).filter((id) => !sourceById.has(id)))];
  const competitorMigrationClaimIndexes = parsed.data.claims.flatMap((claim, index) => {
    const source = sourceById.get(claim.sourceId);
    if (!source || !isCompetitorSource(source)) {
      return [];
    }
    return applicableValues.has(claim.runSpecApplicability) && directDecisionEvidenceValues.has(claim.decisionUse) ? [index] : [];
  });
  const inferencePolicyClaimIndexes = parsed.data.claims.flatMap((claim, index) => {
    if (!isModelInference(claim)) {
      return [];
    }
    const lowConfidence = lowConfidenceValues.has(claim.confidence.toLowerCase()) || claim.confidence.includes("低");
    const directEvidence = directDecisionEvidenceValues.has(claim.decisionUse);
    return lowConfidence && !directEvidence ? [] : [index];
  });

  if (invalidSourceIds.length > 0) {
    return {
      ok: false,
      errorCode: "INVALID_SOURCE_ID",
      errorMessage: `模型返回不存在的Source ID: ${invalidSourceIds.join(", ")}`,
      invalidSourceIds,
      competitorMigrationClaimIndexes,
      inferencePolicyClaimIndexes,
    };
  }

  if (competitorMigrationClaimIndexes.length > 0) {
    return {
      ok: false,
      errorCode: "COMPETITOR_EVIDENCE_MIGRATION",
      errorMessage: `竞品Claim不得自动作为目标商品直接决策证据: ${competitorMigrationClaimIndexes.join(", ")}`,
      invalidSourceIds,
      competitorMigrationClaimIndexes,
      inferencePolicyClaimIndexes,
    };
  }

  if (inferencePolicyClaimIndexes.length > 0) {
    return {
      ok: false,
      errorCode: "INFERENCE_POLICY_VIOLATION",
      errorMessage: `模型推断必须低置信度且不得作为直接决策证据: ${inferencePolicyClaimIndexes.join(", ")}`,
      invalidSourceIds,
      competitorMigrationClaimIndexes,
      inferencePolicyClaimIndexes,
    };
  }

  return {
    ok: true,
    claims: parsed.data.claims,
    invalidSourceIds,
    competitorMigrationClaimIndexes,
    inferencePolicyClaimIndexes,
  };
};

export const toPersistableClaim = ({
  claim,
  index,
  runId,
  source,
  entityId,
}: {
  claim: ExtractedClaim;
  index: number;
  runId: string;
  source: SourceRecord;
  entityId: string | null;
}): ClaimRecord & { id: string; researchRunId: string; entityId: string | null } => ({
  id: `C-OAI-${createHash("sha256").update(`${runId}:${claim.sourceId}:${index}:${claim.atomicClaim}`).digest("hex").slice(0, 12)}`,
  researchRunId: runId,
  entityId,
  sourceId: claim.sourceId,
  atomicClaim: claim.atomicClaim,
  dataNature: source.sourceType.includes("竞品") ? "竞品证据" : "目标/供应链证据",
  sourceType: source.sourceType,
  evidenceCarrier: source.evidenceCarrier,
  sourceLocation: source.title,
  linkSpecificity: source.url === "内部文件，无公开URL" ? "文件级" : "URL级",
  observedAt: source.accessedAt,
  informationNature: claim.informationNature,
  verificationStatus: claim.verificationStatus,
  timeStatus: "当前RunSpec观察",
  runSpecApplicability: claim.runSpecApplicability,
  dataCompleteness: claim.dataCompleteness,
  decisionUse: claim.decisionUse,
  confidence: claim.confidence,
  inferenceBasis: isModelInference(claim) ? "OpenAI结构化抽取中的模型推断" : "OpenAI结构化抽取",
  missingEvidence: claim.missingEvidence,
  notes: claim.notes ?? null,
});
