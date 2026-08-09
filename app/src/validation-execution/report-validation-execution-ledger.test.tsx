import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRunReport } from "../report/service";
import { ReportValidationExecutionLedger } from "./report-validation-execution-ledger";
import { applyValidationExecutionMutation, markConclusionPublicationApplied } from "./transitions";

afterEach(() => vi.unstubAllGlobals());

describe("ReportValidationExecutionLedger", () => {
  it("明确区分规划值和尚未回填的实际值", async () => {
    const report = await buildRunReport("research-run-3d-yoga-pants-28f8bff32ab5-us");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ history: { schemaVersion: "1.0", runId: report.runId, currentGovernanceGeneratedAt: report.generatedAt, versions: [], metrics: { total: 0, active: 0, superseded: 0, rolledBack: 0 }, boundary: "当前没有正式发布版本，历史列表保持为空。" } }),
    }));
    render(<ReportValidationExecutionLedger ledger={report.validationExecutionLedger} />);

    expect(screen.getByText("验证做到哪一步了？")).toBeInTheDocument();
    expect(screen.getAllByText("规划值")).toHaveLength(5);
    expect(screen.getAllByText("实际值")).toHaveLength(5);
    expect(screen.getAllByText("尚未执行")).toHaveLength(5);
    expect(screen.getByText(/只有第一项处于“可以开始”/)).toBeInTheDocument();
    expect(screen.getAllByText("当前还没有实际执行记录。")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "开始这项验证" })).toBeInTheDocument();
    expect(screen.getByText(/尚无执行日志/)).toBeInTheDocument();
    expect(await screen.findByText(/尚无正式结论发布版本/)).toBeInTheDocument();
  });

  it("面向报告读者时隐藏审核、发布、回滚和事件日志", async () => {
    const report = await buildRunReport("research-run-3d-yoga-pants-28f8bff32ab5-us");
    render(
      <ReportValidationExecutionLedger
        ledger={report.validationExecutionLedger}
        showInternalControls={false}
      />,
    );

    expect(screen.getByText("验证做到哪一步了？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始这项验证" })).toBeInTheDocument();
    expect(screen.queryByText("完成后进入审核的结论")).not.toBeInTheDocument();
    expect(screen.queryByText("执行日志")).not.toBeInTheDocument();
    expect(screen.queryByText("结论版本中心")).not.toBeInTheDocument();
    expect(screen.queryByText("安全发布")).not.toBeInTheDocument();
  });

  it("可以从报告中开始第一项验证并切换到结果回填表单", async () => {
    const report = await buildRunReport("research-run-3d-yoga-pants-28f8bff32ab5-us");
    const first = report.validationExecutionLedger.records[0];
    const started = applyValidationExecutionMutation(
      report.validationExecutionLedger,
      { action: "start", recordId: first.id },
      "2026-08-05T08:00:00.000Z",
    );
    const fetchMock = vi.fn().mockImplementation(async (url: string) => url.includes("conclusion-history") ? {
      ok: true,
      json: async () => ({ history: { schemaVersion: "1.0", runId: report.runId, currentGovernanceGeneratedAt: report.generatedAt, versions: [], metrics: { total: 0, active: 0, superseded: 0, rolledBack: 0 }, boundary: "当前没有正式发布版本，历史列表保持为空。" } }),
    } : { ok: true, json: async () => ({ ledger: started }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReportValidationExecutionLedger ledger={report.validationExecutionLedger} />);

    await userEvent.click(screen.getByRole("button", { name: "开始这项验证" }));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/research/${report.runId}/validation-execution`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText("回填本次 attempt 的实际结果")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "记录为通过" })).toBeInTheDocument();
  });

  it("验证完成后展示受影响结论并记录人工审核，但不应用到正式报告", async () => {
    const report = await buildRunReport("research-run-3d-yoga-pants-28f8bff32ab5-us");
    const first = report.validationExecutionLedger.records[0];
    const started = applyValidationExecutionMutation(report.validationExecutionLedger, { action: "start", recordId: first.id }, "2026-08-05T08:00:00.000Z");
    const completed = applyValidationExecutionMutation(started, {
      action: "complete",
      recordId: first.id,
      outcome: "pass",
      actuals: { sampleSizeLabel: "12 名参与者", durationDays: 3, budgetAmount: 120, budgetCurrency: "USD", notes: "完成首轮测试。" },
      evidence: { kind: "response_set", label: "概念测试原始记录", url: "/evidence/concept", verified: true },
      resultSummary: "达到预设概念测试通过标准。",
      measuredValue: "58% 首选",
    }, "2026-08-05T09:00:00.000Z");
    const reviewed = applyValidationExecutionMutation(completed, {
      action: "review",
      recordId: first.id,
      decision: "approve",
      disposition: "REFINE",
      reviewer: "产品负责人",
      note: "批准修正提案，等待独立发布。",
    }, "2026-08-05T10:00:00.000Z");
    const fetchMock = vi.fn().mockImplementation(async (url: string) => url.includes("conclusion-history") ? {
      ok: true,
      json: async () => ({ history: { schemaVersion: "1.0", runId: report.runId, currentGovernanceGeneratedAt: report.generatedAt, versions: [], metrics: { total: 0, active: 0, superseded: 0, rolledBack: 0 }, boundary: "当前没有正式发布版本，历史列表保持为空。" } }),
    } : { ok: true, json: async () => ({ ledger: reviewed }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReportValidationExecutionLedger ledger={completed} />);

    expect(screen.getByText("结论更新提案")).toBeInTheDocument();
    expect(screen.getByText("等待人工审核")).toBeInTheDocument();
    expect(screen.getByText("12 名参与者 · 3 天 · USD 120")).toBeInTheDocument();
    expect(screen.getByText("达到预设概念测试通过标准。")).toBeInTheDocument();
    expect(screen.getAllByText(/CON-DIR-002/).length).toBeGreaterThan(0);
    await userEvent.type(screen.getByRole("textbox", { name: "审核人" }), "产品负责人");
    await userEvent.type(screen.getByRole("textbox", { name: "审核说明" }), "批准修正提案，等待独立发布。");
    await userEvent.click(screen.getByRole("button", { name: "保存人工审核" }));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/research/${report.runId}/validation-execution`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText("已批准 · 尚未应用")).toBeInTheDocument();
    expect(screen.getByText(/正式报告尚未更新/)).toBeInTheDocument();
    expect(screen.getByText("安全发布")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成发布差异预览" })).toBeInTheDocument();
  });

  it("版本中心展示当前版本并在回滚前生成差异预览", async () => {
    const report = await buildRunReport("research-run-3d-yoga-pants-28f8bff32ab5-us");
    const first = report.validationExecutionLedger.records[0];
    const started = applyValidationExecutionMutation(report.validationExecutionLedger, { action: "start", recordId: first.id }, "2026-08-05T08:00:00.000Z");
    const completed = applyValidationExecutionMutation(started, {
      action: "complete",
      recordId: first.id,
      outcome: "pass",
      actuals: { sampleSizeLabel: "12 名参与者", durationDays: 3, budgetAmount: 120, budgetCurrency: "USD", notes: "完成首轮测试。" },
      evidence: { kind: "response_set", label: "概念测试原始记录", url: "/evidence/concept", verified: true },
      resultSummary: "达到预设概念测试通过标准。",
      measuredValue: "58% 首选",
    }, "2026-08-05T09:00:00.000Z");
    const approved = applyValidationExecutionMutation(completed, { action: "review", recordId: first.id, decision: "approve", disposition: "REFINE", reviewer: "产品负责人", note: "批准修正并进入发布。" }, "2026-08-05T10:00:00.000Z");
    const published = markConclusionPublicationApplied(approved, first.id, "PUB-1-20260805110000", "2026-08-05T11:00:00.000Z");
    const target = first.conclusionReviewTargets[0];
    const diff = { oldConclusionId: target.id, newConclusionId: `${target.id}-P20260805110000`, topic: target.topic, relation: "refines", oldStatement: target.statement, newStatement: `${target.statement} 首轮验证已通过。`, oldEvidenceStatus: target.evidenceStatus, newEvidenceStatus: "directional", oldClaimBoundary: target.claimBoundary, newClaimBoundary: "概念偏好已验证，但样品性能仍未证明。", chapterIds: target.chapterIds };
    const history = { schemaVersion: "1.0", runId: report.runId, currentGovernanceGeneratedAt: "2026-08-05T11:00:00.000Z", versions: [{ publicationId: "PUB-1-20260805110000", recordId: first.id, appliedAt: "2026-08-05T11:00:00.000Z", status: "ACTIVE", rollbackEligible: true, disposition: "REFINE", affectedChapterIds: target.chapterIds, diffCount: 1, beforeGeneratedAt: report.generatedAt, afterGeneratedAt: "2026-08-05T11:00:00.000Z", rolledBackAt: null, rollbackId: null, diffs: [diff] }], metrics: { total: 1, active: 1, superseded: 0, rolledBack: 0 }, boundary: "只有当前最后一个正式发布版本可以进入回滚。" };
    const rollbackPreview = { schemaVersion: "1.0", rollbackId: "RBK-PUB-1-20260805110000-20260805120000", runId: report.runId, publicationId: "PUB-1-20260805110000", recordId: first.id, generatedAt: "2026-08-05T12:00:00.000Z", currentGovernanceGeneratedAt: "2026-08-05T11:00:00.000Z", restoreGovernanceGeneratedAt: report.generatedAt, confirmationPhrase: "确认回滚正式报告", diffs: [{ currentConclusionId: diff.newConclusionId, restoredConclusionId: diff.oldConclusionId, topic: diff.topic, currentStatement: diff.newStatement, restoredStatement: diff.oldStatement, chapterIds: diff.chapterIds }], consistencyValidation: { valid: true, errorCount: 0 }, boundaries: ["回滚保留发布历史和验证证据。", "只有当前最后一个版本可以回滚。", "写入失败会恢复回滚前状态。"] };
    const fetchMock = vi.fn().mockImplementation(async (_url: string, options?: { method?: string }) => options?.method === "POST"
      ? { ok: true, json: async () => ({ preview: rollbackPreview }) }
      : { ok: true, json: async () => ({ history }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReportValidationExecutionLedger ledger={published} />);

    const button = await screen.findByRole("button", { name: "生成回滚预览" });
    await userEvent.click(button);
    expect(await screen.findByText("回滚将恢复 1 条结论")).toBeInTheDocument();
    expect(screen.getByText("一致性预检通过")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认回滚并保留记录" })).toBeDisabled();
  });
});
