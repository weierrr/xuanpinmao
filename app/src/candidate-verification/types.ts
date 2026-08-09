import { z } from "zod";

export const candidateVerificationStatuses = ["awaiting_candidate", "identified", "verified"] as const;
export const candidateEvidenceStatuses = ["verified", "directional", "unverified", "blocked"] as const;
export const candidateMatchLevels = ["exact", "near", "adjacent", "mismatch"] as const;
export const candidateEvidenceModuleKeys = [
  "product_identity",
  "variant_applicability",
  "comparable_price",
  "supply_terms",
  "target_performance",
  "content_reference",
] as const;

export const candidateEvidenceModuleSchema = z.object({
  key: z.enum(candidateEvidenceModuleKeys),
  label: z.string().trim().min(2),
  status: z.enum(candidateEvidenceStatuses),
  statusLabel: z.string().trim().min(2),
  conclusion: z.string().trim().min(5),
  reason: z.string().trim().min(5),
  nextVerification: z.string().trim().min(5),
}).strict();

export const candidateMatchRuleSchema = z.object({
  level: z.enum(candidateMatchLevels),
  label: z.string().trim().min(2),
  definition: z.string().trim().min(8),
  priceUse: z.string().trim().min(8),
}).strict();

export const candidateProductSchema = z.object({
  platform: z.string().trim().min(2),
  url: z.url(),
  productName: z.string().trim().min(3),
  brandOrSupplier: z.string().trim().min(2).nullable(),
  selectedVariant: z.string().trim().min(2).nullable(),
  availableVariants: z.array(z.string().trim().min(1)),
  imageUrl: z.url().nullable(),
}).strict();

export const candidateVariantFactSchema = z.object({
  fact: z.string().trim().min(3),
  appliesTo: z.string().trim().min(2),
  status: z.enum(candidateEvidenceStatuses),
  evidence: z.string().trim().min(3),
}).strict();

export const candidateMatchAssessmentSchema = z.object({
  level: z.enum(candidateMatchLevels),
  label: z.string().trim().min(2),
  rationale: z.string().trim().min(8),
  comparablePriceAllowed: z.boolean(),
  missingDimensions: z.array(z.string().trim().min(2)),
}).strict();

export const referenceContentSchema = z.object({
  id: z.string().trim().min(2),
  sourceType: z.enum(["product_page", "review", "ad_library", "video", "social_post"]),
  platform: z.string().trim().min(2),
  title: z.string().trim().min(3),
  url: z.url(),
  status: z.enum(candidateEvidenceStatuses),
  statusLabel: z.string().trim().min(2),
  use: z.string().trim().min(5),
  boundary: z.string().trim().min(5),
}).strict();

export const candidateVerificationWorkspaceSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  status: z.enum(candidateVerificationStatuses),
  statusLabel: z.string().trim().min(2),
  targetDefinition: z.object({
    direction: z.string().trim().min(3),
    productConcept: z.string().trim().min(10),
    mustHave: z.array(z.string().trim().min(2)).min(3),
  }).strict(),
  acceptedInputs: z.array(z.enum(["1688_link", "amazon_link", "supplier_link", "product_image", "supplier_spec"])).min(2),
  submissionPrompt: z.string().trim().min(10),
  candidate: candidateProductSchema.nullable(),
  variantFacts: z.array(candidateVariantFactSchema),
  matchAssessment: candidateMatchAssessmentSchema.nullable(),
  matchRules: z.array(candidateMatchRuleSchema).length(candidateMatchLevels.length),
  evidenceModules: z.array(candidateEvidenceModuleSchema).length(candidateEvidenceModuleKeys.length),
  actionLanes: z.object({
    canDo: z.array(z.string().trim().min(3)).min(1),
    mustConfirm: z.array(z.string().trim().min(3)).min(1),
    cannotDo: z.array(z.string().trim().min(3)).min(1),
  }).strict(),
  references: z.array(referenceContentSchema),
  boundary: z.string().trim().min(10),
}).strict().superRefine((workspace, context) => {
  candidateMatchLevels.forEach((level, index) => {
    if (workspace.matchRules[index]?.level !== level) {
      context.addIssue({
        code: "custom",
        path: ["matchRules", index, "level"],
        message: `Candidate match rule ${index + 1} must be ${level}`,
      });
    }
  });
  candidateEvidenceModuleKeys.forEach((key, index) => {
    if (workspace.evidenceModules[index]?.key !== key) {
      context.addIssue({
        code: "custom",
        path: ["evidenceModules", index, "key"],
        message: `Candidate evidence module ${index + 1} must be ${key}`,
      });
    }
  });
  if (workspace.status === "awaiting_candidate") {
    if (workspace.candidate !== null) {
      context.addIssue({ code: "custom", path: ["candidate"], message: "Awaiting-candidate workspace cannot contain a candidate" });
    }
    if (workspace.matchAssessment !== null) {
      context.addIssue({ code: "custom", path: ["matchAssessment"], message: "Awaiting-candidate workspace cannot publish a match assessment" });
    }
    if (workspace.variantFacts.length > 0) {
      context.addIssue({ code: "custom", path: ["variantFacts"], message: "Awaiting-candidate workspace cannot publish variant facts" });
    }
  } else if (!workspace.candidate || !workspace.matchAssessment) {
    context.addIssue({ code: "custom", path: ["candidate"], message: "Identified candidate requires product identity and match assessment" });
  }
});

export type CandidateVerificationWorkspace = z.infer<typeof candidateVerificationWorkspaceSchema>;
export type CandidateEvidenceStatus = (typeof candidateEvidenceStatuses)[number];
