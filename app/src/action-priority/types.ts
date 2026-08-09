import { z } from "zod";

export const actionPriorityLanes = ["current_product", "adjacent_exploration"] as const;
export const actionPriorityRoles = ["GLOBAL_FIRST", "MAINLINE_NEXT", "EXPLORE_NEXT", "OBSERVE"] as const;
export const actionPriorityStatuses = ["READY", "BLOCKED", "PARALLEL_RESEARCH", "OBSERVE"] as const;

export const unifiedActionItemSchema = z.object({
  id: z.string().trim().min(6),
  runId: z.string().trim().min(8),
  lane: z.enum(actionPriorityLanes),
  role: z.enum(actionPriorityRoles),
  status: z.enum(actionPriorityStatuses),
  order: z.number().int().positive(),
  title: z.string().trim().min(2),
  typeLabel: z.string().trim().min(2),
  description: z.string().trim().min(8),
  dependencyIds: z.array(z.string().trim().min(6)),
  sourceAnchor: z.string().trim().startsWith("#"),
  successCondition: z.string().trim().min(8),
  failureAction: z.string().trim().min(8),
  boundary: z.string().trim().min(12),
  embeddedChecks: z.array(z.object({
    label: z.string().trim().min(2),
    method: z.string().trim().min(8),
    pass: z.string().trim().min(8),
    fail: z.string().trim().min(8),
  }).strict()),
}).strict().superRefine((item, context) => {
  if (item.role === "GLOBAL_FIRST" && (item.lane !== "current_product" || item.dependencyIds.length > 0)) {
    context.addIssue({
      code: "custom",
      path: ["role"],
      message: "Global first action must be an unblocked current-product action",
    });
  }
  if (item.lane === "adjacent_exploration" && ["GLOBAL_FIRST", "MAINLINE_NEXT"].includes(item.role)) {
    context.addIssue({
      code: "custom",
      path: ["role"],
      message: "Exploration action cannot become a mainline action",
    });
  }
});

export const unifiedActionQueueSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  generatedAt: z.iso.datetime(),
  title: z.literal("统一行动优先级"),
  globalFirstActionId: z.string().trim().min(6),
  mainline: z.array(unifiedActionItemSchema).min(1),
  exploration: z.array(unifiedActionItemSchema),
  metrics: z.object({
    mainlineCount: z.number().int().positive(),
    explorationCount: z.number().int().nonnegative(),
    readyNowCount: z.number().int().positive(),
    blockedCount: z.number().int().nonnegative(),
    observeCount: z.number().int().nonnegative(),
  }).strict(),
  crossLanePolicy: z.string().trim().min(20),
  boundaries: z.array(z.string().trim().min(12)).min(3),
}).strict();

export type UnifiedActionItem = z.infer<typeof unifiedActionItemSchema>;
export type UnifiedActionQueue = z.infer<typeof unifiedActionQueueSchema>;

export type UnifiedActionQueueIssue = {
  code: string;
  message: string;
  actionId?: string;
};

export type UnifiedActionQueueValidationResult = {
  valid: boolean;
  errors: UnifiedActionQueueIssue[];
  warnings: UnifiedActionQueueIssue[];
};
