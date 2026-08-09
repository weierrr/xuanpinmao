import { z } from "zod";

export const discoveryRunRegistryStatuses = ["active", "superseded", "excluded"] as const;

export const discoveryRunRegistryEntrySchema = z.object({
  runId: z.string().trim().min(8),
  status: z.enum(discoveryRunRegistryStatuses),
  product: z.string().trim().min(2).nullable(),
  productKey: z.string().trim().min(3).nullable(),
  market: z.string().trim().min(2).nullable(),
  reportGeneratedAt: z.iso.datetime().nullable(),
  supersededByRunId: z.string().trim().min(8).nullable(),
  exclusionReason: z.string().trim().min(5).nullable(),
}).strict();

export const discoveryRunRegistrySchema = z.object({
  schemaVersion: z.literal("1.0"),
  generatedAt: z.iso.datetime(),
  entries: z.array(discoveryRunRegistryEntrySchema),
  metrics: z.object({
    discoveredRunCount: z.number().int().nonnegative(),
    activeRunCount: z.number().int().nonnegative(),
    supersededRunCount: z.number().int().nonnegative(),
    excludedRunCount: z.number().int().nonnegative(),
  }).strict(),
  boundaries: z.array(z.string().trim().min(12)).min(3),
}).strict();

export type DiscoveryRunRegistry = z.infer<typeof discoveryRunRegistrySchema>;
export type DiscoveryRunRegistryEntry = z.infer<typeof discoveryRunRegistryEntrySchema>;

export type DiscoveryRunRegistryValidationIssue = {
  code: string;
  message: string;
  runId?: string;
};

export type DiscoveryRunRegistryValidationResult = {
  valid: boolean;
  errors: DiscoveryRunRegistryValidationIssue[];
  warnings: DiscoveryRunRegistryValidationIssue[];
};
