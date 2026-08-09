import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRunReport } from "../report/service";
import { readValidationExecutionLedger, validationExecutionPath, writeValidationExecutionLedger } from "./service";
import { applyValidationExecutionMutation } from "./transitions";
import { validateValidationExecutionLedger } from "./validation";

const runId = "research-run-3d-yoga-pants-28f8bff32ab5-us";
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const completion = (recordId: string, outcome: "pass" | "fail") => ({
  action: "complete" as const,
  recordId,
  outcome,
  actuals: {
    sampleSizeLabel: "12 名参与者",
    durationDays: 3,
    budgetAmount: 120,
    budgetCurrency: "USD",
    notes: "完成首轮有界验证。",
  },
  evidence: {
    kind: "response_set" as const,
    label: "概念选择原始记录",
    url: "/evidence/concept-responses",
    verified: true,
  },
  resultSummary: outcome === "pass" ? "达到预设通过标准。" : "未达到预设通过标准。",
  measuredValue: "58% 首选",
});

describe("验证执行状态转换与持久化", () => {
  it("开始验证后追加 attempt 和事件日志", async () => {
    const report = await buildRunReport(runId);
    const first = report.validationExecutionLedger.records[0];
    const next = applyValidationExecutionMutation(
      report.validationExecutionLedger,
      { action: "start", recordId: first.id },
      "2026-08-05T08:00:00.000Z",
    );

    expect(next.records[0].currentStatus).toBe("IN_PROGRESS");
    expect(next.records[0].attempts).toHaveLength(1);
    expect(next.events.map((event) => event.action)).toEqual(["STARTED"]);
    expect(next.metrics.inProgress).toBe(1);
    expect(validateValidationExecutionLedger(next).valid).toBe(true);
  });

  it("通过后保存实际值、证据，并只解锁下一步", async () => {
    const report = await buildRunReport(runId);
    const first = report.validationExecutionLedger.records[0];
    const started = applyValidationExecutionMutation(report.validationExecutionLedger, { action: "start", recordId: first.id }, "2026-08-05T08:00:00.000Z");
    const completed = applyValidationExecutionMutation(started, completion(first.id, "pass"), "2026-08-05T09:00:00.000Z");

    expect(completed.records.map((record) => record.currentStatus)).toEqual(["PASSED", "READY", "BLOCKED", "BLOCKED", "BLOCKED"]);
    expect(completed.records[0].attempts[0].actuals.budgetAmount).toBe(120);
    expect(completed.records[0].attempts[0].evidenceRefs).toHaveLength(1);
    expect(completed.records[0].decisionImpact?.automaticApproval).toBe(false);
    expect(completed.records[0].decisionImpact?.reviewStatus).toBe("PENDING_REVIEW");
    expect(completed.records[0].decisionImpact?.affectedConclusionIds).toEqual(
      completed.records[0].conclusionReviewTargets.map((target) => target.id),
    );
    expect(completed.records[0].decisionImpact?.reportUpdateApplied).toBe(false);
    expect(completed.events.map((event) => event.action)).toEqual(["STARTED", "COMPLETED_PASS"]);
  });

  it("人工批准结论处理方式后仍不自动改写正式报告", async () => {
    const report = await buildRunReport(runId);
    const first = report.validationExecutionLedger.records[0];
    const started = applyValidationExecutionMutation(report.validationExecutionLedger, { action: "start", recordId: first.id }, "2026-08-05T08:00:00.000Z");
    const completed = applyValidationExecutionMutation(started, completion(first.id, "pass"), "2026-08-05T09:00:00.000Z");
    const reviewed = applyValidationExecutionMutation(completed, {
      action: "review",
      recordId: first.id,
      decision: "approve",
      disposition: "REFINE",
      reviewer: "产品负责人",
      note: "证据达到概念测试标准，但仍需独立发布后才更新报告。",
    }, "2026-08-05T10:00:00.000Z");

    expect(reviewed.records[0].decisionImpact).toMatchObject({
      reviewStatus: "APPROVED",
      selectedDisposition: "REFINE",
      reviewer: "产品负责人",
      reportUpdateApplied: false,
      automaticApproval: false,
    });
    expect(reviewed.events.at(-1)?.action).toBe("REVIEW_APPROVED");
    expect(reviewed.records[1].currentStatus).toBe("READY");
  });

  it("失败后追加重试，旧失败 attempt 保持不变", async () => {
    const report = await buildRunReport(runId);
    const first = report.validationExecutionLedger.records[0];
    const started = applyValidationExecutionMutation(report.validationExecutionLedger, { action: "start", recordId: first.id }, "2026-08-05T08:00:00.000Z");
    const failed = applyValidationExecutionMutation(started, completion(first.id, "fail"), "2026-08-05T09:00:00.000Z");
    const retry = applyValidationExecutionMutation(failed, { action: "retry", recordId: first.id }, "2026-08-05T10:00:00.000Z");

    expect(retry.records[0].attempts.map((attempt) => attempt.status)).toEqual(["FAILED", "IN_PROGRESS"]);
    expect(retry.records[0].attempts[0].result?.outcome).toBe("fail");
    expect(retry.events.map((event) => event.action)).toEqual(["STARTED", "COMPLETED_FAIL", "RETRY_STARTED"]);
  });

  it("以独立 JSON 文件原子写入并重新读取", async () => {
    const report = await buildRunReport(runId);
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "xuanpinmao-validation-"));
    temporaryRoots.push(temporaryRoot);
    const first = report.validationExecutionLedger.records[0];
    const started = applyValidationExecutionMutation(report.validationExecutionLedger, { action: "start", recordId: first.id }, "2026-08-05T08:00:00.000Z");

    const file = await writeValidationExecutionLedger(started, temporaryRoot);
    const reread = await readValidationExecutionLedger(runId, report.validationExecutionLedger, temporaryRoot);

    expect(file).toBe(validationExecutionPath(runId, temporaryRoot));
    expect(JSON.parse(await readFile(file, "utf8")).events).toHaveLength(1);
    expect(reread.records[0].currentStatus).toBe("IN_PROGRESS");
  });
});
