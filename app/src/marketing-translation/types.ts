import { z } from "zod";

export const marketingEvidenceStatuses = ["supported", "directional", "hypothesis", "prohibited"] as const;
export const marketingUsageStatuses = ["draft_for_validation", "ready_for_use"] as const;
export const marketingEvidenceObjectTypes = [
  "claim",
  "voc_cluster",
  "voc_observation",
  "demand_atom",
  "demand_field_need",
  "consumer_psychology_stage",
  "sample_test",
  "compliance_review",
] as const;

export const marketingDecisionRoles = ["hook", "promise", "proof", "offer", "cta"] as const;

export const marketingEvidenceRefSchema = z.object({
  objectType: z.enum(marketingEvidenceObjectTypes),
  id: z.string().trim().min(1),
}).strict();

export const messagePillarSchema = z.object({
  id: z.string().trim().min(1),
  productSellingPoint: z.string().trim().min(3),
  customerBenefit: z.string().trim().min(3),
  useScenario: z.string().trim().min(3),
  emotionalValue: z.string().trim().min(3),
  marketingCopy: z.string().trim().min(3),
  evidenceStatus: z.enum(marketingEvidenceStatuses),
  evidenceRefs: z.array(marketingEvidenceRefSchema).min(1),
  supportingClaimIds: z.array(z.string().trim().min(1)),
  validationNeeded: z.array(z.string().trim().min(3)),
  decisionRole: z.enum(marketingDecisionRoles).optional(),
}).strict();

export const prohibitedMarketingClaimSchema = z.object({
  claim: z.string().trim().min(3),
  reason: z.string().trim().min(3),
  category: z.enum([
    "medical",
    "permanent_effect",
    "certification",
    "patent",
    "performance_number",
    "scarcity",
    "target_sku_unverified",
    "other",
  ]),
  evidenceStatus: z.literal("prohibited"),
}).strict();

export const marketingValidationExperimentTypes = [
  "landing_page_concept_test",
  "ad_angle_test",
  "price_value_test",
  "user_interview",
  "content_engagement_test",
  "sample_performance_test",
  "claim_compliance_review",
] as const;

export const marketingValidationExperimentSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(marketingValidationExperimentTypes),
  name: z.string().trim().min(3),
  keyHypothesis: z.string().trim().min(5),
  marketingExpression: z.string().trim().min(3),
  targetAudience: z.string().trim().min(3),
  metric: z.string().trim().min(2),
  passThreshold: z.string().trim().min(3),
  failThreshold: z.string().trim().min(3),
  stopCondition: z.string().trim().min(3),
  nextIfPass: z.string().trim().min(3),
  nextIfFail: z.string().trim().min(3),
  psychologyStageIds: z.array(z.string().trim().min(1)).optional(),
}).strict();

const channelDraftSchema = z.object({
  status: z.enum(marketingUsageStatuses),
  text: z.string().trim().min(3),
  evidenceStatus: z.enum(marketingEvidenceStatuses),
  evidenceRefs: z.array(marketingEvidenceRefSchema).min(1),
  decisionRole: z.enum(marketingDecisionRoles).optional(),
}).strict();

export const marketingDecisionChainMappingSchema = z.object({
  role: z.enum(marketingDecisionRoles),
  expression: z.string().trim().min(3),
  sourceStageIds: z.array(z.string().trim().min(1)).min(1),
  evidenceStatus: z.enum(marketingEvidenceStatuses),
  evidenceRefs: z.array(marketingEvidenceRefSchema).min(1),
  validationNeeded: z.array(z.string().trim().min(3)),
}).strict();

export const marketingDecisionChainSchema = z.object({
  sourceArtifact: z.literal("consumer_psychology_decision_chain"),
  sourceGeneratedAt: z.iso.datetime(),
  mappings: z.array(marketingDecisionChainMappingSchema).length(marketingDecisionRoles.length),
  boundary: z.string().trim().min(10),
}).strict().superRefine((chain, context) => {
  marketingDecisionRoles.forEach((role, index) => {
    if (chain.mappings[index]?.role !== role) {
      context.addIssue({
        code: "custom",
        path: ["mappings", index, "role"],
        message: `Marketing decision-chain mapping ${index + 1} must be ${role}`,
      });
    }
  });
});

export const conceptMessageArchitectureSchema = z.object({
  status: z.literal("draft_for_validation"),
  targetSegment: z.string().trim().min(3),
  coreJobOrPain: z.string().trim().min(3),
  differentiatedProductStructure: z.string().trim().min(3),
  valueProposition: z.string().trim().min(3),
  messagePillars: z.array(messagePillarSchema).min(2).max(4),
  useScenarios: z.array(z.string().trim().min(3)).min(1),
  functionalBenefits: z.array(z.string().trim().min(3)).min(1),
  emotionalValues: z.array(z.string().trim().min(3)).min(1),
  oneSentenceConcept: z.string().trim().min(3),
  evidenceRefs: z.array(marketingEvidenceRefSchema).min(1),
  evidenceStrength: z.enum(["supported", "directional", "hypothesis"]),
  hypothesesToValidate: z.array(z.string().trim().min(3)).min(1),
  prohibitedClaims: z.array(prohibitedMarketingClaimSchema).min(1),
}).strict();

export const marketingTranslationSchema = z.object({
  schemaVersion: z.literal("1.0"),
  status: z.enum(marketingUsageStatuses),
  valueProposition: z.string().trim().min(3),
  decisionChain: marketingDecisionChainSchema.optional(),
  messagePillars: z.array(messagePillarSchema).min(2).max(4),
  channelDrafts: z.object({
    listingTitle: channelDraftSchema,
    hero: z.object({
      status: z.enum(marketingUsageStatuses),
      headline: z.string().trim().min(3),
      subheadline: z.string().trim().min(3),
      evidenceStatus: z.enum(marketingEvidenceStatuses),
      evidenceRefs: z.array(marketingEvidenceRefSchema).min(1),
      decisionRole: z.enum(marketingDecisionRoles).optional(),
    }).strict(),
    adAngles: z.array(channelDraftSchema).min(3).max(5),
    contentHooks: z.array(channelDraftSchema).min(3).max(5),
  }).strict(),
  objections: z.array(z.object({
    objection: z.string().trim().min(3),
    responseDirection: z.string().trim().min(3),
    evidenceStatus: z.enum(marketingEvidenceStatuses),
    evidenceRefs: z.array(marketingEvidenceRefSchema).min(1),
  }).strict()).min(1),
  nonGoals: z.array(z.string().trim().min(3)).min(1),
  prohibitedClaims: z.array(prohibitedMarketingClaimSchema).min(1),
  usageBoundaries: z.array(z.string().trim().min(3)).min(1),
  validationExperiments: z.array(marketingValidationExperimentSchema)
    .length(marketingValidationExperimentTypes.length),
  generatedAt: z.iso.datetime(),
}).strict().superRefine((translation, context) => {
  if (translation.status === "draft_for_validation") {
    const readyDraft = [
      translation.channelDrafts.listingTitle,
      translation.channelDrafts.hero,
      ...translation.channelDrafts.adAngles,
      ...translation.channelDrafts.contentHooks,
    ].some((draft) => draft.status === "ready_for_use");
    if (readyDraft) {
      context.addIssue({
        code: "custom",
        path: ["channelDrafts"],
        message: "Draft marketing translation cannot contain ready_for_use channel copy",
      });
    }
  }
});

export type MarketingEvidenceRef = z.infer<typeof marketingEvidenceRefSchema>;
export type MessagePillar = z.infer<typeof messagePillarSchema>;
export type ConceptMessageArchitecture = z.infer<typeof conceptMessageArchitectureSchema>;
export type MarketingTranslation = z.infer<typeof marketingTranslationSchema>;
export type MarketingValidationExperiment = z.infer<typeof marketingValidationExperimentSchema>;
export type MarketingDecisionRole = (typeof marketingDecisionRoles)[number];
export type MarketingDecisionChain = z.infer<typeof marketingDecisionChainSchema>;
