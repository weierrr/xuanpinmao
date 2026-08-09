import { z } from "zod";
import { isoDateTimeSchema } from "../research/types";

export const governedReportChapterIds = [
  "summary",
  "market",
  "competitors",
  "customers",
  "positioning",
  "validation",
  "marketing",
  "boundary",
] as const;

export const conclusionTopics = [
  "attention_driver",
  "belief_driver",
  "purchase_risk_reducer",
  "product_direction",
  "core_value",
  "target_customer",
  "target_scenario",
  "product_concept",
  "evidence_strength",
  "recommendation_rationale",
  "marketing_value_proposition",
  "decision_boundary",
] as const;

export const conclusionRelations = [
  "initial",
  "supersedes",
  "refines",
  "complements",
  "reaffirms",
] as const;

export const conclusionStatuses = ["current", "superseded", "historical"] as const;
export const conclusionEvidenceStatuses = ["supported", "directional", "hypothesis", "prohibited"] as const;
export const conclusionSubjectKinds = [
  "category",
  "competitor_set",
  "proposed_offer",
  "target_product",
  "decision",
] as const;
export const conclusionSourceTypes = [
  "primary_run",
  "audit_run",
  "supplemental_research",
  "consumer_psychology",
  "decision_artifact",
] as const;
export const conclusionFunnelStages = [
  "attention",
  "belief",
  "risk_reduction",
  "product_definition",
  "decision",
] as const;

export const governedConclusionSchema = z.object({
  id: z.string().trim().min(3),
  topic: z.enum(conclusionTopics),
  subject: z.object({
    kind: z.enum(conclusionSubjectKinds),
    key: z.string().trim().min(2),
    label: z.string().trim().min(2),
  }).strict(),
  funnel_stage: z.enum(conclusionFunnelStages),
  statement: z.string().trim().min(8),
  evidence_status: z.enum(conclusionEvidenceStatuses),
  status: z.enum(conclusionStatuses),
  source_run_id: z.string().trim().min(8),
  source_type: z.enum(conclusionSourceTypes),
  effective_at: isoDateTimeSchema,
  relation: z.enum(conclusionRelations),
  previous_conclusion_ids: z.array(z.string().trim().min(3)),
  chapter_ids: z.array(z.enum(governedReportChapterIds)).min(1),
  rationale: z.string().trim().min(8),
  claim_boundary: z.string().trim().min(8),
}).strict().superRefine((conclusion, context) => {
  const requiresPrevious = ["supersedes", "refines", "reaffirms"].includes(conclusion.relation);
  if (requiresPrevious && conclusion.previous_conclusion_ids.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["previous_conclusion_ids"],
      message: `${conclusion.relation} requires at least one previous conclusion`,
    });
  }
  if (conclusion.relation === "initial" && conclusion.previous_conclusion_ids.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["previous_conclusion_ids"],
      message: "An initial conclusion cannot reference a previous conclusion",
    });
  }
  if (conclusion.status === "current" && conclusion.evidence_status === "prohibited") {
    context.addIssue({
      code: "custom",
      path: ["evidence_status"],
      message: "A prohibited conclusion cannot become current report guidance",
    });
  }
});

export const conclusionChapterBindingSchema = z.object({
  chapter_id: z.enum(governedReportChapterIds),
  topic: z.enum(conclusionTopics),
  conclusion_ids: z.array(z.string().trim().min(3)).min(1),
}).strict();

export const conclusionGovernanceArtifactSchema = z.object({
  schema_version: z.literal("1.0"),
  report_run_id: z.string().trim().min(8),
  product: z.string().trim().min(2),
  market: z.string().trim().min(2),
  generated_at: isoDateTimeSchema,
  methodology: z.literal("CROSS_CHAPTER_CONCLUSION_GOVERNANCE_V1"),
  policy: z.object({
    explicit_override_required: z.literal(true),
    latest_timestamp_alone_cannot_override: z.literal(true),
    scope_and_funnel_stage_must_match: z.literal(true),
    superseded_conclusions_cannot_drive_chapters: z.literal(true),
    target_product_claims_require_target_evidence: z.literal(true),
  }).strict(),
  conclusions: z.array(governedConclusionSchema).min(1),
  chapter_bindings: z.array(conclusionChapterBindingSchema).min(1),
  overall_boundary: z.string().trim().min(10),
}).strict();

export type ConclusionTopic = (typeof conclusionTopics)[number];
export type GovernedConclusion = z.infer<typeof governedConclusionSchema>;
export type ConclusionGovernanceArtifact = z.infer<typeof conclusionGovernanceArtifactSchema>;

export type ConclusionGovernanceIssue = {
  code: string;
  message: string;
  conclusionId?: string;
  relatedId?: string;
  path?: string;
};

export type ConclusionGovernanceValidationResult = {
  valid: boolean;
  report_run_id: string;
  errors: ConclusionGovernanceIssue[];
  warnings: ConclusionGovernanceIssue[];
  summary: {
    conclusion_count: number;
    current_count: number;
    superseded_count: number;
    historical_count: number;
    topic_count: number;
    bound_chapter_count: number;
    explicit_override_count: number;
    conflict_count: number;
    unbound_current_count: number;
  };
};
