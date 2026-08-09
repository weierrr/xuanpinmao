import { z } from "zod";
import {
  validationExecutionLedgerSchema,
  type ValidationExecutionLedger,
  type ValidationExecutionRecord,
} from "./types";
import { validateValidationExecutionLedger } from "./validation";

const startMutationSchema = z.object({
  action: z.literal("start"),
  recordId: z.string().trim().min(6),
}).strict();

const retryMutationSchema = z.object({
  action: z.literal("retry"),
  recordId: z.string().trim().min(6),
}).strict();

const completeMutationSchema = z.object({
  action: z.literal("complete"),
  recordId: z.string().trim().min(6),
  outcome: z.enum(["pass", "fail"]),
  actuals: z.object({
    sampleSizeLabel: z.string().trim().min(1).nullable(),
    durationDays: z.number().int().nonnegative().nullable(),
    budgetAmount: z.number().nonnegative().nullable(),
    budgetCurrency: z.string().trim().min(3).nullable(),
    notes: z.string().trim().min(3).nullable(),
  }).strict(),
  evidence: z.object({
    kind: z.enum(["response_set", "supplier_document", "sample_record", "price_result", "cost_document", "other"]),
    label: z.string().trim().min(3),
    url: z.string().trim().min(1),
    verified: z.boolean(),
  }).strict(),
  resultSummary: z.string().trim().min(8),
  measuredValue: z.string().trim().min(1).nullable(),
}).strict().superRefine((input, context) => {
  if (input.actuals.budgetAmount !== null && input.actuals.budgetCurrency === null) {
    context.addIssue({ code: "custom", path: ["actuals", "budgetCurrency"], message: "Actual budget requires a currency" });
  }
});

const reviewMutationSchema = z.object({
  action: z.literal("review"),
  recordId: z.string().trim().min(6),
  decision: z.enum(["approve", "reject"]),
  disposition: z.enum(["RETAIN", "REFINE", "SUPERSEDE", "STOP"]).nullable(),
  reviewer: z.string().trim().min(2),
  note: z.string().trim().min(3),
}).strict().superRefine((input, context) => {
  if (input.decision === "approve" && input.disposition === null) {
    context.addIssue({ code: "custom", path: ["disposition"], message: "Approved review requires a disposition" });
  }
});

export const validationExecutionMutationSchema = z.discriminatedUnion("action", [
  startMutationSchema,
  retryMutationSchema,
  completeMutationSchema,
  reviewMutationSchema,
]);

export type ValidationExecutionMutation = z.infer<typeof validationExecutionMutationSchema>;

const statusLabel = (status: ValidationExecutionRecord["currentStatus"]): string => ({
  NOT_STARTED: "尚未开始",
  READY: "可以开始 · 尚未执行",
  BLOCKED: "等待前置步骤 · 尚未执行",
  IN_PROGRESS: "执行中",
  PASSED: "已通过",
  FAILED: "未通过 · 可重试",
})[status];

const withMetrics = (ledger: ValidationExecutionLedger): ValidationExecutionLedger => ({
  ...ledger,
  metrics: {
    total: ledger.records.length,
    ready: ledger.records.filter((record) => record.currentStatus === "READY").length,
    blocked: ledger.records.filter((record) => record.currentStatus === "BLOCKED").length,
    inProgress: ledger.records.filter((record) => record.currentStatus === "IN_PROGRESS").length,
    passed: ledger.records.filter((record) => record.currentStatus === "PASSED").length,
    failed: ledger.records.filter((record) => record.currentStatus === "FAILED").length,
    evidenceCount: ledger.records.flatMap((record) => record.attempts.flatMap((attempt) => attempt.evidenceRefs)).length,
  },
});

const unlockEligibleRecords = (records: ValidationExecutionRecord[]): ValidationExecutionRecord[] => {
  const statusByActionId = new Map(records.map((record) => [record.sourceActionId, record.currentStatus]));
  return records.map((record) => {
    if (record.currentStatus !== "BLOCKED") return record;
    const ready = record.dependencyActionIds.every((actionId) => statusByActionId.get(actionId) === "PASSED");
    return ready ? { ...record, currentStatus: "READY" as const, currentStatusLabel: statusLabel("READY") } : record;
  });
};

const recommendedDisposition = (
  record: ValidationExecutionRecord,
  outcome: "pass" | "fail",
): "RETAIN" | "REFINE" | "SUPERSEDE" | "STOP" => {
  if (outcome === "pass") return "REFINE";
  return ["concept_test", "sample_test"].includes(record.validationType) ? "STOP" : "REFINE";
};

export const applyValidationExecutionMutation = (
  current: ValidationExecutionLedger,
  rawMutation: unknown,
  now = new Date().toISOString(),
): ValidationExecutionLedger => {
  const mutation = validationExecutionMutationSchema.parse(rawMutation);
  const target = current.records.find((record) => record.id === mutation.recordId);
  if (!target) throw new Error("Validation execution record not found");

  const nextAttemptNumber = target.attempts.length + 1;
  const attemptId = `attempt:${target.id}:${nextAttemptNumber}`;
  let eventAttemptId = attemptId;
  let eventAction: "STARTED" | "COMPLETED_PASS" | "COMPLETED_FAIL" | "RETRY_STARTED" | "REVIEW_APPROVED" | "REVIEW_REJECTED";
  let eventSummary: string;
  let nextRecords: ValidationExecutionRecord[];

  if (mutation.action === "review") {
    if (!["PASSED", "FAILED"].includes(target.currentStatus) || !target.decisionImpact) {
      throw new Error("Only a completed validation with a review proposal can be reviewed");
    }
    if (target.decisionImpact.reviewStatus !== "PENDING_REVIEW") {
      throw new Error("Only a pending conclusion proposal can be reviewed");
    }
    if (target.conclusionReviewTargets.length === 0) {
      throw new Error("Validation has no governed conclusion targets");
    }
    const activeAttempt = target.attempts.at(-1);
    if (!activeAttempt) throw new Error("Completed validation attempt not found");
    eventAttemptId = activeAttempt.id;
    const approved = mutation.decision === "approve";
    const nextTarget: ValidationExecutionRecord = {
      ...target,
      decisionImpact: {
        ...target.decisionImpact,
        reviewStatus: approved ? "APPROVED" : "REJECTED",
        selectedDisposition: approved ? mutation.disposition : null,
        reviewer: mutation.reviewer,
        reviewNote: mutation.note,
        reviewedAt: now,
      },
    };
    nextRecords = current.records.map((record) => record.id === target.id ? nextTarget : record);
    eventAction = approved ? "REVIEW_APPROVED" : "REVIEW_REJECTED";
    eventSummary = approved
      ? `人工批准结论处理提案：${target.title}`
      : `人工驳回结论处理提案：${target.title}`;
  } else if (mutation.action === "start" || mutation.action === "retry") {
    const expectedStatus = mutation.action === "start" ? "READY" : "FAILED";
    if (target.currentStatus !== expectedStatus) {
      throw new Error(mutation.action === "start" ? "Only a ready validation can start" : "Only a failed validation can retry");
    }
    const nextTarget: ValidationExecutionRecord = {
      ...target,
      currentStatus: "IN_PROGRESS",
      currentStatusLabel: statusLabel("IN_PROGRESS"),
      attempts: [...target.attempts, {
        id: attemptId,
        attemptNumber: nextAttemptNumber,
        status: "IN_PROGRESS",
        startedAt: now,
        completedAt: null,
        actuals: {
          sampleSizeLabel: null,
          durationDays: null,
          budgetAmount: null,
          budgetCurrency: null,
          notes: null,
        },
        evidenceRefs: [],
        result: null,
      }],
      decisionImpact: null,
    };
    nextRecords = current.records.map((record) => record.id === target.id ? nextTarget : record);
    eventAction = mutation.action === "start" ? "STARTED" : "RETRY_STARTED";
    eventSummary = mutation.action === "start" ? `开始执行：${target.title}` : `开始第 ${nextAttemptNumber} 次尝试：${target.title}`;
  } else {
    if (target.currentStatus !== "IN_PROGRESS") throw new Error("Only an in-progress validation can complete");
    const activeAttempt = target.attempts.at(-1);
    if (!activeAttempt || activeAttempt.status !== "IN_PROGRESS") throw new Error("Active validation attempt not found");
    const completedStatus = mutation.outcome === "pass" ? "PASSED" : "FAILED";
    const disposition = recommendedDisposition(target, mutation.outcome);
    eventAttemptId = activeAttempt.id;
    const completedAttempt: ValidationExecutionRecord["attempts"][number] = {
      ...activeAttempt,
      status: completedStatus,
      completedAt: now,
      actuals: mutation.actuals,
      evidenceRefs: [{
        id: `evidence:${target.id}:${activeAttempt.attemptNumber}:1`,
        kind: mutation.evidence.kind,
        label: mutation.evidence.label,
        url: mutation.evidence.url,
        recordedAt: now,
        verified: mutation.evidence.verified,
      }],
      result: {
        outcome: mutation.outcome,
        summary: mutation.resultSummary,
        measuredValue: mutation.measuredValue,
      },
    };
    const nextTarget: ValidationExecutionRecord = {
      ...target,
      currentStatus: completedStatus,
      currentStatusLabel: statusLabel(completedStatus),
      attempts: target.attempts.map((attempt) => attempt.id === activeAttempt.id ? completedAttempt : attempt),
      decisionImpact: {
        currentDecisionUnchanged: true,
        affectedConclusionIds: target.conclusionReviewTargets.map((conclusion) => conclusion.id),
        proposedChanges: target.conclusionReviewTargets.length === 0
          ? ["当前 Run 没有结论治理注册表，本次结果只保留为执行证据。"]
          : target.conclusionReviewTargets.map((conclusion) => `${conclusion.id}：审核“${conclusion.statement}”是否需要保留、修正、覆盖或停止。`),
        proposalSummary: target.conclusionReviewTargets.length === 0
          ? "本次验证没有可自动映射的正式结论，不能生成更新提案。"
          : mutation.outcome === "pass"
            ? `本次结果达到通过标准，建议以“${disposition}”为默认方案审核 ${target.conclusionReviewTargets.length} 条结论。`
            : `本次结果未达到通过标准，建议以“${disposition}”为默认方案审核 ${target.conclusionReviewTargets.length} 条结论。`,
        recommendedDisposition: disposition,
        reviewStatus: target.conclusionReviewTargets.length > 0 ? "PENDING_REVIEW" : "NOT_APPLICABLE",
        selectedDisposition: null,
        reviewer: null,
        reviewNote: null,
        reviewedAt: null,
        automaticApproval: false,
        reportUpdateApplied: false,
        publicationId: null,
        reportUpdatedAt: null,
        rollbackId: null,
        rolledBackAt: null,
      },
    };
    nextRecords = current.records.map((record) => record.id === target.id ? nextTarget : record);
    if (mutation.outcome === "pass") nextRecords = unlockEligibleRecords(nextRecords);
    eventAction = mutation.outcome === "pass" ? "COMPLETED_PASS" : "COMPLETED_FAIL";
    eventSummary = mutation.outcome === "pass" ? `验证通过：${target.title}` : `验证未通过：${target.title}`;
  }

  const next = withMetrics(validationExecutionLedgerSchema.parse({
    ...current,
    generatedAt: now,
    records: nextRecords,
    events: [...current.events, {
      id: `event:${target.id}:${current.events.length + 1}`,
      at: now,
      action: eventAction,
      recordId: target.id,
      attemptId: eventAttemptId,
      summary: eventSummary,
    }],
  }));
  const parsed = validationExecutionLedgerSchema.parse(next);
  const validation = validateValidationExecutionLedger(parsed);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  return parsed;
};

export const markConclusionPublicationApplied = (
  current: ValidationExecutionLedger,
  recordId: string,
  publicationId: string,
  now = new Date().toISOString(),
): ValidationExecutionLedger => {
  const target = current.records.find((record) => record.id === recordId);
  if (!target?.decisionImpact || target.decisionImpact.reviewStatus !== "APPROVED") {
    throw new Error("Only an approved conclusion proposal can be published");
  }
  if (target.decisionImpact.reportUpdateApplied) throw new Error("Conclusion proposal has already been published");
  const attempt = target.attempts.at(-1);
  if (!attempt) throw new Error("Published conclusion proposal requires a completed attempt");
  const next = withMetrics(validationExecutionLedgerSchema.parse({
    ...current,
    generatedAt: now,
    records: current.records.map((record) => record.id === recordId ? {
      ...record,
      decisionImpact: {
        ...target.decisionImpact,
        currentDecisionUnchanged: false,
        reportUpdateApplied: true,
        publicationId,
        reportUpdatedAt: now,
        rollbackId: null,
        rolledBackAt: null,
      },
    } : record),
    events: [...current.events, {
      id: `event:${target.id}:${current.events.length + 1}`,
      at: now,
      action: "REPORT_UPDATE_APPLIED",
      recordId: target.id,
      attemptId: attempt.id,
      summary: `正式报告结论已通过发布记录更新：${target.title}`,
    }],
  }));
  const validation = validateValidationExecutionLedger(next);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  return next;
};

export const markConclusionPublicationRolledBack = (
  current: ValidationExecutionLedger,
  recordId: string,
  publicationId: string,
  rollbackId: string,
  now = new Date().toISOString(),
): ValidationExecutionLedger => {
  const target = current.records.find((record) => record.id === recordId);
  const impact = target?.decisionImpact;
  if (!target || !impact || !impact.reportUpdateApplied || impact.publicationId !== publicationId) {
    throw new Error("Only the currently applied conclusion publication can be rolled back");
  }
  const attempt = target.attempts.at(-1);
  if (!attempt) throw new Error("Conclusion rollback requires the original completed attempt");
  const next = withMetrics(validationExecutionLedgerSchema.parse({
    ...current,
    generatedAt: now,
    records: current.records.map((record) => record.id === recordId ? {
      ...record,
      decisionImpact: {
        ...impact,
        currentDecisionUnchanged: true,
        reportUpdateApplied: false,
        rollbackId,
        rolledBackAt: now,
      },
    } : record),
    events: [...current.events, {
      id: `event:${target.id}:${current.events.length + 1}`,
      at: now,
      action: "REPORT_ROLLBACK_APPLIED",
      recordId: target.id,
      attemptId: attempt.id,
      summary: `正式报告已回滚到发布前版本：${publicationId}`,
    }],
  }));
  const validation = validateValidationExecutionLedger(next);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  return next;
};
