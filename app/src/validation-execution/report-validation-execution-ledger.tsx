"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import { ClipboardCheck, FileSearch, LockKeyhole, Play, ShieldAlert } from "lucide-react";
import type {
  ConclusionPublicationDraft,
  ConclusionPublicationPreview,
  ConclusionRollbackPreview,
  ConclusionVersionHistory,
} from "../conclusion-publication/types";
import type { ValidationExecutionLedger, ValidationExecutionRecord } from "./types";

const plannedBudgetLabelZh = (value: string): string => {
  const exact: Record<string, string> = {
    "USD 250": "不超过 250 美元",
    "USD 0 before sample purchase": "付款前 0 美元（暂不购买样品）",
    "USD 450 including samples and local test handling": "不超过 450 美元（含样品和本地测试）",
    "USD 150": "不超过 150 美元",
    "USD 0 analysis cost": "分析成本 0 美元",
  };
  return exact[value] ?? value.replace(/^USD\s+/u, "").replace(/^(\d+(?:\.\d+)?)$/u, "不超过 $1 美元");
};

const executionStatusMeta = {
  NOT_STARTED: { label: "尚未开始", className: "not-started", icon: LockKeyhole },
  READY: { label: "可以开始", className: "ready", icon: Play },
  BLOCKED: { label: "等待前置步骤", className: "blocked", icon: LockKeyhole },
  IN_PROGRESS: { label: "执行中", className: "in-progress", icon: Play },
  PASSED: { label: "已通过", className: "passed", icon: ClipboardCheck },
  FAILED: { label: "未通过", className: "failed", icon: ShieldAlert },
} as const;

type MutationPayload = Record<string, unknown> & { action: "start" | "retry" | "complete" | "review"; recordId: string };

const dispositionLabel = {
  RETAIN: "保留当前结论",
  REFINE: "修正当前结论",
  SUPERSEDE: "用新结论覆盖",
  STOP: "停止当前方向",
} as const;

const conclusionTopicLabel: Record<string, string> = {
  product_direction: "产品方向",
  core_value: "核心价值",
  target_customer: "目标人群",
  target_scenario: "触发场景",
  product_concept: "产品构想",
  evidence_strength: "证据强度",
  recommendation_rationale: "推荐理由",
  marketing_value_proposition: "营销主张",
  decision_boundary: "行动边界",
};

function CompletionForm({
  record,
  busy,
  onSubmit,
}: Readonly<{
  record: ValidationExecutionRecord;
  busy: boolean;
  onSubmit: (payload: MutationPayload) => Promise<void>;
}>) {
  const [outcome, setOutcome] = useState<"pass" | "fail">("pass");

  const submit = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const textValue = (name: string, fallback = "") => {
      const value = data.get(name);
      return typeof value === "string" ? value : fallback;
    };
    const nullableText = (name: string) => {
      const value = textValue(name).trim();
      return value.length > 0 ? value : null;
    };
    const nullableNumber = (name: string) => {
      const value = textValue(name).trim();
      return value.length > 0 ? Number(value) : null;
    };
    const budgetAmount = nullableNumber("budgetAmount");
    await onSubmit({
      action: "complete",
      recordId: record.id,
      outcome,
      actuals: {
        sampleSizeLabel: nullableText("sampleSizeLabel"),
        durationDays: nullableNumber("durationDays"),
        budgetAmount,
        budgetCurrency: budgetAmount === null ? null : textValue("budgetCurrency", "USD"),
        notes: nullableText("notes"),
      },
      evidence: {
        kind: textValue("evidenceKind", "other"),
        label: textValue("evidenceLabel").trim(),
        url: textValue("evidenceUrl").trim(),
        verified: data.get("evidenceVerified") === "on",
      },
      resultSummary: textValue("resultSummary").trim(),
      measuredValue: nullableText("measuredValue"),
    });
  };

  return (
    <form className="report-validation-completion-form" onSubmit={submit}>
      <header>
        <div><span>正在执行</span><strong>回填本次 attempt 的实际结果</strong></div>
        <label>
          结果
          <select value={outcome} onChange={(event) => setOutcome(event.target.value as "pass" | "fail")}>
            <option value="pass">通过</option>
            <option value="fail">失败</option>
          </select>
        </label>
      </header>
      <div className="report-validation-form-grid">
        <label>实际样本<input name="sampleSizeLabel" placeholder="例如：12 名参与者" /></label>
        <label>实际周期（天）<input min="0" name="durationDays" step="1" type="number" /></label>
        <label>实际预算<input min="0" name="budgetAmount" step="0.01" type="number" /></label>
        <label>币种<input defaultValue="USD" maxLength={3} name="budgetCurrency" /></label>
        <label>证据类型
          <select name="evidenceKind">
            <option value="response_set">用户响应记录</option>
            <option value="supplier_document">供应商文件</option>
            <option value="sample_record">样品测试记录</option>
            <option value="price_result">价格测试结果</option>
            <option value="cost_document">成本文件</option>
            <option value="other">其他证据</option>
          </select>
        </label>
        <label>证据名称<input name="evidenceLabel" placeholder="原始记录或证明文件名称" required /></label>
        <label className="wide">证据链接或本地索引<input name="evidenceUrl" placeholder="https://… 或 /evidence/…" required /></label>
        <label className="wide">结果摘要<textarea name="resultSummary" placeholder="说明为什么通过或失败，至少 8 个字" required rows={3} /></label>
        <label>实测值<input name="measuredValue" placeholder="例如：58% 首选" /></label>
        <label>执行备注<input name="notes" placeholder="可选" /></label>
        <label className="report-validation-verified"><input name="evidenceVerified" type="checkbox" />该证据已经人工核对</label>
      </div>
      <button disabled={busy} type="submit">{busy ? "正在保存…" : outcome === "pass" ? "记录为通过" : "记录为失败"}</button>
    </form>
  );
}

function ConclusionReviewPanel({
  record,
  busy,
  onSubmit,
}: Readonly<{
  record: ValidationExecutionRecord;
  busy: boolean;
  onSubmit: (payload: MutationPayload) => Promise<void>;
}>) {
  const impact = record.decisionImpact;
  if (!impact || impact.reviewStatus === "NOT_APPLICABLE") return null;

  const submitReview = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => {
      const entry = data.get(name);
      return typeof entry === "string" ? entry.trim() : "";
    };
    const decision = value("decision") === "reject" ? "reject" : "approve";
    await onSubmit({
      action: "review",
      recordId: record.id,
      decision,
      disposition: decision === "approve" ? value("disposition") : null,
      reviewer: value("reviewer"),
      note: value("note"),
    });
  };

  return (
    <section className={`report-conclusion-review status-${impact.reviewStatus.toLowerCase().replaceAll("_", "-")}`}>
      <header>
        <div><span>结论更新提案</span><strong>{impact.proposalSummary}</strong></div>
        <em>{impact.reviewStatus === "PENDING_REVIEW" ? "等待人工审核" : impact.reviewStatus === "APPROVED" ? "已批准 · 尚未应用" : "已驳回"}</em>
      </header>
      <div className="report-conclusion-review-targets">
        {record.conclusionReviewTargets.map((target) => (
          <article key={target.id}>
            <span>{target.id} · {target.topic}</span>
            <p>{target.statement}</p>
            <small>影响章节：{target.chapterIds.join("、")} · 当前证据：{target.evidenceStatus}</small>
          </article>
        ))}
      </div>
      {impact.reviewStatus === "PENDING_REVIEW" ? (
        <form onSubmit={submitReview}>
          <label>审核决定
            <select defaultValue="approve" name="decision">
              <option value="approve">批准处理提案</option>
              <option value="reject">驳回处理提案</option>
            </select>
          </label>
          <label>结论处理方式
            <select defaultValue={impact.recommendedDisposition} name="disposition">
              {Object.entries(dispositionLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>审核人<input name="reviewer" placeholder="姓名或角色" required /></label>
          <label className="wide">审核说明<textarea name="note" placeholder="说明采用或驳回该提案的依据" required rows={2} /></label>
          <button disabled={busy} type="submit">{busy ? "正在保存审核…" : "保存人工审核"}</button>
        </form>
      ) : (
        <footer>
          <strong>{impact.selectedDisposition ? dispositionLabel[impact.selectedDisposition] : "未采用处理方案"}</strong>
          <span>{impact.reviewer} · {impact.reviewNote}</span>
          <small>{impact.reportUpdateApplied
            ? `正式报告已通过 ${impact.publicationId} 更新，发布前版本仍可回滚。`
            : "正式报告尚未更新；需要进入独立发布步骤。"}</small>
        </footer>
      )}
    </section>
  );
}

function ConclusionPublicationPanel({
  record,
  runId,
  onPublished,
}: Readonly<{
  record: ValidationExecutionRecord;
  runId: string;
  onPublished: (ledger: ValidationExecutionLedger) => void;
}>) {
  const [preview, setPreview] = useState<ConclusionPublicationPreview | null>(null);
  const [drafts, setDrafts] = useState<ConclusionPublicationDraft[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const impact = record.decisionImpact;
  if (!impact || impact.reviewStatus !== "APPROVED" || impact.reportUpdateApplied) return null;

  const collectDrafts = (form: HTMLFormElement): ConclusionPublicationDraft[] => {
    const data = new FormData(form);
    const text = (name: string) => {
      const entry = data.get(name);
      return typeof entry === "string" ? entry.trim() : "";
    };
    return record.conclusionReviewTargets.map((target) => ({
      conclusionId: target.id,
      statement: text(`statement:${target.id}`),
      rationale: text(`rationale:${target.id}`),
      claimBoundary: text(`boundary:${target.id}`),
      evidenceStatus: text(`evidence:${target.id}`) as ConclusionPublicationDraft["evidenceStatus"],
    }));
  };

  const requestPreview = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const nextDrafts = collectDrafts(event.currentTarget);
    try {
      const response = await fetch(`/api/research/${runId}/conclusion-publication`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preview", recordId: record.id, drafts: nextDrafts }),
      });
      const body = await response.json() as { preview?: ConclusionPublicationPreview; error?: string };
      if (!response.ok || !body.preview) throw new Error(body.error ?? "生成发布预览失败");
      setDrafts(nextDrafts);
      setPreview(body.preview);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "生成发布预览失败");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/research/${runId}/conclusion-publication`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          recordId: record.id,
          drafts,
          expectedGovernanceGeneratedAt: preview.expectedGovernanceGeneratedAt,
          confirmationPhrase: confirmation,
        }),
      });
      const body = await response.json() as { ledger?: ValidationExecutionLedger; error?: string };
      if (!response.ok || !body.ledger) throw new Error(body.error ?? "正式发布失败");
      onPublished(body.ledger);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "正式发布失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="report-conclusion-publication">
      <header><span>安全发布</span><strong>先逐条编辑，再查看全文影响；生成预览不会改写报告。</strong></header>
      {!preview ? (
        <form onSubmit={requestPreview}>
          {record.conclusionReviewTargets.map((target) => (
            <details key={target.id}>
              <summary>{conclusionTopicLabel[target.topic] ?? target.topic} · {target.id}</summary>
              <label>发布后结论<textarea defaultValue={target.statement} name={`statement:${target.id}`} required rows={3} /></label>
              <label>更新理由<textarea defaultValue={`基于 ${record.title} 的真实执行结果与人工审核决定更新。`} name={`rationale:${target.id}`} required rows={2} /></label>
              <label>新证据边界<textarea defaultValue={target.claimBoundary} name={`boundary:${target.id}`} required rows={2} /></label>
              <label>发布后证据状态
                <select defaultValue={target.evidenceStatus} name={`evidence:${target.id}`}>
                  <option value="supported">已支持</option>
                  <option value="directional">方向性</option>
                  <option value="hypothesis">假设</option>
                  <option value="prohibited">禁止使用</option>
                </select>
              </label>
            </details>
          ))}
          <button disabled={busy} type="submit">{busy ? "正在检查一致性…" : "生成发布差异预览"}</button>
        </form>
      ) : (
        <div className="report-conclusion-publication-preview">
          <header><strong>{preview.diffs.length} 条结论、{preview.affectedChapterIds.length} 个章节将更新</strong><span>一致性检查通过</span></header>
          <div>{preview.diffs.map((diff) => (
            <article key={diff.oldConclusionId}>
              <span>{diff.oldConclusionId} → {diff.newConclusionId}</span>
              <p><del>{diff.oldStatement}</del></p>
              <p><ins>{diff.newStatement}</ins></p>
              <small>影响章节：{diff.chapterIds.join("、")}</small>
            </article>
          ))}</div>
          <label>输入“确认发布到正式报告”完成二次确认
            <input onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
          </label>
          <div className="report-conclusion-publication-actions">
            <button disabled={busy} onClick={() => setPreview(null)} type="button">返回修改</button>
            <button disabled={busy || confirmation !== preview.confirmationPhrase} onClick={publish} type="button">{busy ? "正在原子发布…" : "发布并保留回滚点"}</button>
          </div>
        </div>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function ConclusionVersionCenter({
  runId,
  onRollback,
}: Readonly<{
  runId: string;
  onRollback: (ledger: ValidationExecutionLedger) => void;
}>) {
  const [history, setHistory] = useState<ConclusionVersionHistory | null>(null);
  const [preview, setPreview] = useState<ConclusionRollbackPreview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/research/${runId}/conclusion-history`);
        const body = await response.json() as { history?: ConclusionVersionHistory; error?: string };
        if (!response.ok || !body.history) throw new Error(body.error ?? "读取结论版本失败");
        if (!cancelled) setHistory(body.history);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "读取结论版本失败");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [runId]);

  const requestRollbackPreview = async (publicationId: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/research/${runId}/conclusion-history`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preview_rollback", publicationId }),
      });
      const body = await response.json() as { preview?: ConclusionRollbackPreview; error?: string };
      if (!response.ok || !body.preview) throw new Error(body.error ?? "生成回滚预览失败");
      setPreview(body.preview);
      setConfirmation("");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "生成回滚预览失败");
    } finally {
      setBusy(false);
    }
  };

  const rollback = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/research/${runId}/conclusion-history`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rollback", publicationId: preview.publicationId, confirmationPhrase: confirmation }),
      });
      const body = await response.json() as { ledger?: ValidationExecutionLedger; error?: string };
      if (!response.ok || !body.ledger) throw new Error(body.error ?? "正式回滚失败");
      onRollback(body.ledger);
      setHistory((current) => current ? {
        ...current,
        currentGovernanceGeneratedAt: preview.restoreGovernanceGeneratedAt,
        versions: current.versions.map((version) => version.publicationId === preview.publicationId ? {
          ...version,
          status: "ROLLED_BACK",
          rollbackEligible: false,
          rollbackId: preview.rollbackId,
          rolledBackAt: preview.generatedAt,
        } : version),
        metrics: {
          ...current.metrics,
          active: Math.max(current.metrics.active - 1, 0),
          rolledBack: current.metrics.rolledBack + 1,
        },
      } : current);
      setPreview(null);
      setConfirmation("");
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : "正式回滚失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="report-conclusion-version-center" aria-labelledby="conclusion-version-center-title">
      <header>
        <div><span>审计与恢复</span><h4 id="conclusion-version-center-title">结论版本中心</h4><p>查看每次正式发布的差异与影响范围；只能回滚当前最后一个有效版本。</p></div>
        <dl>
          <div><dt>版本</dt><dd>{history?.metrics.total ?? 0}</dd></div>
          <div><dt>当前</dt><dd>{history?.metrics.active ?? 0}</dd></div>
          <div><dt>已回滚</dt><dd>{history?.metrics.rolledBack ?? 0}</dd></div>
        </dl>
      </header>
      {!history ? <p className="report-version-empty">正在读取版本历史…</p> : history.versions.length === 0 ? (
        <p className="report-version-empty">尚无正式结论发布版本。完成真实验证、人工审核和安全发布后，版本会出现在这里。</p>
      ) : (
        <ol>{history.versions.map((version) => (
          <li key={version.publicationId}>
            <header>
              <div><strong>{version.publicationId}</strong><span>{new Date(version.appliedAt).toLocaleString("zh-CN")}</span></div>
              <em>{version.status === "ACTIVE" ? "当前版本" : version.status === "ROLLED_BACK" ? "已回滚" : "历史版本"}</em>
            </header>
            <p>{version.diffCount} 条结论 · 影响 {version.affectedChapterIds.join("、")}</p>
            <details><summary>查看新旧结论差异</summary><div>{version.diffs.map((diff) => (
              <article key={diff.oldConclusionId}><span>{diff.oldConclusionId} → {diff.newConclusionId}</span><del>{diff.oldStatement}</del><ins>{diff.newStatement}</ins></article>
            ))}</div></details>
            {version.rollbackEligible ? <button disabled={busy} onClick={() => requestRollbackPreview(version.publicationId)} type="button">生成回滚预览</button> : null}
          </li>
        ))}</ol>
      )}
      {preview ? (
        <section className="report-conclusion-rollback-preview">
          <header><strong>回滚将恢复 {preview.diffs.length} 条结论</strong><span>一致性预检通过</span></header>
          <div>{preview.diffs.map((diff) => (
            <article key={diff.currentConclusionId}><span>{diff.currentConclusionId} → {diff.restoredConclusionId}</span><del>{diff.currentStatement}</del><ins>{diff.restoredStatement}</ins></article>
          ))}</div>
          <label>输入“确认回滚正式报告”进行二次确认<input onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /></label>
          <footer><button onClick={() => setPreview(null)} type="button">取消</button><button disabled={busy || confirmation !== preview.confirmationPhrase} onClick={rollback} type="button">{busy ? "正在回滚…" : "确认回滚并保留记录"}</button></footer>
        </section>
      ) : null}
      {error ? <p className="report-version-error" role="alert">{error}</p> : null}
    </section>
  );
}

export function ReportValidationExecutionLedger({
  ledger: initialLedger,
  showInternalControls = true,
}: Readonly<{
  ledger: ValidationExecutionLedger;
  showInternalControls?: boolean;
}>) {
  const [ledger, setLedger] = useState(initialLedger);
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasExecutionHistory = ledger.events.length > 0;

  const mutate = async (payload: MutationPayload) => {
    setBusyRecordId(payload.recordId);
    setError(null);
    try {
      const response = await fetch(`/api/research/${ledger.runId}/validation-execution`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { ledger?: ValidationExecutionLedger; error?: string };
      if (!response.ok || !body.ledger) throw new Error(body.error ?? "保存执行记录失败");
      setLedger(body.ledger);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "保存执行记录失败");
    } finally {
      setBusyRecordId(null);
    }
  };

  return (
    <section className="report-validation-ledger" aria-labelledby="validation-execution-title">
      <header className="report-validation-ledger-head">
        <div>
          <span>从计划进入真实执行</span>
          <h3 id="validation-execution-title">验证做到哪一步了？</h3>
          <p>{hasExecutionHistory
            ? "计划值和实际值严格分开；报告只展示当前进度、真实结果和下一步。"
            : "计划值和实际值严格分开。当前尚未回填任何真实样本、预算、执行周期或结果，因此只有第一项处于“可以开始”。"}</p>
        </div>
        <div className="report-validation-ledger-metrics">
          <div><strong>{ledger.metrics.ready}</strong><span>可以开始</span></div>
          <div><strong>{ledger.metrics.blocked}</strong><span>等待前置</span></div>
          <div><strong>{ledger.metrics.evidenceCount}</strong><span>已回填证据</span></div>
        </div>
      </header>

      <ol className="report-validation-ledger-list">
        {ledger.records.map((record) => {
          const meta = executionStatusMeta[record.currentStatus];
          const StatusIcon = meta.icon;
          const latestAttempt = record.attempts.at(-1);
          const actualHeadline = !latestAttempt
            ? "尚未执行"
            : latestAttempt.status === "IN_PROGRESS"
              ? "执行中 · 等待结果回填"
              : [
                latestAttempt.actuals.sampleSizeLabel,
                latestAttempt.actuals.durationDays === null ? null : `${latestAttempt.actuals.durationDays} 天`,
                latestAttempt.actuals.budgetAmount === null
                  ? null
                  : `${latestAttempt.actuals.budgetCurrency ?? ""} ${latestAttempt.actuals.budgetAmount}`.trim(),
              ].filter(Boolean).join(" · ") || "已完成 · 实际值未完整回填";
          const actualDetail = latestAttempt?.result?.summary
            ?? (latestAttempt ? "本次验证尚未完成，等待结果回填。" : "样本、预算、周期和结果均未回填");
          return (
            <li className={`report-validation-record status-${meta.className}`} key={record.id}>
              <div className="report-validation-record-line" aria-hidden="true" />
              <div className="report-validation-record-index">{String(record.order).padStart(2, "0")}</div>
              <article>
                <header>
                  <div>
                    <span>{record.typeLabel}</span>
                    <h4>{record.title}</h4>
                  </div>
                  <strong className="report-validation-record-status"><StatusIcon size={13} />{meta.label}</strong>
                </header>

                <div className="report-validation-plan-actual">
                  <div>
                    <span>规划值</span>
                    <strong>{record.planned.durationDays} 天 · {plannedBudgetLabelZh(record.planned.budgetLabel)}</strong>
                    <p>{record.planned.scope}</p>
                  </div>
                  <div>
                    <span>实际值</span>
                    <strong>{actualHeadline}</strong>
                    <p>{actualDetail}</p>
                  </div>
                </div>

                <details open={record.currentStatus === "READY"}>
                  <summary><FileSearch size={14} />查看执行要求与证据清单</summary>
                  <div className="report-validation-record-detail">
                    <section><span>执行方法</span><p>{record.planned.method}</p></section>
                    <section>
                      <span>必须回填的证据</span>
                      <ul>{record.requiredEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
                    </section>
                    {showInternalControls ? (
                      <section>
                        <span>完成后进入审核的结论</span>
                        {record.conclusionReviewTargets.length > 0 ? (
                          <div className="report-validation-review-target-summary">
                            <p>本项完成后会生成 {record.conclusionReviewTargets.length} 条结论处理提案。</p>
                            <div>{record.conclusionReviewTargets.map((target) => (
                              <em key={target.id} title={`${target.id} · ${target.statement}`}>{conclusionTopicLabel[target.topic] ?? target.topic}</em>
                            ))}</div>
                          </div>
                        ) : <p>当前研究没有结论更新目标，结果只会作为执行证据保存。</p>}
                      </section>
                    ) : null}
                    <dl>
                      <div><dt>衡量指标</dt><dd>{record.planned.metric}</dd></div>
                      <div><dt>通过</dt><dd>{record.planned.pass}</dd></div>
                      <div><dt>失败</dt><dd>{record.planned.fail}</dd></div>
                      <div><dt>停止</dt><dd>{record.planned.stop}</dd></div>
                    </dl>
                  </div>
                </details>

                <p className="report-validation-record-result">
                  <ClipboardCheck size={14} />
                  {record.attempts.length === 0
                    ? "当前还没有实际执行记录。"
                    : `已记录 ${record.attempts.length} 次验证；最新状态：${record.currentStatusLabel}。`}
                </p>

                {record.currentStatus === "READY" ? (
                  <button
                    className="report-validation-action-button"
                    disabled={busyRecordId === record.id}
                    onClick={() => mutate({ action: "start", recordId: record.id })}
                    type="button"
                  >
                    <Play size={14} />{busyRecordId === record.id ? "正在开始…" : "开始这项验证"}
                  </button>
                ) : null}

                {record.currentStatus === "IN_PROGRESS" ? (
                  <CompletionForm
                    busy={busyRecordId === record.id}
                    onSubmit={mutate}
                    record={record}
                  />
                ) : null}

                {record.currentStatus === "FAILED" ? (
                  <button
                    className="report-validation-action-button retry"
                    disabled={busyRecordId === record.id}
                    onClick={() => mutate({ action: "retry", recordId: record.id })}
                    type="button"
                  >
                    <Play size={14} />{busyRecordId === record.id ? "正在创建重试…" : "追加一次重试"}
                  </button>
                ) : null}

                {showInternalControls ? (
                  <>
                    <ConclusionReviewPanel
                      busy={busyRecordId === record.id}
                      onSubmit={mutate}
                      record={record}
                    />
                    <ConclusionPublicationPanel
                      onPublished={setLedger}
                      record={record}
                      runId={ledger.runId}
                    />
                  </>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>

      {error ? <p className="report-validation-mutation-error" role="alert">{error}</p> : null}

      {showInternalControls ? (
        <>
          <section className="report-validation-event-log">
            <header><strong>执行日志</strong><span>{ledger.events.length} 条</span></header>
            {ledger.events.length > 0 ? (
              <ol>{[...ledger.events].reverse().map((event) => (
                <li key={event.id}><time>{new Date(event.at).toLocaleString("zh-CN")}</time><span>{event.summary}</span></li>
              ))}</ol>
            ) : <p>尚无执行日志；点击“开始这项验证”后，操作会追加写入独立记录文件。</p>}
          </section>

          <ConclusionVersionCenter onRollback={setLedger} runId={ledger.runId} />
        </>
      ) : null}

      <footer className="report-validation-ledger-boundary">
        <ShieldAlert size={15} />
        <p>{ledger.boundary}</p>
      </footer>
    </section>
  );
}
