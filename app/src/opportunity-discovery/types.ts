import { z } from "zod";

export const opportunityDiscoveryInputSchema = z.object({
  categoryKeyword: z.string().trim().min(2),
  targetMarket: z.string().trim().min(2).transform((value) => value.toUpperCase()),
  targetAudience: z.string().trim().optional(),
  salesChannel: z.string().trim().optional(),
  imageUrls: z.array(z.url()).default([]),
  competitorUrls: z.array(z.url()).default([]),
  referenceUrls: z.array(z.url()).default([]),
}).strict();

export const opportunityDiscoveryPlanSchema = z.object({
  schemaVersion: z.literal("1.0"),
  discoveryId: z.string().min(12),
  mode: z.literal("CATEGORY_OPPORTUNITY_DISCOVERY"),
  categoryKeyword: z.string().min(2),
  targetMarket: z.string().min(2),
  targetAudience: z.string().optional(),
  salesChannel: z.string().optional(),
  imageUrls: z.array(z.url()).default([]),
  competitorUrls: z.array(z.url()).default([]),
  referenceUrls: z.array(z.url()),
  coverageTargets: z.object({
    minimumBrands: z.number().int().positive(),
    minimumAsins: z.number().int().positive(),
    maximumAsins: z.number().int().positive(),
    minimumValidReviews: z.number().int().positive(),
    minimumRedditThreads: z.number().int().positive(),
    minimumPriceBands: z.number().int().positive(),
  }).strict(),
  queryGroups: z.object({
    amazonCategoryDiscovery: z.array(z.string().min(5)),
    redditDemandDiscovery: z.array(z.string().min(5)),
    independentReviewDiscovery: z.array(z.string().min(5)),
    alternativeAndWorkaroundDiscovery: z.array(z.string().min(5)),
  }).strict(),
  stages: z.array(z.object({
    code: z.string().min(3),
    title: z.string().min(2),
    output: z.string().min(3),
  }).strict()).min(1),
  decisionGuardrails: z.array(z.string().min(5)).min(1),
  createdAt: z.iso.datetime(),
}).strict();

export type OpportunityDiscoveryInput = z.input<typeof opportunityDiscoveryInputSchema>;
export type OpportunityDiscoveryPlan = z.infer<typeof opportunityDiscoveryPlanSchema>;
