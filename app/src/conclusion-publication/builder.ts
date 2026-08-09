import { conclusionGovernanceArtifactSchema, type ConclusionGovernanceArtifact, type GovernedConclusion } from "../conclusion-governance/types";
import { validateConclusionGovernance } from "../conclusion-governance/validation";
import type { ValidationExecutionLedger } from "../validation-execution/types";
import {
  conclusionPublicationDraftSchema,
  conclusionPublicationPreviewSchema,
  type ConclusionPublicationDraft,
  type ConclusionPublicationPreview,
} from "./types";

const timestampKey = (value: string): string => value.replace(/\D/gu, "").slice(0, 14);

const relationFor = (disposition: "RETAIN" | "REFINE" | "SUPERSEDE" | "STOP") => {
  if (disposition === "RETAIN") return "reaffirms" as const;
  if (disposition === "REFINE") return "refines" as const;
  return "supersedes" as const;
};

export const buildConclusionPublicationPreview = ({
  artifact,
  ledger,
  recordId,
  drafts: rawDrafts,
  now = new Date().toISOString(),
}: {
  artifact: ConclusionGovernanceArtifact;
  ledger: ValidationExecutionLedger;
  recordId: string;
  drafts: ConclusionPublicationDraft[];
  now?: string;
}): { preview: ConclusionPublicationPreview; nextArtifact: ConclusionGovernanceArtifact } => {
  const record = ledger.records.find((item) => item.id === recordId);
  if (!record?.decisionImpact || record.decisionImpact.reviewStatus !== "APPROVED" || !record.decisionImpact.selectedDisposition) {
    throw new Error("Conclusion publication requires an approved review proposal");
  }
  if (record.decisionImpact.reportUpdateApplied) throw new Error("Conclusion proposal has already been published");
  const drafts = rawDrafts.map((draft) => conclusionPublicationDraftSchema.parse(draft));
  const targetIds = record.conclusionReviewTargets.map((target) => target.id).sort();
  const draftIds = drafts.map((draft) => draft.conclusionId).sort();
  if (JSON.stringify(targetIds) !== JSON.stringify(draftIds)) {
    throw new Error("Publication drafts must cover every affected conclusion exactly once");
  }

  const byId = new Map(artifact.conclusions.map((conclusion) => [conclusion.id, conclusion]));
  const draftById = new Map(drafts.map((draft) => [draft.conclusionId, draft]));
  const key = timestampKey(now);
  const relation = relationFor(record.decisionImpact.selectedDisposition);
  const replacements = new Map<string, GovernedConclusion>();

  for (const targetId of targetIds) {
    const current = byId.get(targetId);
    const draft = draftById.get(targetId);
    if (!current || current.status !== "current" || !draft) {
      throw new Error(`Publication target is not a current governed conclusion: ${targetId}`);
    }
    replacements.set(targetId, {
      ...current,
      id: `${current.id}-P${key}`,
      statement: draft.statement,
      evidence_status: draft.evidenceStatus,
      status: "current",
      source_run_id: ledger.runId,
      source_type: "decision_artifact",
      effective_at: now,
      relation,
      previous_conclusion_ids: [current.id],
      rationale: draft.rationale,
      claim_boundary: draft.claimBoundary,
    });
  }

  const nextArtifact = conclusionGovernanceArtifactSchema.parse({
    ...artifact,
    generated_at: now,
    conclusions: [
      ...artifact.conclusions.map((conclusion) => replacements.has(conclusion.id) ? {
        ...conclusion,
        status: record.decisionImpact?.selectedDisposition === "RETAIN" ? "historical" : "superseded",
      } : conclusion),
      ...replacements.values(),
    ],
    chapter_bindings: artifact.chapter_bindings.map((binding) => ({
      ...binding,
      conclusion_ids: binding.conclusion_ids.map((id) => replacements.get(id)?.id ?? id),
    })),
  });
  const validation = validateConclusionGovernance(nextArtifact, {
    reportRunId: artifact.report_run_id,
    product: artifact.product,
    market: artifact.market,
  });
  if (!validation.valid) {
    throw new Error(`Publication preview failed conclusion consistency validation: ${validation.errors.map((issue) => issue.code).join(", ")}`);
  }

  const diffs = targetIds.map((targetId) => {
    const oldConclusion = byId.get(targetId);
    const newConclusion = replacements.get(targetId);
    if (!oldConclusion || !newConclusion) throw new Error(`Publication diff target is incomplete: ${targetId}`);
    return {
      oldConclusionId: oldConclusion.id,
      newConclusionId: newConclusion.id,
      topic: oldConclusion.topic,
      relation: newConclusion.relation,
      oldStatement: oldConclusion.statement,
      newStatement: newConclusion.statement,
      oldEvidenceStatus: oldConclusion.evidence_status,
      newEvidenceStatus: newConclusion.evidence_status,
      oldClaimBoundary: oldConclusion.claim_boundary,
      newClaimBoundary: newConclusion.claim_boundary,
      chapterIds: oldConclusion.chapter_ids,
    };
  });
  const preview = conclusionPublicationPreviewSchema.parse({
    schemaVersion: "1.0",
    publicationId: `PUB-${record.order}-${key}`,
    runId: ledger.runId,
    recordId,
    generatedAt: now,
    expectedGovernanceGeneratedAt: artifact.generated_at,
    disposition: record.decisionImpact.selectedDisposition,
    confirmationPhrase: "确认发布到正式报告",
    diffs,
    affectedChapterIds: [...new Set(diffs.flatMap((diff) => diff.chapterIds))],
    consistencyValidation: {
      valid: true,
      errorCount: 0,
      warningCount: validation.warnings.length,
    },
    boundaries: [
      "发布预览只显示将要发生的变化，不会在生成预览时改写正式报告。",
      "正式发布必须匹配当前结论注册表版本，并再次输入完整确认短语。",
      "任何写入或验证失败都会恢复发布前注册表，批准本身不等于已经发布。",
    ],
  });
  return { preview, nextArtifact };
};
