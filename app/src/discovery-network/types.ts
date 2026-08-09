import { z } from "zod";

export const discoveryNodeKinds = ["product", "audience", "scenario", "need", "opportunity"] as const;
export const discoveryEvidenceStatuses = ["supported", "directional", "hypothesis"] as const;
export const discoveryProvenanceKinds = ["observed", "inferred"] as const;
export const discoveryRelationshipKinds = [
  "SERVES_AUDIENCE",
  "OCCURS_IN_SCENARIO",
  "EXPOSES_NEED",
  "ADJACENT_OPPORTUNITY",
] as const;

export const discoveryEvidenceRefSchema = z.object({
  kind: z.enum(["report", "voc_observation", "demand_field"]),
  referenceId: z.string().trim().min(3),
  url: z.string().trim().min(1),
  label: z.string().trim().min(2),
}).strict();

export const discoveryNetworkNodeSchema = z.object({
  id: z.string().trim().min(5),
  kind: z.enum(discoveryNodeKinds),
  runId: z.string().trim().min(8),
  productNodeId: z.string().trim().min(5),
  label: z.string().trim().min(2),
  description: z.string().trim().min(6),
  evidenceStatus: z.enum(discoveryEvidenceStatuses),
  evidenceCount: z.number().int().nonnegative(),
  reportUrl: z.string().trim().min(1),
  metadata: z.object({
    market: z.string().trim().min(2),
    decisionLabel: z.string().trim().min(2).nullable(),
    category: z.string().trim().min(2).nullable(),
    directProductEvidence: z.boolean().nullable(),
  }).strict(),
}).strict();

export const discoveryNetworkEdgeSchema = z.object({
  id: z.string().trim().min(5),
  runId: z.string().trim().min(8),
  sourceNodeId: z.string().trim().min(5),
  targetNodeId: z.string().trim().min(5),
  relationship: z.enum(discoveryRelationshipKinds),
  relationshipLabel: z.string().trim().min(2),
  provenance: z.enum(discoveryProvenanceKinds),
  evidenceStatus: z.enum(discoveryEvidenceStatuses),
  evidenceRefs: z.array(discoveryEvidenceRefSchema).min(1),
  boundary: z.string().trim().min(12),
}).strict().superRefine((edge, context) => {
  if (edge.evidenceStatus === "hypothesis" && edge.provenance !== "inferred") {
    context.addIssue({
      code: "custom",
      path: ["provenance"],
      message: "Hypothesis relationships must remain inferred",
    });
  }
});

export const discoveryNetworkSchema = z.object({
  schemaVersion: z.literal("1.0"),
  generatedAt: z.iso.datetime(),
  title: z.literal("人群需求发现网络"),
  runIds: z.array(z.string().trim().min(8)).min(1),
  nodes: z.array(discoveryNetworkNodeSchema).min(1),
  edges: z.array(discoveryNetworkEdgeSchema),
  metrics: z.object({
    productCount: z.number().int().min(1),
    audienceCount: z.number().int().nonnegative(),
    scenarioCount: z.number().int().nonnegative(),
    needCount: z.number().int().nonnegative(),
    opportunityCount: z.number().int().nonnegative(),
    observedEdgeCount: z.number().int().nonnegative(),
    inferredEdgeCount: z.number().int().nonnegative(),
  }).strict(),
  boundaries: z.array(z.string().trim().min(12)).min(3),
}).strict();

export type DiscoveryNetwork = z.infer<typeof discoveryNetworkSchema>;
export type DiscoveryNetworkNode = z.infer<typeof discoveryNetworkNodeSchema>;
export type DiscoveryNetworkEdge = z.infer<typeof discoveryNetworkEdgeSchema>;

export type DiscoveryNetworkValidationIssue = {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
};

export type DiscoveryNetworkValidationResult = {
  valid: boolean;
  errors: DiscoveryNetworkValidationIssue[];
  warnings: DiscoveryNetworkValidationIssue[];
};
