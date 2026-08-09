import { z } from "zod";
import { isoDateTimeSchema } from "../research/types";

export const confidenceSchema = z.enum(["high", "medium", "low"]);
export const evidenceStatusSchema = z.enum(["supported", "directional", "hypothesis", "unknown"]);
export const reasoningScopeSchema = z.enum(["competitor", "market", "target_product", "supplier_candidate", "user_need"]);

export const reasoningItemSchema = z
  .object({
    id: z.string().trim().min(1),
    statement: z.string().trim().min(3),
    classification: z.enum(["fact", "hypothesis", "unknown"]),
    scope: reasoningScopeSchema,
    supporting_claim_ids: z.array(z.string().trim().min(1)),
    confidence: confidenceSchema,
    rationale: z.string().trim().min(3),
    validation_required: z.boolean(),
  })
  .superRefine((item, context) => {
    if (item.classification === "fact" && item.supporting_claim_ids.length === 0) {
      context.addIssue({ code: "custom", path: ["supporting_claim_ids"], message: "fact requires at least one supporting Claim" });
    }
    if (item.classification !== "fact" && item.confidence === "high") {
      context.addIssue({ code: "custom", path: ["confidence"], message: "hypothesis and unknown cannot use high confidence" });
    }
    if (item.classification === "unknown" && !item.validation_required) {
      context.addIssue({ code: "custom", path: ["validation_required"], message: "unknown must require validation" });
    }
  });

export const problemReframeSchema = z.object({
  surface_product: z.string().trim().min(2),
  conventional_question: z.string().trim().min(3),
  reframed_problem: z.string().trim().min(10),
  target_user: z.string().trim().min(3),
  triggering_scenario: z.string().trim().min(3),
  desired_outcome: z.string().trim().min(3),
  willingness_to_pay_reason: z.string().trim().min(3),
  supporting_claim_ids: z.array(z.string().trim().min(1)),
  assumptions: z.array(z.string().trim().min(1)),
});

export const demandAtomSchema = z.object({
  id: z.string().trim().min(1),
  user_segment: z.string().trim().min(3),
  scenario: z.string().trim().min(3),
  trigger: z.string().trim().min(3),
  pain_or_job: z.string().trim().min(3),
  desired_outcome: z.string().trim().min(3),
  current_alternative: z.string().trim().min(1).nullable(),
  current_alternative_gap: z.string().trim().min(1).nullable(),
  importance: z.enum(["high", "medium", "low"]),
  evidence_status: evidenceStatusSchema,
  supporting_claim_ids: z.array(z.string().trim().min(1)),
  confidence: confidenceSchema,
});

export const supplyAtomSchema = z.object({
  id: z.string().trim().min(1),
  category: z.enum([
    "material",
    "process",
    "structure",
    "feature",
    "accessory",
    "packaging",
    "supplier_capability",
    "content_asset",
    "channel_asset",
    "service",
  ]),
  name: z.string().trim().min(2),
  description: z.string().trim().min(3),
  independently_sourceable: z.boolean(),
  cost_visibility: z.enum(["clear", "partial", "unknown"]),
  customization_level: z.enum(["existing", "light_customization", "deep_customization"]),
  supplier_or_source_signal_claim_ids: z.array(z.string().trim().min(1)),
  target_sku_verified: z.boolean(),
  confidence: confidenceSchema,
});

export const constraintItemSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(["hard", "soft", "pseudo"]),
  statement: z.string().trim().min(3),
  impact: z.string().trim().min(3),
  design_response: z.string().trim().min(3),
  supporting_claim_ids: z.array(z.string().trim().min(1)),
  confidence: confidenceSchema,
});

export const opportunityScoreSchema = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  status: z.enum(["scored", "not_scored"]),
  rationale: z.string().trim().min(3),
  claim_ids: z.array(z.string().trim().min(1)),
}).superRefine((item, context) => {
  if (item.status === "scored" && item.score === null) {
    context.addIssue({ code: "custom", path: ["score"], message: "scored dimension requires a score" });
  }
  if (item.status === "not_scored" && item.score !== null) {
    context.addIssue({ code: "custom", path: ["score"], message: "not_scored dimension must use null" });
  }
});

export const opportunityScoresSchema = z.object({
  demand_fit: opportunityScoreSchema,
  evidence_strength: opportunityScoreSchema,
  differentiation: opportunityScoreSchema,
  supply_feasibility: opportunityScoreSchema,
  constraint_fit: opportunityScoreSchema,
  validation_cost: opportunityScoreSchema,
  monetization_potential: opportunityScoreSchema,
  risk_exposure: opportunityScoreSchema,
});

export const opportunityHypothesisSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(3),
  target_demand_atom_ids: z.array(z.string().trim().min(1)).min(1),
  supply_atom_ids: z.array(z.string().trim().min(1)).min(1),
  product_or_offer_concept: z.string().trim().min(5),
  target_customer: z.string().trim().min(3),
  target_scenario: z.string().trim().min(3),
  core_value_proposition: z.string().trim().min(5),
  differentiation: z.array(z.string().trim().min(1)).min(1),
  explicit_non_goals: z.array(z.string().trim().min(1)).min(1),
  required_claim_ids: z.array(z.string().trim().min(1)),
  unsupported_assumptions: z.array(z.string().trim().min(1)),
  primary_risks: z.array(z.string().trim().min(1)).min(1),
  feasibility: z.enum(["high", "medium", "low"]),
  desirability: z.enum(["high", "medium", "low"]),
  evidence_strength: z.enum(["high", "medium", "low"]),
  estimated_test_cost_level: z.enum(["low", "medium", "high"]),
  scores: opportunityScoresSchema,
  score: z.number().int().min(0).max(100),
  score_rationale: z.string().trim().min(5),
});

export const validationExperimentSchema = z.object({
  id: z.string().trim().min(1),
  opportunity_id: z.string().trim().min(1),
  critical_assumption: z.string().trim().min(3),
  test_type: z.enum([
    "interview",
    "concept_test",
    "landing_page",
    "sample_test",
    "supplier_validation",
    "pricing_test",
    "content_test",
    "organic_demand_test",
    "unit_economics_check",
  ]),
  target_participant_or_source: z.string().trim().min(3),
  method: z.string().trim().min(5),
  sample_size_or_scope: z.string().trim().min(1),
  budget_cap: z.string().trim().min(1),
  duration_days: z.number().int().min(1).max(14),
  metric: z.string().trim().min(3),
  pass_threshold: z.string().trim().min(2),
  fail_threshold: z.string().trim().min(2),
  stop_condition: z.string().trim().min(2),
  next_action_if_pass: z.string().trim().min(3),
  next_action_if_fail: z.string().trim().min(3),
});

export const decisionSummarySchema = z.object({
  first_principles_recommendation: z.string().trim().min(5),
  product_selection_decision: z.enum(["PROCEED_TO_SAMPLE", "HOLD_RESEARCH", "REJECT"]),
  formal_sku_decision: z.enum(["HOLD_SUPPLY", "GO", "REJECT"]),
  listing_allowed: z.boolean(),
  ad_test_allowed: z.boolean(),
  evidence_strength: z.enum(["high", "medium", "low"]),
  entry_conditions: z.array(z.string().trim().min(1)).min(1),
  boundary_rationale: z.string().trim().min(5),
});

export const firstPrinciplesResourcesSchema = z.object({
  budget: z.string().nullable(),
  available_time: z.string().nullable(),
  team_size: z.number().int().positive().nullable(),
  current_supplier_resources: z.array(z.string()),
  current_channel_assets: z.array(z.string()),
  current_content_assets: z.array(z.string()),
  acceptable_moq: z.string().nullable(),
  target_margin: z.string().nullable(),
  unacceptable_risks: z.array(z.string()),
  preferred_business_model: z.string().nullable(),
  validation_goal: z.string().nullable(),
});

export const firstPrinciplesBundleSchema = z.object({
  schema_version: z.literal("1.0"),
  run_id: z.string().trim().min(8),
  product: z.string().trim().min(2),
  market: z.string().trim().min(2),
  generated_at: isoDateTimeSchema,
  methodology: z.literal("SACL"),
  resources: firstPrinciplesResourcesSchema,
  problem_reframe: problemReframeSchema,
  fact_hypothesis_unknown: z.object({
    facts: z.array(reasoningItemSchema).min(1),
    hypotheses: z.array(reasoningItemSchema).min(1),
    unknowns: z.array(reasoningItemSchema).min(1),
  }),
  demand_atoms: z.array(demandAtomSchema).min(1),
  supply_atoms: z.array(supplyAtomSchema).min(1),
  constraints: z.object({
    hard: z.array(constraintItemSchema).min(1),
    soft: z.array(constraintItemSchema),
    pseudo: z.array(constraintItemSchema).min(1),
  }),
  opportunity_hypotheses: z.array(opportunityHypothesisSchema).min(2).max(4),
  recommended_opportunity_id: z.string().trim().min(1).nullable(),
  recommendation_rationale: z.string().trim().min(5),
  alternatives_not_recommended: z.array(z.object({ opportunity_id: z.string().trim().min(1), reason: z.string().trim().min(3) })),
  validation_plan: z.array(validationExperimentSchema).min(1),
  decision_summary: decisionSummarySchema,
});

export type FirstPrinciplesBundle = z.infer<typeof firstPrinciplesBundleSchema>;
export type FirstPrinciplesResources = z.infer<typeof firstPrinciplesResourcesSchema>;
export type OpportunityHypothesis = z.infer<typeof opportunityHypothesisSchema>;
export type ValidationExperiment = z.infer<typeof validationExperimentSchema>;

export type FirstPrinciplesValidationIssue = {
  code: string;
  path?: string;
  message: string;
};

export type FirstPrinciplesValidationResult = {
  valid: boolean;
  run_id?: string;
  errors: FirstPrinciplesValidationIssue[];
  warnings: FirstPrinciplesValidationIssue[];
  summary: {
    facts: number;
    hypotheses: number;
    unknowns: number;
    demand_atoms: number;
    supply_atoms: number;
    opportunities: number;
    experiments: number;
    validation_duration_days: number | null;
  };
};
