import { z } from "zod";

export const commercialViabilityDimensionKeys = [
  "demand",
  "differentiation",
  "supply",
  "unit_economics",
  "risk_control",
] as const;

export const commercialViabilityDecisions = [
  "STOP",
  "RESEARCH_MORE",
  "CONTROLLED_SAMPLE",
  "COMMERCIAL_GO",
] as const;

export const commercialViabilityEvidenceRefSchema = z.object({
  objectType: z.enum([
    "claim",
    "opportunity",
    "supply_atom",
    "unit_economics",
    "decision_summary",
  ]),
  id: z.string().trim().min(1),
}).strict();

export const commercialViabilityDimensionSchema = z.object({
  key: z.enum(commercialViabilityDimensionKeys),
  label: z.string().trim().min(2),
  scoreStatus: z.enum(["scored", "not_scored"]),
  score: z.number().int().min(0).max(100).nullable(),
  gateStatus: z.enum(["positive", "directional", "blocked", "failed"]),
  conclusion: z.string().trim().min(5),
  rationale: z.string().trim().min(5),
  blocker: z.string().trim().min(3).nullable(),
  nextAction: z.string().trim().min(3),
  evidenceRefs: z.array(commercialViabilityEvidenceRefSchema),
}).strict().superRefine((dimension, context) => {
  if (dimension.scoreStatus === "scored" && dimension.score === null) {
    context.addIssue({ code: "custom", path: ["score"], message: "Scored viability dimension requires a score" });
  }
  if (dimension.scoreStatus === "not_scored" && dimension.score !== null) {
    context.addIssue({ code: "custom", path: ["score"], message: "Unscored viability dimension must keep score null" });
  }
  if (["blocked", "failed"].includes(dimension.gateStatus) && !dimension.blocker) {
    context.addIssue({ code: "custom", path: ["blocker"], message: "Blocked viability dimension requires a blocker" });
  }
});

export const commercialViabilityCardSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  generatedAt: z.iso.datetime(),
  decision: z.enum(commercialViabilityDecisions),
  decisionLabel: z.string().trim().min(2),
  commercialViabilityProven: z.boolean(),
  summary: z.string().trim().min(10),
  dimensions: z.array(commercialViabilityDimensionSchema).length(commercialViabilityDimensionKeys.length),
  evidenceCoverage: z.object({
    assessedDimensions: z.number().int().min(0).max(commercialViabilityDimensionKeys.length),
    totalDimensions: z.literal(commercialViabilityDimensionKeys.length),
    positiveDimensions: z.number().int().min(0).max(commercialViabilityDimensionKeys.length),
    blockedDimensions: z.number().int().min(0).max(commercialViabilityDimensionKeys.length),
  }).strict(),
  decisiveBlockers: z.array(z.string().trim().min(3)),
  allowedActions: z.array(z.string().trim().min(3)).min(1),
  blockedActions: z.array(z.string().trim().min(3)).min(1),
  nextGateConditions: z.array(z.string().trim().min(3)).min(1),
  boundary: z.string().trim().min(10),
}).strict().superRefine((card, context) => {
  commercialViabilityDimensionKeys.forEach((key, index) => {
    if (card.dimensions[index]?.key !== key) {
      context.addIssue({
        code: "custom",
        path: ["dimensions", index, "key"],
        message: `Commercial viability dimension ${index + 1} must be ${key}`,
      });
    }
  });
  if (card.commercialViabilityProven && card.decision !== "COMMERCIAL_GO") {
    context.addIssue({
      code: "custom",
      path: ["commercialViabilityProven"],
      message: "Commercial viability can only be proven at COMMERCIAL_GO",
    });
  }
  if (card.decision === "COMMERCIAL_GO" && card.decisiveBlockers.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["decisiveBlockers"],
      message: "COMMERCIAL_GO cannot retain decisive blockers",
    });
  }
});

export type CommercialViabilityDimension = z.infer<typeof commercialViabilityDimensionSchema>;
export type CommercialViabilityCard = z.infer<typeof commercialViabilityCardSchema>;
