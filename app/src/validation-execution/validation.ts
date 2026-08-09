import type {
  ValidationExecutionIssue,
  ValidationExecutionLedger,
  ValidationExecutionValidationResult,
} from "./types";

export const validateValidationExecutionLedger = (
  ledger: ValidationExecutionLedger,
): ValidationExecutionValidationResult => {
  const errors: ValidationExecutionIssue[] = [];
  const warnings: ValidationExecutionIssue[] = [];
  const recordIds = new Set<string>();
  const actionIds = new Set<string>();
  const attemptIds = new Set<string>();
  const statusByActionId = new Map(ledger.records.map((record) => [record.sourceActionId, record.currentStatus]));

  for (const [index, record] of ledger.records.entries()) {
    if (recordIds.has(record.id)) errors.push({ code: "DUPLICATE_RECORD", message: "验证执行记录 ID 重复。", recordId: record.id });
    if (actionIds.has(record.sourceActionId)) errors.push({ code: "DUPLICATE_ACTION_RECORD", message: "同一主线任务不能有两条当前执行记录。", recordId: record.id });
    recordIds.add(record.id);
    actionIds.add(record.sourceActionId);
    if (record.runId !== ledger.runId) errors.push({ code: "RUN_MISMATCH", message: "执行记录必须属于当前报告 Run。", recordId: record.id });
    if (record.order !== index + 1) errors.push({ code: "INVALID_ORDER", message: "验证执行记录必须按主线顺序排列。", recordId: record.id });

    const attemptNumbers = record.attempts.map((attempt) => attempt.attemptNumber);
    record.attempts.forEach((attempt) => attemptIds.add(attempt.id));
    if (attemptNumbers.some((attemptNumber, attemptIndex) => attemptNumber !== attemptIndex + 1)) {
      errors.push({ code: "INVALID_ATTEMPT_HISTORY", message: "执行尝试必须连续追加，不能覆盖或跳号。", recordId: record.id });
    }
    if (record.attempts.slice(0, -1).some((attempt) => attempt.status === "IN_PROGRESS")) {
      errors.push({ code: "STALE_IN_PROGRESS_ATTEMPT", message: "只有最后一次尝试可以处于执行中。", recordId: record.id });
    }

    const dependenciesPassed = record.dependencyActionIds.every((actionId) => statusByActionId.get(actionId) === "PASSED");
    if (["READY", "IN_PROGRESS", "PASSED"].includes(record.currentStatus) && !dependenciesPassed) {
      errors.push({ code: "DEPENDENCY_NOT_PASSED", message: "前置验证未通过，当前任务不能开始或通过。", recordId: record.id });
    }
    if (record.currentStatus === "BLOCKED" && dependenciesPassed) {
      warnings.push({ code: "BLOCK_CAN_BE_RELEASED", message: "前置验证均已通过，该任务可以解除阻塞。", recordId: record.id });
    }
  }

  const eventIds = new Set<string>();
  for (const event of ledger.events) {
    if (eventIds.has(event.id)) errors.push({ code: "DUPLICATE_EVENT", message: "执行事件日志 ID 重复。", recordId: event.recordId });
    eventIds.add(event.id);
    if (!recordIds.has(event.recordId) || !attemptIds.has(event.attemptId)) {
      errors.push({ code: "BROKEN_EVENT_REFERENCE", message: "执行事件引用了不存在的记录或 attempt。", recordId: event.recordId });
    }
  }

  const activeRecords = ledger.records.filter((record) => ["READY", "IN_PROGRESS"].includes(record.currentStatus));
  if (activeRecords.length > 1) errors.push({ code: "MULTIPLE_ACTIVE_MAINLINE_STEPS", message: "主线同时只能有一个可执行或执行中的任务。" });
  if (ledger.records.find((record) => record.id === ledger.globalFirstRecordId)?.order !== 1) {
    errors.push({ code: "INVALID_GLOBAL_FIRST_RECORD", message: "全局第一步必须对应主线第一条执行记录。" });
  }

  const metrics = {
    total: ledger.records.length,
    ready: ledger.records.filter((record) => record.currentStatus === "READY").length,
    blocked: ledger.records.filter((record) => record.currentStatus === "BLOCKED").length,
    inProgress: ledger.records.filter((record) => record.currentStatus === "IN_PROGRESS").length,
    passed: ledger.records.filter((record) => record.currentStatus === "PASSED").length,
    failed: ledger.records.filter((record) => record.currentStatus === "FAILED").length,
    evidenceCount: ledger.records.flatMap((record) => record.attempts.flatMap((attempt) => attempt.evidenceRefs)).length,
  };
  if (JSON.stringify(metrics) !== JSON.stringify(ledger.metrics)) {
    errors.push({ code: "METRICS_MISMATCH", message: "执行进度汇总与记录明细不一致。" });
  }

  return { valid: errors.length === 0, errors, warnings };
};
