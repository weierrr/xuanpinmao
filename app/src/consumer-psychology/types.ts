import { z } from "zod";
import { isoDateTimeSchema } from "../research/types";

export const consumerDecisionStages = [
  "situational_trigger",
  "tension_activation",
  "identity_projection",
  "outcome_imagination",
  "belief_formation",
  "risk_reduction",
] as const;

export const consumerPsychologyMechanisms = [
  "situational_trigger",
  "self_discrepancy",
  "loss_aversion",
  "identity_projection",
  "cognitive_fluency",
  "belief_formation",
  "uncertainty_reduction",
  "risk_reversal",
] as const;

export const consumerPsychologyEvidenceStatuses = [
  "supported",
  "directional",
  "hypothesis",
  "prohibited",
] as const;

export const consumerPsychologyScopes = [
  "category_user",
  "competitor_journey",
  "proposed_offer",
  "target_product",
] as const;

export const consumerPsychologyBases = [
  "direct_user_expression",
  "evidence_synthesis",
  "model_hypothesis",
] as const;

const idList = z.array(z.string().trim().min(1));

export const consumerDecisionStageSchema = z.object({
  id: z.string().trim().min(1),
  stage: z.enum(consumerDecisionStages),
  mechanism: z.enum(consumerPsychologyMechanisms),
  scope: z.enum(consumerPsychologyScopes),
  basis: z.enum(consumerPsychologyBases),
  conclusion: z.string().trim().min(10),
  evidence_status: z.enum(consumerPsychologyEvidenceStatuses),
  supporting_observation_ids: idList,
  supporting_claim_ids: idList,
  supporting_demand_atom_ids: idList,
  counterevidence_observation_ids: idList,
  counterevidence_claim_ids: idList,
  unknowns: z.array(z.string().trim().min(3)),
  validation_needed: z.array(z.string().trim().min(3)),
  claim_boundary: z.string().trim().min(5),
}).strict().superRefine((node, context) => {
  const evidenceCount = node.supporting_observation_ids.length
    + node.supporting_claim_ids.length
    + node.supporting_demand_atom_ids.length;
  if (node.evidence_status !== "prohibited" && evidenceCount === 0) {
    context.addIssue({
      code: "custom",
      path: ["supporting_observation_ids"],
      message: "Every active psychology stage requires current-run evidence",
    });
  }
  if (node.evidence_status === "supported" && node.basis !== "direct_user_expression") {
    context.addIssue({
      code: "custom",
      path: ["basis"],
      message: "Supported psychology requires a direct user expression basis",
    });
  }
  if (node.basis === "direct_user_expression" && node.supporting_observation_ids.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["supporting_observation_ids"],
      message: "Direct user expression basis requires a VOC Observation",
    });
  }
  if (node.evidence_status === "hypothesis" && node.validation_needed.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["validation_needed"],
      message: "A psychology hypothesis requires an explicit validation step",
    });
  }
});

export const consumerDecisionChainArtifactSchema = z.object({
  schema_version: z.literal("1.0"),
  run_id: z.string().trim().min(8),
  product: z.string().trim().min(2),
  market: z.string().trim().min(2),
  generated_at: isoDateTimeSchema,
  methodology: z.literal("CONSUMER_PSYCHOLOGY_DECISION_CHAIN_V1"),
  source_artifacts: z.object({
    voc_corpus: z.string().trim().min(3),
    first_principles_bundle: z.string().trim().min(3),
    claims: z.string().trim().min(3),
  }).strict(),
  stages: z.array(consumerDecisionStageSchema).length(consumerDecisionStages.length),
  overall_boundary: z.string().trim().min(10),
  ethical_boundary: z.object({
    no_manufactured_shame: z.literal(true),
    no_sensitive_trait_inference: z.literal(true),
    no_unverified_health_claims: z.literal(true),
  }).strict(),
  decision_boundary: z.object({
    current_product_decision_unchanged: z.literal(true),
    target_sku_performance_not_proven: z.literal(true),
    marketing_remains_draft_for_validation: z.literal(true),
    no_automatic_listing_or_ad_approval: z.literal(true),
  }).strict(),
}).strict();

export type ConsumerDecisionStage = z.infer<typeof consumerDecisionStageSchema>;
export type ConsumerDecisionChainArtifact = z.infer<typeof consumerDecisionChainArtifactSchema>;

export type ConsumerPsychologyValidationIssue = {
  code: string;
  message: string;
  path?: string;
  nodeId?: string;
  evidenceId?: string;
};

export type ConsumerPsychologyValidationResult = {
  valid: boolean;
  run_id: string;
  errors: ConsumerPsychologyValidationIssue[];
  warnings: ConsumerPsychologyValidationIssue[];
  summary: {
    stage_count: number;
    supported_count: number;
    directional_count: number;
    hypothesis_count: number;
    prohibited_count: number;
    referenced_observation_count: number;
    referenced_claim_count: number;
    referenced_demand_atom_count: number;
    counterevidence_count: number;
    mapping_error_count: number;
  };
};
