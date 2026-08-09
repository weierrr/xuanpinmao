import { z } from "zod";

export const opportunityValidationPriorities = [
  "E1_RESEARCH_NEXT",
  "E2_RESEARCH_LATER",
  "E3_OBSERVE",
  "DO_NOT_CONTINUE",
] as const;

export const opportunityValidationEvidenceStatuses = ["supported", "directional", "hypothesis"] as const;

export const opportunityValidationCandidateSchema = z.object({
  id: z.string().trim().min(6),
  runId: z.string().trim().min(8),
  opportunityId: z.string().trim().min(3),
  title: z.string().trim().min(2),
  category: z.string().trim().min(2),
  priority: z.enum(opportunityValidationPriorities),
  priorityLabel: z.string().trim().min(2),
  order: z.number().int().positive(),
  whyThisPriority: z.string().trim().min(12),
  relationships: z.array(z.string().trim().min(2)).min(1),
  evidence: z.object({
    status: z.enum(opportunityValidationEvidenceStatuses),
    statusLabel: z.string().trim().min(2),
    directProductEvidence: z.boolean(),
    supportCount: z.number().int().nonnegative(),
    counterevidenceCount: z.number().int().nonnegative(),
    balanceLabel: z.string().trim().min(2),
    boundary: z.string().trim().min(12),
  }).strict(),
  researchPlan: z.object({
    objective: z.string().trim().min(8),
    questions: z.array(z.string().trim().min(5)).min(1),
    queries: z.array(z.string().trim().min(5)).min(2),
    pass: z.string().trim().min(12),
    fail: z.string().trim().min(12),
    stop: z.string().trim().min(12),
    budgetLabel: z.string().trim().min(5),
    durationLabel: z.string().trim().min(2),
    nextIfPass: z.string().trim().min(8),
    nextIfFail: z.string().trim().min(8),
  }).strict(),
}).strict().superRefine((candidate, context) => {
  if (candidate.priority === "E1_RESEARCH_NEXT" && !candidate.evidence.directProductEvidence) {
    context.addIssue({
      code: "custom",
      path: ["priority"],
      message: "Exploration priority 1 requires direct product evidence",
    });
  }
  if (!candidate.evidence.directProductEvidence && candidate.evidence.status !== "hypothesis") {
    context.addIssue({
      code: "custom",
      path: ["evidence", "status"],
      message: "Candidate without direct product evidence must remain a hypothesis",
    });
  }
});

export const opportunityValidationRoadmapSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  generatedAt: z.iso.datetime(),
  title: z.literal("机会验证优先级与行动路线图"),
  recommendedCandidateId: z.string().trim().min(6).nullable(),
  candidates: z.array(opportunityValidationCandidateSchema),
  metrics: z.object({
    total: z.number().int().nonnegative(),
    exploreFirst: z.number().int().nonnegative(),
    researchLater: z.number().int().nonnegative(),
    observe: z.number().int().nonnegative(),
    doNotContinue: z.number().int().nonnegative(),
  }).strict(),
  orderingRule: z.string().trim().min(12),
  boundaries: z.array(z.string().trim().min(12)).min(3),
}).strict();

export type OpportunityValidationCandidate = z.infer<typeof opportunityValidationCandidateSchema>;
export type OpportunityValidationRoadmap = z.infer<typeof opportunityValidationRoadmapSchema>;

export type OpportunityValidationIssue = {
  code: string;
  message: string;
  candidateId?: string;
};

export type OpportunityValidationResult = {
  valid: boolean;
  errors: OpportunityValidationIssue[];
  warnings: OpportunityValidationIssue[];
};
