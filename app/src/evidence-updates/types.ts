import { z } from "zod";
import { isoDateTimeSchema } from "../research/types";

export const evidenceUpdateChapterIds = [
  "decision",
  "market",
  "customers",
  "competitors",
  "positioning",
  "marketing",
  "sourcing",
  "economics",
  "validation",
  "first_principles",
  "evidence",
  "updates",
] as const;

export const evidenceUpdateRecordTypes = [
  "customer_observation",
  "market_metric",
  "competitor_observation",
  "supplier_observation",
  "regulation_observation",
  "experiment_result",
  "source_observation",
] as const;

export const evidenceUpdateProvenanceClasses = [
  "public_observation",
  "third_party_estimate",
  "first_party_actual",
] as const;

export const evidenceUpdateFidelities = ["record_level", "source_level", "summary_only"] as const;

const entityReferenceSchema = z.object({
  kind: z.enum(["product", "brand", "keyword", "supplier", "market", "platform", "other"]),
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
}).strict();

const evidenceMetricSchema = z.object({
  name: z.string().trim().min(1),
  value: z.number(),
  unit: z.string().trim().min(1),
  currency: z.string().trim().min(3).max(12).optional(),
  methodology: z.string().trim().min(3),
}).strict();

export const evidenceUpdateRecordSchema = z.object({
  evidenceId: z.string().trim().min(6).optional(),
  evidenceType: z.enum(evidenceUpdateRecordTypes),
  externalId: z.string().trim().min(1).optional(),
  sourceRecordId: z.string().trim().min(1).optional(),
  sourceUrl: z.url().optional(),
  entityRefs: z.array(entityReferenceSchema),
  market: z.string().trim().min(2),
  locale: z.string().trim().min(2).optional(),
  publishedAt: isoDateTimeSchema.nullable().optional(),
  collectedAt: isoDateTimeSchema,
  rawPayloadRef: z.string().trim().min(1),
  contentExcerpt: z.string().trim().min(3).max(1200).optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  metric: evidenceMetricSchema.optional(),
  provenanceClass: z.enum(evidenceUpdateProvenanceClasses),
  themes: z.array(z.string().trim().min(2)),
  quality: z.object({
    access: z.enum(["accessible", "partial", "blocked", "unavailable"]),
    freshness: z.enum(["current", "dated", "unknown"]),
    coverage: z.enum(["single_record", "bounded_sample", "representative", "unknown"]),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]),
  }).strict(),
  claimBoundary: z.object({
    supports: z.string().trim().min(5),
    cannotProve: z.string().trim().min(5),
  }).strict(),
  intendedChapterIds: z.array(z.enum(evidenceUpdateChapterIds)).default([]),
  status: z.enum(["active", "superseded", "invalid"]).default("active"),
}).strict().superRefine((record, context) => {
  if (!record.contentExcerpt && !record.metric) {
    context.addIssue({ code: "custom", message: "Evidence record requires contentExcerpt or metric" });
  }
});

export const evidenceBatchInputSchema = z.object({
  schemaVersion: z.literal("1.0"),
  batchId: z.string().trim().regex(/^[A-Z0-9][A-Z0-9_-]{5,}$/),
  runId: z.string().trim().min(8),
  sourceRunIds: z.array(z.string().trim().min(8)).default([]),
  provider: z.object({
    id: z.string().trim().min(2),
    label: z.string().trim().min(2),
    channel: z.string().trim().min(2),
  }).strict(),
  acquisitionMethod: z.enum(["web-search", "web-fetch", "api", "file-import", "manual-registration", "experiment"]),
  fidelity: z.enum(evidenceUpdateFidelities),
  querySpec: z.record(z.string(), z.unknown()).default({}),
  requestedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema,
  outcome: z.enum(["success", "partial", "blocked", "empty"]),
  rawCount: z.number().int().nonnegative(),
  excludedCount: z.number().int().nonnegative().default(0),
  summaryAcceptedCount: z.number().int().nonnegative().optional(),
  records: z.array(evidenceUpdateRecordSchema),
  boundary: z.string().trim().min(10),
}).strict().superRefine((batch, context) => {
  if (batch.fidelity === "summary_only" && batch.records.length > 0) {
    context.addIssue({ code: "custom", path: ["records"], message: "summary_only batches cannot contain record-level evidence" });
  }
  if (batch.fidelity === "summary_only" && batch.summaryAcceptedCount === undefined) {
    context.addIssue({ code: "custom", path: ["summaryAcceptedCount"], message: "summary_only batches require summaryAcceptedCount" });
  }
  if (batch.fidelity !== "summary_only" && batch.summaryAcceptedCount !== undefined) {
    context.addIssue({ code: "custom", path: ["summaryAcceptedCount"], message: "record-level batches cannot declare summaryAcceptedCount" });
  }
});

export const registeredEvidenceBatchSchema = evidenceBatchInputSchema.safeExtend({
  registeredAt: isoDateTimeSchema,
  counts: z.object({
    raw: z.number().int().nonnegative(),
    parsed: z.number().int().nonnegative(),
    duplicates: z.number().int().nonnegative(),
    excluded: z.number().int().nonnegative(),
    accepted: z.number().int().nonnegative(),
  }).strict(),
  impactedChapterIds: z.array(z.enum(evidenceUpdateChapterIds)),
  records: z.array(evidenceUpdateRecordSchema.safeExtend({ evidenceId: z.string().trim().min(6) })),
}).strict();

const batchSummarySchema = z.object({
  batchId: z.string(),
  providerId: z.string(),
  providerLabel: z.string(),
  channel: z.string(),
  fidelity: z.enum(evidenceUpdateFidelities),
  completedAt: isoDateTimeSchema,
  counts: registeredEvidenceBatchSchema.shape.counts,
  impactedChapterIds: z.array(z.enum(evidenceUpdateChapterIds)),
  boundary: z.string(),
}).strict();

export const evidenceUpdateRegistrySchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  version: z.number().int().nonnegative(),
  updatedAt: isoDateTimeSchema,
  batches: z.array(batchSummarySchema),
  evidenceIndex: z.record(z.string(), z.object({
    evidenceId: z.string(),
    batchId: z.string(),
  }).strict()),
  totals: z.object({
    batches: z.number().int().nonnegative(),
    raw: z.number().int().nonnegative(),
    parsed: z.number().int().nonnegative(),
    duplicates: z.number().int().nonnegative(),
    excluded: z.number().int().nonnegative(),
    accepted: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export const evidenceUpdateVersionSchema = z.object({
  schemaVersion: z.literal("1.0"),
  versionId: z.string().trim().min(6),
  runId: z.string().trim().min(8),
  batchId: z.string().trim().min(6),
  createdAt: isoDateTimeSchema,
  registryVersionBefore: z.number().int().nonnegative(),
  registryVersionAfter: z.number().int().positive(),
  counts: registeredEvidenceBatchSchema.shape.counts,
  impactedChapterIds: z.array(z.enum(evidenceUpdateChapterIds)),
  totalsBefore: evidenceUpdateRegistrySchema.shape.totals,
  totalsAfter: evidenceUpdateRegistrySchema.shape.totals,
  changedMetrics: z.array(z.object({
    field: z.string(),
    before: z.number(),
    after: z.number(),
    delta: z.number(),
  }).strict()),
  boundary: z.string().trim().min(10),
}).strict();

const recomputedThemeSchema = z.object({
  theme: z.string().trim().min(2),
  label: z.string().trim().min(2),
  count: z.number().int().nonnegative(),
  share: z.number().min(0).max(1),
  negativeOrNeutral: z.number().int().nonnegative(),
  positiveOrCounter: z.number().int().nonnegative(),
}).strict();

export const evidenceAnalysisSnapshotSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  registryVersion: z.number().int().nonnegative(),
  generatedAt: isoDateTimeSchema,
  includedBatchIds: z.array(z.string()),
  coverage: z.object({
    customerRecords: z.number().int().nonnegative(),
    sourceFamilies: z.number().int().nonnegative(),
    platforms: z.number().int().nonnegative(),
    negativeOrNeutral: z.number().int().nonnegative(),
    positiveOrCounter: z.number().int().nonnegative(),
    unknownSentiment: z.number().int().nonnegative(),
  }).strict(),
  topThemes: z.array(recomputedThemeSchema),
  conclusions: z.object({
    customer: z.string().trim().min(8),
    product: z.string().trim().min(8),
    marketing: z.string().trim().min(8),
    decision: z.string().trim().min(8),
  }).strict(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"]),
  boundary: z.string().trim().min(10),
}).strict();

export const evidenceAnalysisDiffSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  batchId: z.string().trim().min(6),
  fromVersion: z.number().int().nonnegative(),
  toVersion: z.number().int().positive(),
  generatedAt: isoDateTimeSchema,
  changed: z.boolean(),
  affectedChapterIds: z.array(z.enum(evidenceUpdateChapterIds)),
  metrics: z.array(z.object({
    field: z.string(),
    before: z.number(),
    after: z.number(),
    delta: z.number(),
  }).strict()),
  conclusions: z.array(z.object({
    chapterId: z.enum(evidenceUpdateChapterIds),
    label: z.string().trim().min(2),
    before: z.string().trim().min(1),
    after: z.string().trim().min(1),
    reason: z.string().trim().min(8),
    status: z.enum(["changed", "unchanged"]),
  }).strict()),
  topThemeChanges: z.array(z.object({
    theme: z.string(),
    label: z.string(),
    beforeCount: z.number().int().nonnegative(),
    afterCount: z.number().int().nonnegative(),
    delta: z.number().int(),
  }).strict()),
  boundary: z.string().trim().min(10),
}).strict();

export const evidenceConclusionReviewProposalSchema = z.object({
  schemaVersion: z.literal("1.0"),
  proposalId: z.string().trim().min(6),
  runId: z.string().trim().min(8),
  generatedAt: isoDateTimeSchema,
  sourceRegistryVersion: z.number().int().positive(),
  sourceBatchId: z.string().trim().min(6),
  formalGovernanceGeneratedAt: isoDateTimeSchema,
  status: z.literal("PENDING_REVIEW"),
  drafts: z.array(z.object({
    chapterId: z.enum(evidenceUpdateChapterIds),
    label: z.string().trim().min(2),
    topic: z.string().trim().min(2),
    currentConclusionId: z.string().trim().min(3),
    currentStatement: z.string().trim().min(8),
    draftStatement: z.string().trim().min(8),
    currentEvidenceStatus: z.string().trim().min(2),
    currentClaimBoundary: z.string().trim().min(8),
    reviewStatus: z.literal("PENDING"),
  }).strict()).min(1),
  gates: z.object({
    analysisReady: z.literal(true),
    humanReviewApproved: z.literal(false),
    validationProposalApproved: z.literal(false),
    formalPublicationAllowed: z.literal(false),
  }).strict(),
  boundary: z.string().trim().min(20),
}).strict();

export type EvidenceUpdateChapterId = (typeof evidenceUpdateChapterIds)[number];
export type EvidenceUpdateRecord = z.infer<typeof evidenceUpdateRecordSchema>;
export type EvidenceBatchInput = z.infer<typeof evidenceBatchInputSchema>;
export type RegisteredEvidenceBatch = z.infer<typeof registeredEvidenceBatchSchema>;
export type EvidenceUpdateRegistry = z.infer<typeof evidenceUpdateRegistrySchema>;
export type EvidenceUpdateVersion = z.infer<typeof evidenceUpdateVersionSchema>;
export type EvidenceAnalysisSnapshot = z.infer<typeof evidenceAnalysisSnapshotSchema>;
export type EvidenceAnalysisDiff = z.infer<typeof evidenceAnalysisDiffSchema>;
export type EvidenceConclusionReviewProposal = z.infer<typeof evidenceConclusionReviewProposalSchema>;
