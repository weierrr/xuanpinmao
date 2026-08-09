import { describe, expect, it } from "vitest";
import { buildRunReport } from "../report/service";
import { validationExecutionLedgerSchema, validationExecutionRecordSchema } from "./types";
import { validateValidationExecutionLedger } from "./validation";

const runId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

describe("验证执行记录与证据回填", () => {
  it("初始状态只有第一项可以开始，其余任务等待前置步骤", async () => {
    const report = await buildRunReport(runId);
    const ledger = report.validationExecutionLedger;

    expect(ledger.records.map((record) => record.currentStatus)).toEqual([
      "READY",
      "BLOCKED",
      "BLOCKED",
      "BLOCKED",
      "BLOCKED",
    ]);
    expect(ledger.metrics).toEqual({
      total: 5,
      ready: 1,
      blocked: 4,
      inProgress: 0,
      passed: 0,
      failed: 0,
      evidenceCount: 0,
    });
    expect(ledger.records.every((record) => record.attempts.length === 0)).toBe(true);
    expect(ledger.records[0].conclusionReviewTargets.map((target) => target.id)).toEqual(expect.arrayContaining([
      "CON-DIR-002",
      "CON-CORE-001",
      "CON-CUSTOMER-001",
      "CON-SCENARIO-001",
      "CON-MARKETING-001",
      "CON-RATIONALE-001",
    ]));
    expect(validateValidationExecutionLedger(ledger).valid).toBe(true);
  });

  it("没有证据和完成时间的任务不能标记通过", async () => {
    const report = await buildRunReport(runId);
    const record = report.validationExecutionLedger.records[0];
    const invalid = {
      ...record,
      currentStatus: "PASSED" as const,
      currentStatusLabel: "已通过",
      attempts: [{
        id: "attempt:1",
        attemptNumber: 1,
        status: "PASSED" as const,
        startedAt: report.generatedAt,
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
    };

    expect(validationExecutionRecordSchema.safeParse(invalid).success).toBe(false);
  });

  it("失败记录通过追加 attempt 保留，重试不能覆盖旧失败", async () => {
    const report = await buildRunReport(runId);
    const record = report.validationExecutionLedger.records[0];
    const withRetry = {
      ...record,
      currentStatus: "IN_PROGRESS" as const,
      currentStatusLabel: "执行中",
      attempts: [
        {
          id: "attempt:failed:1",
          attemptNumber: 1,
          status: "FAILED" as const,
          startedAt: "2026-08-05T01:00:00.000Z",
          completedAt: "2026-08-05T02:00:00.000Z",
          actuals: {
            sampleSizeLabel: "4 名参与者",
            durationDays: 1,
            budgetAmount: 0,
            budgetCurrency: "USD",
            notes: "招募样本不足，未达到计划范围。",
          },
          evidenceRefs: [{
            id: "evidence:failed:1",
            kind: "response_set" as const,
            label: "首轮概念反馈记录",
            url: "/evidence/concept-attempt-1",
            recordedAt: "2026-08-05T02:00:00.000Z",
            verified: false,
          }],
          result: { outcome: "fail" as const, summary: "样本不足，首轮验证失败。", measuredValue: "4 responses" },
        },
        {
          id: "attempt:retry:2",
          attemptNumber: 2,
          status: "IN_PROGRESS" as const,
          startedAt: "2026-08-05T03:00:00.000Z",
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
        },
      ],
    };

    const parsed = validationExecutionRecordSchema.safeParse(withRetry);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.attempts.map((attempt) => attempt.status)).toEqual(["FAILED", "IN_PROGRESS"]);
  });

  it("前置任务没有通过时，后续任务不能被设为 READY", async () => {
    const report = await buildRunReport(runId);
    const ledger = report.validationExecutionLedger;
    const invalid = validationExecutionLedgerSchema.parse({
      ...ledger,
      records: ledger.records.map((record, index) => index === 1 ? {
        ...record,
        currentStatus: "READY",
        currentStatusLabel: "可以开始 · 尚未执行",
      } : record),
      metrics: { ...ledger.metrics, ready: 2, blocked: 3 },
    });

    expect(validateValidationExecutionLedger(invalid).errors.map((issue) => issue.code)).toContain("DEPENDENCY_NOT_PASSED");
    expect(validateValidationExecutionLedger(invalid).errors.map((issue) => issue.code)).toContain("MULTIPLE_ACTIVE_MAINLINE_STEPS");
  });
});
