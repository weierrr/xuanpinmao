import { z } from "zod";
import { discoveryThemeKinds } from "./theme-index-types";

export const discoveryOpportunityQueueStatuses = ["pending_review"] as const;

export const discoveryOpportunityCandidateSchema = z.object({
  id: z.string().trim().min(8),
  clusterId: z.string().trim().min(8),
  status: z.enum(discoveryOpportunityQueueStatuses),
  kind: z.enum(discoveryThemeKinds),
  canonicalLabel: z.string().trim().min(2),
  sourceRunIds: z.array(z.string().trim().min(8)).min(2),
  sourceNodeIds: z.array(z.string().trim().min(5)).min(2),
  whyCandidate: z.string().trim().min(12),
  reviewQuestions: z.array(z.string().trim().min(8)).min(4),
  canCreateResearchRun: z.literal(false),
  boundary: z.string().trim().min(12),
}).strict();

export const discoveryOpportunityQueueSchema = z.object({
  schemaVersion: z.literal("1.0"),
  generatedAt: z.iso.datetime(),
  sourceThemeIndexVersion: z.literal("1.0"),
  candidates: z.array(discoveryOpportunityCandidateSchema),
  metrics: z.object({
    candidateCount: z.number().int().nonnegative(),
    pendingReviewCount: z.number().int().nonnegative(),
    researchRunReadyCount: z.literal(0),
  }).strict(),
  boundaries: z.array(z.string().trim().min(12)).min(3),
}).strict();

export type DiscoveryOpportunityQueue = z.infer<typeof discoveryOpportunityQueueSchema>;
export type DiscoveryOpportunityCandidate = z.infer<typeof discoveryOpportunityCandidateSchema>;

export type DiscoveryOpportunityQueueValidationIssue = {
  code: string;
  message: string;
  candidateId?: string;
};

export type DiscoveryOpportunityQueueValidationResult = {
  valid: boolean;
  errors: DiscoveryOpportunityQueueValidationIssue[];
  warnings: DiscoveryOpportunityQueueValidationIssue[];
};
