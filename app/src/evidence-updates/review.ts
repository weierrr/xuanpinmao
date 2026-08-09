import type { ConclusionGovernanceArtifact, GovernedConclusion } from "../conclusion-governance/types";
import { evidenceConclusionReviewProposalSchema, type EvidenceConclusionReviewProposal } from "./types";
import type { EvidenceAnalysisBundle } from "./recompute";

const topicForChapter = {
  customers: "evidence_strength",
  positioning: "product_direction",
  marketing: "marketing_value_proposition",
  decision: "decision_boundary",
} as const;

const currentForTopic = (artifact: ConclusionGovernanceArtifact, topic: string): GovernedConclusion => {
  const conclusion = artifact.conclusions.find((item) => item.status === "current" && item.topic === topic);
  if (!conclusion) throw new Error(`No current governed conclusion for topic: ${topic}`);
  return conclusion;
};

export const buildEvidenceConclusionReviewProposal = ({
  artifact,
  analysis,
}: {
  artifact: ConclusionGovernanceArtifact;
  analysis: EvidenceAnalysisBundle;
}): EvidenceConclusionReviewProposal | null => {
  const diff = analysis.latestMeaningfulDiff;
  if (!diff) return null;
  const drafts = diff.conclusions.flatMap((item) => {
    if (item.status !== "changed") return [];
    const topic = topicForChapter[item.chapterId as keyof typeof topicForChapter];
    if (!topic) return [];
    const current = currentForTopic(artifact, topic);
    return [{
      chapterId: item.chapterId,
      label: item.label,
      topic,
      currentConclusionId: current.id,
      currentStatement: current.statement,
      draftStatement: item.after,
      currentEvidenceStatus: current.evidence_status,
      currentClaimBoundary: current.claim_boundary,
      reviewStatus: "PENDING" as const,
    }];
  });
  if (drafts.length === 0) return null;
  return evidenceConclusionReviewProposalSchema.parse({
    schemaVersion: "1.0",
    proposalId: `ERP-v${diff.toVersion}-${diff.batchId}`,
    runId: artifact.report_run_id,
    generatedAt: diff.generatedAt,
    sourceRegistryVersion: diff.toVersion,
    sourceBatchId: diff.batchId,
    formalGovernanceGeneratedAt: artifact.generated_at,
    status: "PENDING_REVIEW",
    drafts,
    gates: {
      analysisReady: true,
      humanReviewApproved: false,
      validationProposalApproved: false,
      formalPublicationAllowed: false,
    },
    boundary: "自动重算结果只能生成待审核草案。人工确认结论内容并完成验证审批前，不得写入正式结论注册表，也不得解除采购、上架或广告门禁。",
  });
};
