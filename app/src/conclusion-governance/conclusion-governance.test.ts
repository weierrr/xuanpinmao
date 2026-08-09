import { describe, expect, it } from "vitest";
import { validateConclusionGovernance } from "./validation";

const baseConclusion = {
  id: "CON-001",
  topic: "product_direction",
  subject: { kind: "proposed_offer", key: "recommended_direction", label: "推荐产品方向" },
  funnel_stage: "product_definition",
  statement: "证据优先的自然塑形款",
  evidence_status: "directional",
  status: "superseded",
  source_run_id: "research-run-old-12345678",
  source_type: "primary_run",
  effective_at: "2026-07-30T00:00:00.000Z",
  relation: "initial",
  previous_conclusion_ids: [],
  chapter_ids: ["summary", "positioning"],
  rationale: "历史第一性原理推荐方向。",
  claim_boundary: "只代表历史方向，不再驱动当前章节。",
} as const;

const validArtifact = () => ({
  schema_version: "1.0",
  report_run_id: "research-run-composed-12345678",
  product: "3D yoga pants",
  market: "US",
  generated_at: "2026-08-04T00:00:00.000Z",
  methodology: "CROSS_CHAPTER_CONCLUSION_GOVERNANCE_V1",
  policy: {
    explicit_override_required: true,
    latest_timestamp_alone_cannot_override: true,
    scope_and_funnel_stage_must_match: true,
    superseded_conclusions_cannot_drive_chapters: true,
    target_product_claims_require_target_evidence: true,
  },
  conclusions: [
    baseConclusion,
    {
      ...baseConclusion,
      id: "CON-002",
      statement: "视觉磨皮与自然轮廓管理款",
      status: "current",
      source_run_id: "research-run-new-12345678",
      source_type: "supplemental_research",
      effective_at: "2026-08-02T00:00:00.000Z",
      relation: "supersedes",
      previous_conclusion_ids: ["CON-001"],
      rationale: "补充调研重新定义了产品方向。",
    },
  ],
  chapter_bindings: [
    { chapter_id: "summary", topic: "product_direction", conclusion_ids: ["CON-002"] },
    { chapter_id: "positioning", topic: "product_direction", conclusion_ids: ["CON-002"] },
  ],
  overall_boundary: "新结论只在明确覆盖且通过验证后替代旧结论。",
});

const expected = {
  reportRunId: "research-run-composed-12345678",
  product: "3D yoga pants",
  market: "US",
};

describe("conclusion governance", () => {
  it("accepts an explicit same-scope replacement and binds only the current conclusion", () => {
    const result = validateConclusionGovernance(validArtifact(), expected);
    expect(result.valid).toBe(true);
    expect(result.summary.explicit_override_count).toBe(1);
    expect(result.summary.conflict_count).toBe(0);
  });

  it("rejects two current conclusions for the same topic and scope", () => {
    const artifact = validArtifact();
    artifact.conclusions[0] = { ...artifact.conclusions[0], status: "current" };
    const result = validateConclusionGovernance(artifact, expected);
    expect(result.errors.some((item) => item.code === "MULTIPLE_CURRENT_CONCLUSIONS")).toBe(true);
  });

  it("rejects an override across different funnel stages", () => {
    const artifact = validArtifact();
    artifact.conclusions[1] = { ...artifact.conclusions[1], funnel_stage: "attention" };
    const result = validateConclusionGovernance(artifact, expected);
    expect(result.errors.some((item) => item.code === "CONCLUSION_SCOPE_OR_STAGE_MISMATCH")).toBe(true);
  });

  it("rejects a superseded conclusion that is still bound to a chapter", () => {
    const artifact = validArtifact();
    artifact.chapter_bindings[0] = { ...artifact.chapter_bindings[0], conclusion_ids: ["CON-001"] };
    const result = validateConclusionGovernance(artifact, expected);
    expect(result.errors.some((item) => item.code === "SUPERSEDED_CONCLUSION_BOUND_TO_CHAPTER")).toBe(true);
  });

  it("does not let competitor synthesis prove a target product", () => {
    const artifact = validArtifact();
    artifact.conclusions[1] = {
      ...artifact.conclusions[1],
      subject: { kind: "target_product", key: "recommended_direction", label: "目标产品" },
      evidence_status: "supported",
      relation: "initial",
      previous_conclusion_ids: [],
    };
    artifact.conclusions[0] = { ...artifact.conclusions[0], status: "historical" };
    const result = validateConclusionGovernance(artifact, expected);
    expect(result.errors.some((item) => item.code === "TARGET_PRODUCT_CONCLUSION_WITHOUT_TARGET_EVIDENCE")).toBe(true);
  });
});
