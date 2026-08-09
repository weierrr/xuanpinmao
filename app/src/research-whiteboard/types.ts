import { z } from "zod";

export const researchWhiteboardStageCodes = [
  "scope",
  "market",
  "customer",
  "competitor",
  "supply",
  "compliance",
  "synthesis",
  "market_report",
  "customer_report",
  "competitor_report",
  "product_report",
  "marketing_report",
  "validation_report",
  "execution",
] as const;

export const researchWhiteboardStageCodeSchema = z.enum(researchWhiteboardStageCodes);
export const researchWhiteboardStageStatusSchema = z.enum(["pending", "in_progress", "complete", "blocked"]);
export const researchWhiteboardStatusSchema = z.enum(["waiting", "researching", "analyzing", "reporting", "completed", "blocked"]);

export const researchWhiteboardSourceSchema = z.object({
  id: z.string().min(3),
  label: z.string().min(1),
  url: z.url(),
  kind: z.enum(["market", "community", "competitor", "supplier", "official", "other"]),
  status: z.enum(["candidate", "verified", "blocked"]),
}).strict();

export const researchWhiteboardSourceKindSchema = researchWhiteboardSourceSchema.shape.kind;
export const researchWhiteboardSourceStatusSchema = researchWhiteboardSourceSchema.shape.status;

export const researchWhiteboardStageSchema = z.object({
  code: researchWhiteboardStageCodeSchema,
  status: researchWhiteboardStageStatusSchema,
  queryCount: z.number().int().nonnegative(),
  sourceCount: z.number().int().nonnegative(),
  recordCount: z.number().int().nonnegative(),
  summary: z.string(),
  sources: z.array(researchWhiteboardSourceSchema),
  updatedAt: z.iso.datetime(),
}).strict();

export const researchWhiteboardActivitySchema = z.object({
  id: z.string().min(3),
  at: z.iso.datetime(),
  stage: researchWhiteboardStageCodeSchema,
  status: researchWhiteboardStageStatusSchema,
  message: z.string().min(1),
}).strict();

export const researchWhiteboardEvidenceLevelSchema = z.enum([
  "fact",
  "directional",
  "hypothesis",
  "unknown",
]);

export const researchWhiteboardReportItemSchema = z.object({
  text: z.string().min(1),
  level: researchWhiteboardEvidenceLevelSchema,
  sourceIds: z.array(z.string().min(1)).default([]),
}).strict();

export const researchWhiteboardReportModuleSchema = z.object({
  code: z.enum(["market", "customer", "competitor", "product", "marketing", "validation"]),
  title: z.string().min(2),
  question: z.string().min(2),
  conclusion: z.string().min(3),
  items: z.array(researchWhiteboardReportItemSchema),
  unknowns: z.array(z.string().min(1)),
  updatedAt: z.iso.datetime(),
}).strict();

export const researchWhiteboardSchema = z.object({
  schemaVersion: z.literal("1.0"),
  discoveryId: z.string().min(12),
  researchRunId: z.string().min(12).optional(),
  product: z.string().min(2),
  market: z.string().min(2),
  channel: z.string().optional(),
  status: researchWhiteboardStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  stages: z.record(researchWhiteboardStageCodeSchema, researchWhiteboardStageSchema),
  activity: z.array(researchWhiteboardActivitySchema),
  reportModules: z.array(researchWhiteboardReportModuleSchema).default([]),
}).strict();

export type ResearchWhiteboardStageCode = z.infer<typeof researchWhiteboardStageCodeSchema>;
export type ResearchWhiteboardStageStatus = z.infer<typeof researchWhiteboardStageStatusSchema>;
export type ResearchWhiteboardSource = z.infer<typeof researchWhiteboardSourceSchema>;
export type ResearchWhiteboardReportModule = z.infer<typeof researchWhiteboardReportModuleSchema>;
export type ResearchWhiteboard = z.infer<typeof researchWhiteboardSchema>;
