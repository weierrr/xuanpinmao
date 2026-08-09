import { z } from "zod";
import { conceptMessageArchitectureSchema } from "../marketing-translation/types";
import { isoDateTimeSchema } from "../research/types";

export const demandFieldEvidenceStatuses = ["supported", "directional", "hypothesis"] as const;
export const relationshipStrengths = ["strong", "moderate", "weak", "uncertain"] as const;
export const adjacentRelationshipTypes = [
  "SAME_AUDIENCE",
  "SAME_SCENARIO",
  "SAME_JOB",
  "ADJACENT_JOB",
  "COMPLEMENTARY",
  "SUBSTITUTE",
  "PRE_USE",
  "POST_USE",
] as const;

const idList = z.array(z.string().trim().min(1));
const evidenceIds = idList.min(1);

export const audienceClusterSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(3),
  definition: z.string().trim().min(10),
  behavioral_scope: z.literal("aggregated"),
  supporting_observation_ids: evidenceIds.min(2),
  supporting_demand_atom_ids: idList,
  excluded_demographic_inferences: z.array(z.string().trim().min(3)).min(1),
}).strict();

export const demandScenarioSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(3),
  trigger: z.string().trim().min(3),
  job: z.string().trim().min(5),
  desired_outcome: z.string().trim().min(5),
  audience_cluster_ids: evidenceIds,
  supporting_observation_ids: evidenceIds,
  supporting_demand_atom_ids: idList,
}).strict();

export const fieldNeedAtomSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(["pain", "desired_outcome", "constraint", "alternative_gap"]),
  label: z.string().trim().min(3),
  statement: z.string().trim().min(5),
  current_alternative: z.string().trim().min(2).nullable(),
  alternative_gap: z.string().trim().min(2).nullable(),
  evidence_status: z.enum(demandFieldEvidenceStatuses),
  supporting_observation_ids: evidenceIds,
  counterevidence_observation_ids: idList,
  supporting_demand_atom_ids: idList,
}).strict();

export const taskChainStepSchema = z.object({
  id: z.string().trim().min(1),
  sequence: z.number().int().positive(),
  label: z.string().trim().min(3),
  job: z.string().trim().min(5),
  relative_to_current_product: z.enum(["pre_use", "core_use", "post_use", "parallel", "outside_current_scope"]),
  scenario_ids: evidenceIds,
  need_atom_ids: evidenceIds,
}).strict();

export const adjacentOpportunitySchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(3),
  candidate_category: z.string().trim().min(3),
  relationship_types: z.array(z.enum(adjacentRelationshipTypes)).min(1),
  audience_cluster_ids: evidenceIds,
  scenario_ids: evidenceIds,
  need_atom_ids: evidenceIds,
  task_step_ids: evidenceIds,
  evidence_status: z.enum(demandFieldEvidenceStatuses),
  relationship_strength: z.enum(relationshipStrengths),
  direct_product_evidence: z.boolean(),
  supporting_observation_ids: evidenceIds,
  counterevidence_observation_ids: idList,
  rationale: z.string().trim().min(10),
  why_not_approved: z.string().trim().min(10),
  status: z.enum(["RESEARCH_MORE", "NOT_PRIORITIZED"]),
  next_research_queries: z.array(z.string().trim().min(5)).min(2),
  validation_questions: z.array(z.string().trim().min(5)).min(1),
  concept_marketing: conceptMessageArchitectureSchema.optional(),
}).strict().superRefine((opportunity, context) => {
  if (!opportunity.direct_product_evidence && opportunity.evidence_status !== "hypothesis") {
    context.addIssue({
      code: "custom",
      path: ["evidence_status"],
      message: "Opportunity without direct product evidence must remain a hypothesis",
    });
  }
  if (!opportunity.direct_product_evidence && opportunity.relationship_strength === "strong") {
    context.addIssue({
      code: "custom",
      path: ["relationship_strength"],
      message: "Opportunity without direct product evidence cannot claim a strong relationship",
    });
  }
});

export const demandFieldArtifactSchema = z.object({
  schema_version: z.literal("1.0"),
  run_id: z.string().trim().min(8),
  product: z.string().trim().min(2),
  market: z.string().trim().min(2),
  generated_at: isoDateTimeSchema,
  methodology: z.literal("FIRST_PRINCIPLES_DEMAND_FIELD_V1"),
  source_artifacts: z.object({
    voc_corpus: z.string().trim().min(3),
    first_principles_bundle: z.string().trim().min(3),
  }).strict(),
  audience_clusters: z.array(audienceClusterSchema).min(1),
  scenarios: z.array(demandScenarioSchema).min(1),
  need_atoms: z.array(fieldNeedAtomSchema).min(1),
  task_chain: z.array(taskChainStepSchema).min(1),
  adjacent_opportunities: z.array(adjacentOpportunitySchema),
  limitations: z.array(z.string().trim().min(5)).min(1),
  decision_boundary: z.object({
    current_product_decision_unchanged: z.literal(true),
    adjacent_opportunities_not_approved: z.literal(true),
    new_research_run_required: z.literal(true),
  }).strict(),
}).strict();

export type DemandFieldArtifact = z.infer<typeof demandFieldArtifactSchema>;
export type DemandFieldValidationIssue = {
  code: string;
  message: string;
  path?: string;
  nodeId?: string;
  observationId?: string;
};

export type DemandFieldValidationResult = {
  valid: boolean;
  run_id: string;
  errors: DemandFieldValidationIssue[];
  warnings: DemandFieldValidationIssue[];
  summary: {
    audience_count: number;
    scenario_count: number;
    need_count: number;
    task_step_count: number;
    adjacent_opportunity_count: number;
    direct_opportunity_count: number;
    referenced_observation_count: number;
    source_family_count: number;
    platform_count: number;
    mapping_error_count: number;
  };
};
