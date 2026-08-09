import { z } from "zod";
import { marketingTranslationSchema } from "../marketing-translation/types";
import { isoDateTimeSchema } from "./types";

export const liveResearchStages = [
  "initializing",
  "searching_web",
  "collecting_evidence",
  "analyzing_market",
  "generating_decision",
  "completed",
  "failed",
] as const;

export const claimConfidenceLevels = ["High", "Medium", "Low"] as const;
export const productDecisionStatuses = ["PROCEED_TO_SAMPLE", "HOLD_SUPPLY", "REJECT"] as const;

export const researchClaimSchema = z.object({
  id: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  statement: z.string().trim().min(3),
  evidence: z.string().trim().min(3),
  confidence: z.enum(claimConfidenceLevels),
  category: z.enum(["competitor", "market", "trend", "customer", "regulation", "supplier"]),
  targetScope: z.enum(["competitor", "market", "target_product"]),
  notes: z.string().trim().optional(),
});

export const researchClaimsSchema = z.array(researchClaimSchema).min(1);

const scoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.string().trim().min(3),
  sourceIds: z.array(z.string().trim().min(1)).min(1),
});

export const liveAnalysisSchema = z.object({
  schemaVersion: z.literal("1.0"),
  researchRunId: z.string().trim().min(8),
  generatedAt: isoDateTimeSchema,
  marketOpportunity: z.object({
    demand: scoreSchema,
    competition: scoreSchema,
    trend: scoreSchema,
    monetization: scoreSchema,
    overall: z.number().int().min(0).max(100),
    verdict: z.string().trim().min(3),
  }),
  competitorInsight: z.object({
    brandPositioning: z.string().trim().min(1),
    targetAudience: z.string().trim().min(1),
    pricePositioning: z.string().trim().min(1),
    skuSummary: z.string().trim().min(1),
    bundleStrategy: z.string().trim().min(1),
    discountStrategy: z.string().trim().min(1),
    sellingPoints: z.array(z.string().trim().min(1)).min(1),
    materials: z.string().trim().min(1),
    sizeSystem: z.string().trim().min(1),
    homepageMessaging: z.string().trim().min(1),
    cta: z.string().trim().min(1),
    socialProof: z.string().trim().min(1),
    reviews: z.string().trim().min(1),
    ugc: z.string().trim().min(1),
    whyItSells: z.array(z.string().trim().min(1)).min(1),
    sourceIds: z.array(z.string().trim().min(1)).min(1),
  }),
  customerInsight: z.object({
    painPoints: z.array(z.string().trim().min(1)).min(1),
    functionalMotives: z.array(z.string().trim().min(1)).min(1),
    emotionalMotives: z.array(z.string().trim().min(1)).min(1),
    socialMotives: z.array(z.string().trim().min(1)).min(1),
    sourceIds: z.array(z.string().trim().min(1)).min(1),
  }),
  positioning: z.object({
    targetCustomer: z.string().trim().min(1),
    recommendedPriceRange: z.string().trim().min(1),
    coreSellingPoint: z.string().trim().min(1),
    differentiation: z.array(z.string().trim().min(1)).min(1),
  }),
  productDecision: z.object({
    status: z.enum(productDecisionStatuses),
    rationale: z.array(z.string().trim().min(1)).min(1),
    sourceIds: z.array(z.string().trim().min(1)).min(1),
  }),
  actionBoundary: z.object({
    listingAllowed: z.boolean(),
    adTestAllowed: z.boolean(),
    reason: z.string().trim().min(1),
  }),
  marketingTranslation: marketingTranslationSchema.optional(),
  unknowns: z.array(z.string().trim().min(1)),
});

export const liveResearchStatusSchema = z.object({
  researchRunId: z.string().trim().min(8),
  mode: z.literal("live"),
  currentStage: z.enum(liveResearchStages),
  updatedAt: isoDateTimeSchema,
  history: z.array(
    z.object({
      stage: z.enum(liveResearchStages),
      at: isoDateTimeSchema,
      note: z.string().trim().min(1),
    }),
  ),
});

export type ResearchClaim = z.infer<typeof researchClaimSchema>;
export type LiveResearchAnalysis = z.infer<typeof liveAnalysisSchema>;
export type LiveResearchStatus = z.infer<typeof liveResearchStatusSchema>;
