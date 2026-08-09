import { describe, expect, it } from "vitest";
import { conclusionGovernanceArtifactSchema } from "../conclusion-governance/types";
import { buildEvidenceConclusionReviewProposal } from "./review";
import type { EvidenceAnalysisBundle } from "./recompute";

const current = (id: string, topic: string, statement: string) => ({
  id,
  topic,
  subject: { kind: "category", key: "3d-yoga-pants", label: "3D Yoga Pants" },
  funnel_stage: topic === "marketing_value_proposition" ? "belief" : topic === "decision_boundary" ? "decision" : "product_definition",
  statement,
  evidence_status: "directional",
  status: "current",
  source_run_id: "research-run-review-yoga-us",
  source_type: "decision_artifact",
  effective_at: "2026-08-04T01:00:00.000Z",
  relation: "initial",
  previous_conclusion_ids: [],
  rationale: "Current governed conclusion used for review proposal testing.",
  claim_boundary: "This conclusion remains directional and cannot prove target SKU performance.",
  chapter_ids: ["summary"],
});

describe("evidence conclusion review proposal", () => {
  it("maps changed recomputed conclusions to current governed topics without allowing publication", () => {
    const artifact = conclusionGovernanceArtifactSchema.parse({
      schema_version: "1.0",
      report_run_id: "research-run-review-yoga-us",
      product: "3D Yoga Pants",
      market: "US",
      generated_at: "2026-08-04T01:00:00.000Z",
      methodology: "CROSS_CHAPTER_CONCLUSION_GOVERNANCE_V1",
      policy: {
        explicit_override_required: true,
        latest_timestamp_alone_cannot_override: true,
        scope_and_funnel_stage_must_match: true,
        superseded_conclusions_cannot_drive_chapters: true,
        target_product_claims_require_target_evidence: true,
      },
      conclusions: [
        current("CON-EVIDENCE", "evidence_strength", "Current evidence strength conclusion for the report."),
        current("CON-DIRECTION", "product_direction", "Current product direction conclusion for the report."),
        current("CON-MARKETING", "marketing_value_proposition", "Current marketing conclusion for the report."),
        current("CON-BOUNDARY", "decision_boundary", "Current decision boundary conclusion for the report."),
      ],
      chapter_bindings: [
        { chapter_id: "summary", topic: "evidence_strength", conclusion_ids: ["CON-EVIDENCE"] },
        { chapter_id: "summary", topic: "product_direction", conclusion_ids: ["CON-DIRECTION"] },
        { chapter_id: "summary", topic: "marketing_value_proposition", conclusion_ids: ["CON-MARKETING"] },
        { chapter_id: "summary", topic: "decision_boundary", conclusion_ids: ["CON-BOUNDARY"] },
      ],
      overall_boundary: "This test artifact is used only to verify review proposal mapping behavior.",
    });
    const analysis = {
      snapshot: {} as EvidenceAnalysisBundle["snapshot"],
      latestDiff: null,
      latestMeaningfulDiff: {
        schemaVersion: "1.0",
        runId: artifact.report_run_id,
        batchId: "BATCH-VOC-REVIEW-0001",
        fromVersion: 1,
        toVersion: 2,
        generatedAt: "2026-08-08T02:00:00.000Z",
        changed: true,
        affectedChapterIds: ["customers", "positioning", "marketing", "decision"],
        metrics: [],
        conclusions: [
          { chapterId: "customers", label: "用户判断", before: "Previous customer conclusion.", after: "Updated customer conclusion based on the new evidence batch.", reason: "New customer evidence changed the result.", status: "changed" },
          { chapterId: "positioning", label: "产品方向", before: "Previous product conclusion.", after: "Updated product direction based on the new evidence batch.", reason: "New customer evidence changed the result.", status: "changed" },
          { chapterId: "marketing", label: "营销表达", before: "Previous marketing conclusion.", after: "Updated marketing direction based on the new evidence batch.", reason: "New customer evidence changed the result.", status: "changed" },
          { chapterId: "decision", label: "行动边界", before: "Previous decision boundary.", after: "Updated decision boundary based on the new evidence batch.", reason: "New customer evidence changed the result.", status: "changed" },
        ],
        topThemeChanges: [],
        boundary: "Diffs are drafts and cannot automatically update the formal report.",
      },
    } satisfies EvidenceAnalysisBundle;
    const proposal = buildEvidenceConclusionReviewProposal({ artifact, analysis });
    expect(proposal?.drafts).toHaveLength(4);
    expect(proposal?.drafts.map((draft) => draft.currentConclusionId)).toEqual([
      "CON-EVIDENCE",
      "CON-DIRECTION",
      "CON-MARKETING",
      "CON-BOUNDARY",
    ]);
    expect(proposal?.gates).toEqual({
      analysisReady: true,
      humanReviewApproved: false,
      validationProposalApproved: false,
      formalPublicationAllowed: false,
    });
  });
});
