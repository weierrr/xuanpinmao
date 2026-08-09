import { z } from "zod";

export const secondCategoryCheckKeys = [
  "core_pipeline",
  "category_specificity",
  "evidence_boundary",
  "decision_boundary",
  "contamination",
  "advanced_modules",
] as const;

export const secondCategoryValidationCheckSchema = z.object({
  key: z.enum(secondCategoryCheckKeys),
  label: z.string().trim().min(2),
  status: z.enum(["pass", "warning", "fail"]),
  conclusion: z.string().trim().min(6),
  evidence: z.array(z.string().trim().min(1)).min(1),
  nextAction: z.string().trim().min(4).nullable(),
}).strict();

export const secondCategoryValidationSchema = z.object({
  schemaVersion: z.literal("1.0"),
  validationId: z.string().trim().min(8),
  baselineRunId: z.string().trim().min(8),
  candidateRunId: z.string().trim().min(8),
  generatedAt: z.iso.datetime(),
  candidateCategory: z.string().trim().min(2),
  candidateLabel: z.string().trim().min(2),
  status: z.enum(["passed", "partial", "failed"]),
  statusLabel: z.string().trim().min(2),
  summary: z.string().trim().min(10),
  checks: z.array(secondCategoryValidationCheckSchema).length(secondCategoryCheckKeys.length),
  metrics: z.object({
    passedChecks: z.number().int().min(0).max(secondCategoryCheckKeys.length),
    totalChecks: z.literal(secondCategoryCheckKeys.length),
    coreCapabilitiesAvailable: z.number().int().min(0).max(6),
    coreCapabilitiesTotal: z.literal(6),
    advancedCapabilitiesAvailable: z.number().int().min(0).max(5),
    advancedCapabilitiesTotal: z.literal(5),
    contaminationCount: z.number().int().nonnegative(),
    distinctiveTermCount: z.number().int().nonnegative(),
  }).strict(),
  reusableCapabilities: z.array(z.string().trim().min(2)).min(1),
  missingCapabilities: z.array(z.string().trim().min(2)),
  boundary: z.string().trim().min(12),
}).strict().superRefine((validation, context) => {
  secondCategoryCheckKeys.forEach((key, index) => {
    if (validation.checks[index]?.key !== key) {
      context.addIssue({
        code: "custom",
        path: ["checks", index, "key"],
        message: `Second-category check ${index + 1} must be ${key}`,
      });
    }
  });
  if (validation.status === "passed" && validation.checks.some((check) => check.status !== "pass")) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "Passed second-category validation cannot retain warnings or failures",
    });
  }
});

export type SecondCategoryValidation = z.infer<typeof secondCategoryValidationSchema>;
