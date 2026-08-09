import { z } from "zod";

export const sourcingStarterSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  title: z.string().trim().min(4),
  notice: z.string().trim().min(10),
  coreKeywords: z.array(z.string().trim().min(3)).min(3).max(8),
  combinationQueries: z.array(z.string().trim().min(5)).min(2).max(8),
  supplierBrief: z.string().trim().min(30),
  exclusions: z.array(z.string().trim().min(3)).min(2).max(8),
}).strict();

export type SourcingStarter = z.infer<typeof sourcingStarterSchema>;
