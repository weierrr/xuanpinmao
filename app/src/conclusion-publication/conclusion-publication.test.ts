import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { conclusionGovernancePath } from "../conclusion-governance/service";
import { conclusionGovernanceArtifactSchema } from "../conclusion-governance/types";
import { validateConclusionGovernance } from "../conclusion-governance/validation";
import { buildRunReport } from "../report/service";
import { applyValidationExecutionMutation } from "../validation-execution/transitions";
import { buildConclusionPublicationPreview } from "./builder";
import {
  buildConclusionRollbackPreview,
  readConclusionVersionHistory,
  rollbackConclusionPublication,
} from "./history";
import { conclusionPublicationDirectory, publishApprovedConclusionProposal } from "./service";

const runId = "research-run-3d-yoga-pants-28f8bff32ab5-us";
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const approvedLedger = async () => {
  const report = await buildRunReport(runId);
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
  return applyValidationExecutionMutation(completed, {
    action: "review",
    recordId: first.id,
    decision: "approve",
    disposition: "REFINE",
    reviewer: "产品负责人",
    note: "批准修正提案，进入安全发布预览。",
  }, "2026-08-05T10:00:00.000Z");
};

describe("结论安全发布", () => {
  it("生成逐条差异预览并通过跨章节一致性验证", async () => {
    const ledger = await approvedLedger();
    const artifact = conclusionGovernanceArtifactSchema.parse(JSON.parse(await readFile(conclusionGovernancePath(runId), "utf8")) as unknown);
    const record = ledger.records[0];
    const drafts = record.conclusionReviewTargets.map((target) => ({
      conclusionId: target.id,
      statement: `${target.statement} 首轮概念验证已通过，仍需后续样品验证。`,
      rationale: "基于真实概念测试结果和人工批准提案进行受控修正。",
      claimBoundary: "概念偏好已经通过首轮测试，但目标样品性能、价格和单位经济仍未证明。",
      evidenceStatus: "directional" as const,
    }));
    const result = buildConclusionPublicationPreview({ artifact, ledger, recordId: record.id, drafts, now: "2026-08-05T11:00:00.000Z" });

    expect(result.preview.diffs).toHaveLength(record.conclusionReviewTargets.length);
    expect(result.preview.affectedChapterIds).toContain("summary");
    expect(result.preview.consistencyValidation.valid).toBe(true);
    expect(validateConclusionGovernance(result.nextArtifact, { reportRunId: runId, product: artifact.product, market: artifact.market }).valid).toBe(true);
  });

  it("二次确认后原子发布、保存回滚点并标记执行台账", async () => {
    const ledger = await approvedLedger();
    const artifact = conclusionGovernanceArtifactSchema.parse(JSON.parse(await readFile(conclusionGovernancePath(runId), "utf8")) as unknown);
    const record = ledger.records[0];
    const drafts = record.conclusionReviewTargets.map((target) => ({
      conclusionId: target.id,
      statement: `${target.statement} 首轮概念验证已通过，仍需后续样品验证。`,
      rationale: "基于真实概念测试结果和人工批准提案进行受控修正。",
      claimBoundary: "概念偏好已经通过首轮测试，但目标样品性能、价格和单位经济仍未证明。",
      evidenceStatus: "directional" as const,
    }));
    const root = await mkdtemp(path.join(os.tmpdir(), "xuanpinmao-publication-"));
    temporaryRoots.push(root);
    const governanceFile = conclusionGovernancePath(runId, root);
    await mkdir(path.dirname(governanceFile), { recursive: true });
    await writeFile(governanceFile, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

    const result = await publishApprovedConclusionProposal({
      artifact,
      ledger,
      recordId: record.id,
      drafts,
      expectedGovernanceGeneratedAt: artifact.generated_at,
      confirmationPhrase: "确认发布到正式报告",
      now: "2026-08-05T11:00:00.000Z",
      root,
    });

    const published = conclusionGovernanceArtifactSchema.parse(JSON.parse(await readFile(governanceFile, "utf8")) as unknown);
    const publicationDirectory = conclusionPublicationDirectory(runId, result.preview.publicationId, root);
    expect(published.generated_at).toBe("2026-08-05T11:00:00.000Z");
    expect(published.conclusions.filter((item) => item.status === "current").some((item) => item.id.endsWith("P20260805110000"))).toBe(true);
    expect(result.nextLedger.records[0].decisionImpact).toMatchObject({ reportUpdateApplied: true, publicationId: result.preview.publicationId });
    expect(JSON.parse(await readFile(path.join(publicationDirectory, "manifest.json"), "utf8")).status).toBe("APPLIED");
    expect(JSON.parse(await readFile(path.join(publicationDirectory, "before.json"), "utf8")).generated_at).toBe(artifact.generated_at);

    const history = await readConclusionVersionHistory({ runId, currentArtifact: result.nextArtifact, root });
    expect(history.metrics).toEqual({ total: 1, active: 1, superseded: 0, rolledBack: 0 });
    expect(history.versions[0]).toMatchObject({ publicationId: result.preview.publicationId, status: "ACTIVE", rollbackEligible: true });

    const rollbackPreview = await buildConclusionRollbackPreview({
      runId,
      publicationId: result.preview.publicationId,
      currentArtifact: result.nextArtifact,
      ledger: result.nextLedger,
      now: "2026-08-05T12:00:00.000Z",
      root,
    });
    expect(rollbackPreview.preview.diffs).toHaveLength(result.preview.diffs.length);
    expect(rollbackPreview.preview.consistencyValidation.valid).toBe(true);

    const rollback = await rollbackConclusionPublication({
      runId,
      publicationId: result.preview.publicationId,
      currentArtifact: result.nextArtifact,
      ledger: result.nextLedger,
      confirmationPhrase: "确认回滚正式报告",
      now: "2026-08-05T12:00:00.000Z",
      root,
    });
    const restored = conclusionGovernanceArtifactSchema.parse(JSON.parse(await readFile(governanceFile, "utf8")) as unknown);
    expect(restored).toEqual(artifact);
    expect(rollback.nextLedger.records[0].decisionImpact).toMatchObject({
      reportUpdateApplied: false,
      publicationId: result.preview.publicationId,
      rollbackId: rollback.preview.rollbackId,
      rolledBackAt: "2026-08-05T12:00:00.000Z",
    });
    const rolledBackHistory = await readConclusionVersionHistory({ runId, currentArtifact: restored, root });
    expect(rolledBackHistory.metrics).toEqual({ total: 1, active: 0, superseded: 0, rolledBack: 1 });
    expect(rolledBackHistory.versions[0]).toMatchObject({ status: "ROLLED_BACK", rollbackEligible: false });
  });

  it("注册表版本变化后拒绝发布", async () => {
    const ledger = await approvedLedger();
    const artifact = conclusionGovernanceArtifactSchema.parse(JSON.parse(await readFile(conclusionGovernancePath(runId), "utf8")) as unknown);
    const record = ledger.records[0];
    const drafts = record.conclusionReviewTargets.map((target) => ({
      conclusionId: target.id,
      statement: target.statement,
      rationale: "基于真实验证结果和人工审核决定更新。",
      claimBoundary: target.claimBoundary,
      evidenceStatus: target.evidenceStatus,
    }));
    const root = await mkdtemp(path.join(os.tmpdir(), "xuanpinmao-publication-stale-"));
    temporaryRoots.push(root);
    const governanceFile = conclusionGovernancePath(runId, root);
    await mkdir(path.dirname(governanceFile), { recursive: true });
    await writeFile(governanceFile, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

    await expect(publishApprovedConclusionProposal({
      artifact,
      ledger,
      recordId: record.id,
      drafts,
      expectedGovernanceGeneratedAt: "2026-08-01T00:00:00.000Z",
      confirmationPhrase: "确认发布到正式报告",
      root,
    })).rejects.toThrow(/changed after preview/);
  });

  it("不存在的发布版本不能进入回滚预览", async () => {
    const ledger = await approvedLedger();
    const artifact = conclusionGovernanceArtifactSchema.parse(JSON.parse(await readFile(conclusionGovernancePath(runId), "utf8")) as unknown);
    const root = await mkdtemp(path.join(os.tmpdir(), "xuanpinmao-missing-version-"));
    temporaryRoots.push(root);

    await expect(buildConclusionRollbackPreview({
      runId,
      publicationId: "PUB-NOT-EXISTS",
      currentArtifact: artifact,
      ledger,
      root,
    })).rejects.toThrow(/version not found/);
  });
});
