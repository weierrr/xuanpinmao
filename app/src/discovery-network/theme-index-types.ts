import { z } from "zod";
import { discoveryEvidenceStatuses } from "./types";

export const discoveryThemeKinds = ["audience", "scenario", "need", "opportunity"] as const;
export const discoveryThemeNormalizationMethods = ["exact", "controlled_alias"] as const;
export const discoveryThemeReviewStatuses = ["single_run", "human_review_required"] as const;

export const discoveryThemeMemberSchema = z.object({
  nodeId: z.string().trim().min(5),
  runId: z.string().trim().min(8),
  label: z.string().trim().min(2),
  evidenceStatus: z.enum(discoveryEvidenceStatuses),
  evidenceCount: z.number().int().nonnegative(),
  reportUrl: z.string().trim().min(1),
}).strict();

export const discoveryThemeClusterSchema = z.object({
  id: z.string().trim().min(8),
  kind: z.enum(discoveryThemeKinds),
  canonicalKey: z.string().trim().min(3),
  canonicalLabel: z.string().trim().min(2),
  normalizationMethod: z.enum(discoveryThemeNormalizationMethods),
  runIds: z.array(z.string().trim().min(8)).min(1),
  members: z.array(discoveryThemeMemberSchema).min(1),
  boundedEvidenceCountSum: z.number().int().nonnegative(),
  crossRunCandidate: z.boolean(),
  reviewStatus: z.enum(discoveryThemeReviewStatuses),
  boundary: z.string().trim().min(12),
}).strict();

export const discoveryThemeIndexSchema = z.object({
  schemaVersion: z.literal("1.0"),
  generatedAt: z.iso.datetime(),
  sourceNetworkVersion: z.literal("1.0"),
  runIds: z.array(z.string().trim().min(8)).min(1),
  clusters: z.array(discoveryThemeClusterSchema),
  metrics: z.object({
    clusterCount: z.number().int().nonnegative(),
    crossRunCandidateCount: z.number().int().nonnegative(),
    singleRunClusterCount: z.number().int().nonnegative(),
    controlledAliasClusterCount: z.number().int().nonnegative(),
  }).strict(),
  boundaries: z.array(z.string().trim().min(12)).min(3),
}).strict();

export type DiscoveryThemeIndex = z.infer<typeof discoveryThemeIndexSchema>;
export type DiscoveryThemeCluster = z.infer<typeof discoveryThemeClusterSchema>;

export type DiscoveryThemeIndexValidationIssue = {
  code: string;
  message: string;
  clusterId?: string;
  nodeId?: string;
};

export type DiscoveryThemeIndexValidationResult = {
  valid: boolean;
  errors: DiscoveryThemeIndexValidationIssue[];
  warnings: DiscoveryThemeIndexValidationIssue[];
};
