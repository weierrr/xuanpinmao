import { z } from "zod";

export const sellerDecisionSignalKeys = [
  "market",
  "competition",
  "crowding",
  "whitespace",
] as const;

export const sellerDecisionSignalSchema = z.object({
  key: z.enum(sellerDecisionSignalKeys),
  question: z.string().trim().min(3),
  verdict: z.string().trim().min(2),
  detail: z.string().trim().min(8),
  evidenceLevel: z.enum(["supported", "directional", "preliminary"]),
  evidenceLabel: z.string().trim().min(2),
}).strict();

export const sellerDecisionCardSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  primaryVerdict: z.string().trim().min(8),
  statusLabel: z.string().trim().min(2),
  signals: z.array(sellerDecisionSignalSchema).length(sellerDecisionSignalKeys.length),
  nextAction: z.string().trim().min(8),
  boundary: z.string().trim().min(10),
}).strict().superRefine((card, context) => {
  sellerDecisionSignalKeys.forEach((key, index) => {
    if (card.signals[index]?.key !== key) {
      context.addIssue({
        code: "custom",
        path: ["signals", index, "key"],
        message: `Seller decision signal ${index + 1} must be ${key}`,
      });
    }
  });
});

export type SellerDecisionCard = z.infer<typeof sellerDecisionCardSchema>;
