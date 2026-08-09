import { z } from "zod";
import {
  conclusionEvidenceStatuses,
  conclusionTopics,
  governedReportChapterIds,
} from "../conclusion-governance/types";

const validationTypes = [
  "concept_test",
  "supplier_validation",
  "sample_test",
  "pricing_test",
  "unit_economics_check",
] as const;

export const conclusionReviewDispositions = ["RETAIN", "REFINE", "SUPERSEDE", "STOP"] as const;
export const conclusionReviewStatuses = ["NOT_APPLICABLE", "PENDING_REVIEW", "APPROVED", "REJECTED"] as const;

export const validationExecutionStatuses = [
  "NOT_STARTED",
  "READY",
  "BLOCKED",
  "IN_PROGRESS",
  "PASSED",
  "FAILED",
] as const;

export const validationAttemptStatuses = ["IN_PROGRESS", "PASSED", "FAILED"] as const;

export const validationEvidenceRefSchema = z.object({
  id: z.string().trim().min(3),
  kind: z.enum(["response_set", "supplier_document", "sample_record", "price_result", "cost_document", "other"]),
  label: z.string().trim().min(3),
  url: z.string().trim().min(1),
  recordedAt: z.iso.datetime(),
  verified: z.boolean(),
}).strict();

export const validationExecutionAttemptSchema = z.object({
  id: z.string().trim().min(6),
  attemptNumber: z.number().int().positive(),
  status: z.enum(validationAttemptStatuses),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  actuals: z.object({
    sampleSizeLabel: z.string().trim().min(1).nullable(),
    durationDays: z.number().int().nonnegative().nullable(),
    budgetAmount: z.number().nonnegative().nullable(),
    budgetCurrency: z.string().trim().min(3).nullable(),
    notes: z.string().trim().min(3).nullable(),
  }).strict(),
  evidenceRefs: z.array(validationEvidenceRefSchema),
  result: z.object({
    outcome: z.enum(["pass", "fail"]),
    summary: z.string().trim().min(8),
    measuredValue: z.string().trim().min(1).nullable(),
  }).strict().nullable(),
}).strict().superRefine((attempt, context) => {
  if (attempt.actuals.budgetAmount !== null && attempt.actuals.budgetCurrency === null) {
    context.addIssue({ code: "custom", path: ["actuals", "budgetCurrency"], message: "Actual budget requires a currency" });
  }
  if (attempt.status === "IN_PROGRESS" && (attempt.completedAt !== null || attempt.result !== null)) {
    context.addIssue({ code: "custom", path: ["status"], message: "In-progress attempt cannot have a completed result" });
  }
  if (attempt.status !== "IN_PROGRESS") {
    if (attempt.completedAt === null || attempt.result === null || attempt.evidenceRefs.length === 0) {
      context.addIssue({ code: "custom", path: ["status"], message: "Completed attempt requires completion time, evidence and result" });
    }
    const expectedOutcome = attempt.status === "PASSED" ? "pass" : "fail";
    if (attempt.result && attempt.result.outcome !== expectedOutcome) {
      context.addIssue({ code: "custom", path: ["result", "outcome"], message: "Attempt status and result outcome must agree" });
    }
  }
});

export const validationExecutionRecordSchema = z.object({
  id: z.string().trim().min(6),
  runId: z.string().trim().min(8),
  sourceActionId: z.string().trim().min(6),
  dependencyActionIds: z.array(z.string().trim().min(6)),
  order: z.number().int().positive(),
  title: z.string().trim().min(2),
  typeLabel: z.string().trim().min(2),
  validationType: z.enum(validationTypes),
  currentStatus: z.enum(validationExecutionStatuses),
  currentStatusLabel: z.string().trim().min(2),
  planned: z.object({
    method: z.string().trim().min(8),
    scope: z.string().trim().min(1),
    durationDays: z.number().int().positive(),
    budgetLabel: z.string().trim().min(1),
    metric: z.string().trim().min(2),
    pass: z.string().trim().min(3),
    fail: z.string().trim().min(3),
    stop: z.string().trim().min(3),
  }).strict(),
  requiredEvidence: z.array(z.string().trim().min(3)).min(2),
  conclusionReviewTargets: z.array(z.object({
    id: z.string().trim().min(3),
    topic: z.enum(conclusionTopics),
    statement: z.string().trim().min(8),
    evidenceStatus: z.enum(conclusionEvidenceStatuses),
    chapterIds: z.array(z.enum(governedReportChapterIds)).min(1),
    claimBoundary: z.string().trim().min(8),
  }).strict()),
  attempts: z.array(validationExecutionAttemptSchema),
  decisionImpact: z.object({
    currentDecisionUnchanged: z.boolean(),
    affectedConclusionIds: z.array(z.string().trim().min(3)),
    proposedChanges: z.array(z.string().trim().min(3)),
    proposalSummary: z.string().trim().min(8),
    recommendedDisposition: z.enum(conclusionReviewDispositions),
    reviewStatus: z.enum(conclusionReviewStatuses),
    selectedDisposition: z.enum(conclusionReviewDispositions).nullable(),
    reviewer: z.string().trim().min(2).nullable(),
    reviewNote: z.string().trim().min(3).nullable(),
    reviewedAt: z.iso.datetime().nullable(),
    automaticApproval: z.literal(false),
    reportUpdateApplied: z.boolean(),
    publicationId: z.string().trim().min(6).nullable(),
    reportUpdatedAt: z.iso.datetime().nullable(),
    rollbackId: z.string().trim().min(6).nullable(),
    rolledBackAt: z.iso.datetime().nullable(),
  }).strict().nullable(),
}).strict().superRefine((record, context) => {
  const passive = ["NOT_STARTED", "READY", "BLOCKED"].includes(record.currentStatus);
  if (passive && (record.attempts.length > 0 || record.decisionImpact !== null)) {
    context.addIssue({ code: "custom", path: ["currentStatus"], message: "Unexecuted record cannot contain attempts or decision impact" });
  }
  if (!passive && record.attempts.length === 0) {
    context.addIssue({ code: "custom", path: ["attempts"], message: "Executed record requires at least one attempt" });
  }
  const lastAttempt = record.attempts.at(-1);
  if (lastAttempt && lastAttempt.status !== record.currentStatus) {
    context.addIssue({ code: "custom", path: ["currentStatus"], message: "Current status must match the latest attempt" });
  }
  const targetIds = record.conclusionReviewTargets.map((target) => target.id);
  if (new Set(targetIds).size !== targetIds.length) {
    context.addIssue({ code: "custom", path: ["conclusionReviewTargets"], message: "Conclusion review targets must be unique" });
  }
  if (record.decisionImpact) {
    const affected = [...record.decisionImpact.affectedConclusionIds].sort();
    if (JSON.stringify(affected) !== JSON.stringify([...targetIds].sort())) {
      context.addIssue({ code: "custom", path: ["decisionImpact", "affectedConclusionIds"], message: "Decision impact must reference every configured review target" });
    }
    const review = record.decisionImpact;
    if (review.reviewStatus === "NOT_APPLICABLE" && targetIds.length > 0) {
      context.addIssue({ code: "custom", path: ["decisionImpact", "reviewStatus"], message: "A record with conclusion targets requires review" });
    }
    if (review.reviewStatus !== "NOT_APPLICABLE" && targetIds.length === 0) {
      context.addIssue({ code: "custom", path: ["decisionImpact", "reviewStatus"], message: "A record without conclusion targets cannot enter review" });
    }
    if (review.reviewStatus === "PENDING_REVIEW" && [review.selectedDisposition, review.reviewer, review.reviewNote, review.reviewedAt].some((value) => value !== null)) {
      context.addIssue({ code: "custom", path: ["decisionImpact", "reviewStatus"], message: "Pending review cannot contain a completed review decision" });
    }
    if (["APPROVED", "REJECTED"].includes(review.reviewStatus) && (!review.reviewer || !review.reviewNote || !review.reviewedAt)) {
      context.addIssue({ code: "custom", path: ["decisionImpact", "reviewStatus"], message: "Completed review requires reviewer, note and review time" });
    }
    if (review.reviewStatus === "APPROVED" && review.selectedDisposition === null) {
      context.addIssue({ code: "custom", path: ["decisionImpact", "selectedDisposition"], message: "Approved review requires a selected disposition" });
    }
    if (review.reviewStatus === "REJECTED" && review.selectedDisposition !== null) {
      context.addIssue({ code: "custom", path: ["decisionImpact", "selectedDisposition"], message: "Rejected review cannot select a conclusion disposition" });
    }
    if (review.reportUpdateApplied && (review.reviewStatus !== "APPROVED" || !review.publicationId || !review.reportUpdatedAt || review.rollbackId !== null || review.rolledBackAt !== null)) {
      context.addIssue({ code: "custom", path: ["decisionImpact", "reportUpdateApplied"], message: "Applied report update requires an approved review and publication record" });
    }
    const rolledBack = !review.reportUpdateApplied && review.rollbackId !== null && review.rolledBackAt !== null;
    if (rolledBack && (!review.publicationId || !review.reportUpdatedAt || review.reviewStatus !== "APPROVED")) {
      context.addIssue({ code: "custom", path: ["decisionImpact", "rollbackId"], message: "Rollback history requires its original approved publication" });
    }
    if (!review.reportUpdateApplied && !rolledBack && [review.publicationId, review.reportUpdatedAt, review.rollbackId, review.rolledBackAt].some((value) => value !== null)) {
      context.addIssue({ code: "custom", path: ["decisionImpact", "publicationId"], message: "Unapplied proposal cannot reference publication or rollback history" });
    }
  }
});

export const validationExecutionEventSchema = z.object({
  id: z.string().trim().min(6),
  at: z.iso.datetime(),
  action: z.enum(["STARTED", "COMPLETED_PASS", "COMPLETED_FAIL", "RETRY_STARTED", "REVIEW_APPROVED", "REVIEW_REJECTED", "REPORT_UPDATE_APPLIED", "REPORT_ROLLBACK_APPLIED"]),
  recordId: z.string().trim().min(6),
  attemptId: z.string().trim().min(6),
  summary: z.string().trim().min(5),
}).strict();

export const validationExecutionLedgerSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  generatedAt: z.iso.datetime(),
  title: z.literal("验证执行记录与证据回填"),
  globalFirstRecordId: z.string().trim().min(6),
  records: z.array(validationExecutionRecordSchema).min(1),
  events: z.array(validationExecutionEventSchema),
  metrics: z.object({
    total: z.number().int().positive(),
    ready: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    evidenceCount: z.number().int().nonnegative(),
  }).strict(),
  boundary: z.string().trim().min(20),
  boundaries: z.array(z.string().trim().min(12)).min(3),
}).strict();

export type ValidationExecutionRecord = z.infer<typeof validationExecutionRecordSchema>;
export type ValidationExecutionLedger = z.infer<typeof validationExecutionLedgerSchema>;
export type ValidationExecutionEvent = z.infer<typeof validationExecutionEventSchema>;

export type ValidationExecutionIssue = {
  code: string;
  message: string;
  recordId?: string;
};

export type ValidationExecutionValidationResult = {
  valid: boolean;
  errors: ValidationExecutionIssue[];
  warnings: ValidationExecutionIssue[];
};
