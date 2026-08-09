import { z } from "zod";
import {
  conclusionEvidenceStatuses,
  conclusionRelations,
  conclusionTopics,
  governedReportChapterIds,
} from "../conclusion-governance/types";
import { conclusionReviewDispositions } from "../validation-execution/types";

export const conclusionPublicationDraftSchema = z.object({
  conclusionId: z.string().trim().min(3),
  statement: z.string().trim().min(8),
  rationale: z.string().trim().min(8),
  claimBoundary: z.string().trim().min(8),
  evidenceStatus: z.enum(conclusionEvidenceStatuses),
}).strict();

export const conclusionPublicationPreviewSchema = z.object({
  schemaVersion: z.literal("1.0"),
  publicationId: z.string().trim().min(6),
  runId: z.string().trim().min(8),
  recordId: z.string().trim().min(6),
  generatedAt: z.iso.datetime(),
  expectedGovernanceGeneratedAt: z.iso.datetime(),
  disposition: z.enum(conclusionReviewDispositions),
  confirmationPhrase: z.literal("确认发布到正式报告"),
  diffs: z.array(z.object({
    oldConclusionId: z.string().trim().min(3),
    newConclusionId: z.string().trim().min(3),
    topic: z.enum(conclusionTopics),
    relation: z.enum(conclusionRelations),
    oldStatement: z.string().trim().min(8),
    newStatement: z.string().trim().min(8),
    oldEvidenceStatus: z.enum(conclusionEvidenceStatuses),
    newEvidenceStatus: z.enum(conclusionEvidenceStatuses),
    oldClaimBoundary: z.string().trim().min(8),
    newClaimBoundary: z.string().trim().min(8),
    chapterIds: z.array(z.enum(governedReportChapterIds)).min(1),
  }).strict()).min(1),
  affectedChapterIds: z.array(z.enum(governedReportChapterIds)).min(1),
  consistencyValidation: z.object({
    valid: z.literal(true),
    errorCount: z.literal(0),
    warningCount: z.number().int().nonnegative(),
  }).strict(),
  boundaries: z.array(z.string().trim().min(12)).min(3),
}).strict();

export type ConclusionPublicationDraft = z.infer<typeof conclusionPublicationDraftSchema>;
export type ConclusionPublicationPreview = z.infer<typeof conclusionPublicationPreviewSchema>;

export const conclusionVersionEntrySchema = z.object({
  publicationId: z.string().trim().min(6),
  recordId: z.string().trim().min(6),
  appliedAt: z.iso.datetime(),
  status: z.enum(["ACTIVE", "SUPERSEDED", "ROLLED_BACK"]),
  rollbackEligible: z.boolean(),
  disposition: z.enum(conclusionReviewDispositions),
  affectedChapterIds: z.array(z.enum(governedReportChapterIds)).min(1),
  diffCount: z.number().int().positive(),
  beforeGeneratedAt: z.iso.datetime(),
  afterGeneratedAt: z.iso.datetime(),
  rolledBackAt: z.iso.datetime().nullable(),
  rollbackId: z.string().trim().min(6).nullable(),
  diffs: conclusionPublicationPreviewSchema.shape.diffs,
}).strict();

export const conclusionVersionHistorySchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  currentGovernanceGeneratedAt: z.iso.datetime(),
  versions: z.array(conclusionVersionEntrySchema),
  metrics: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    superseded: z.number().int().nonnegative(),
    rolledBack: z.number().int().nonnegative(),
  }).strict(),
  boundary: z.string().trim().min(20),
}).strict();

export const conclusionRollbackPreviewSchema = z.object({
  schemaVersion: z.literal("1.0"),
  rollbackId: z.string().trim().min(6),
  runId: z.string().trim().min(8),
  publicationId: z.string().trim().min(6),
  recordId: z.string().trim().min(6),
  generatedAt: z.iso.datetime(),
  currentGovernanceGeneratedAt: z.iso.datetime(),
  restoreGovernanceGeneratedAt: z.iso.datetime(),
  confirmationPhrase: z.literal("确认回滚正式报告"),
  diffs: z.array(z.object({
    currentConclusionId: z.string().trim().min(3),
    restoredConclusionId: z.string().trim().min(3),
    topic: z.enum(conclusionTopics),
    currentStatement: z.string().trim().min(8),
    restoredStatement: z.string().trim().min(8),
    chapterIds: z.array(z.enum(governedReportChapterIds)).min(1),
  }).strict()).min(1),
  consistencyValidation: z.object({ valid: z.literal(true), errorCount: z.literal(0) }).strict(),
  boundaries: z.array(z.string().trim().min(12)).min(3),
}).strict();

export type ConclusionVersionEntry = z.infer<typeof conclusionVersionEntrySchema>;
export type ConclusionVersionHistory = z.infer<typeof conclusionVersionHistorySchema>;
export type ConclusionRollbackPreview = z.infer<typeof conclusionRollbackPreviewSchema>;
