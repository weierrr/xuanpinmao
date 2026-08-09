import { z } from "zod";

export const estimatedEconomicsScenarioKeys = ["defensive", "base", "target"] as const;

export const estimatedEconomicsAssumptionSchema = z.object({
  key: z.string().trim().min(2),
  label: z.string().trim().min(2),
  value: z.number().nonnegative(),
  formattedValue: z.string().trim().min(1),
  sourceKind: z.enum(["recommended_price", "planning_benchmark"]),
  rationale: z.string().trim().min(8),
}).strict();

export const estimatedEconomicsScenarioSchema = z.object({
  key: z.enum(estimatedEconomicsScenarioKeys),
  label: z.string().trim().min(2),
  price: z.number().positive(),
  paymentCost: z.number().nonnegative(),
  riskReserve: z.number().nonnegative(),
  otherVariableCost: z.number().nonnegative(),
  plannedCpaCap: z.number().nonnegative(),
  targetContribution: z.number().nonnegative(),
  allowableLandedCost: z.number(),
  allowableLandedCostRate: z.number(),
  status: z.enum(["workable", "tight", "not_workable"]),
  interpretation: z.string().trim().min(8),
}).strict();

export const estimatedEconomicsSensitivitySchema = z.object({
  key: z.string().trim().min(2),
  label: z.string().trim().min(2),
  change: z.string().trim().min(2),
  impactOnAllowableLandedCost: z.number(),
  interpretation: z.string().trim().min(8),
}).strict();

export const estimatedUnitEconomicsModelSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  generatedAt: z.iso.datetime(),
  status: z.literal("planning_estimate"),
  method: z.literal("reverse_landed_cost_ceiling"),
  currency: z.literal("USD"),
  currencySymbol: z.literal("$"),
  headline: z.string().trim().min(8),
  summary: z.string().trim().min(12),
  formula: z.string().trim().min(12),
  inputCoverage: z.object({
    recommendedPriceAvailable: z.boolean(),
    formalScenarioCount: z.number().int().nonnegative(),
    knownCostFieldCount: z.number().int().min(0).max(10),
    totalCostFieldCount: z.literal(10),
    knownCostFields: z.array(z.string().trim().min(2)),
    formalEconomicsProven: z.literal(false),
  }).strict(),
  assumptions: z.array(estimatedEconomicsAssumptionSchema).min(5),
  scenarios: z.array(estimatedEconomicsScenarioSchema).length(3),
  baseScenarioKey: z.literal("base"),
  sensitivities: z.array(estimatedEconomicsSensitivitySchema).min(3),
  nextEvidence: z.array(z.string().trim().min(4)).min(3),
  boundary: z.string().trim().min(12),
}).strict().superRefine((model, context) => {
  estimatedEconomicsScenarioKeys.forEach((key, index) => {
    if (model.scenarios[index]?.key !== key) {
      context.addIssue({
        code: "custom",
        path: ["scenarios", index, "key"],
        message: `Estimated economics scenario ${index + 1} must be ${key}`,
      });
    }
  });
  if (model.inputCoverage.knownCostFieldCount !== model.inputCoverage.knownCostFields.length) {
    context.addIssue({
      code: "custom",
      path: ["inputCoverage", "knownCostFieldCount"],
      message: "Known cost field count must match knownCostFields",
    });
  }
});

export type EstimatedUnitEconomicsModel = z.infer<typeof estimatedUnitEconomicsModelSchema>;
export type EstimatedEconomicsScenario = z.infer<typeof estimatedEconomicsScenarioSchema>;
