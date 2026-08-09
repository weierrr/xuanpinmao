import { z } from "zod";

export const priceBandKeys = ["entry", "core", "premium"] as const;
export const marketStructureCoverageStatuses = ["insufficient", "partial", "sufficient"] as const;
export const observedMarketShapes = [
  "unresolved",
  "compressed",
  "laddered",
  "split",
  "anchor_stretched",
] as const;
export const recommendedPricePositions = [
  "unavailable",
  "currency_mismatch",
  "below_observed",
  "entry",
  "core",
  "premium",
  "spans_multiple",
  "above_observed",
] as const;

export const marketOfferPriceSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(2),
  currentPrice: z.number().positive(),
  listPrice: z.number().positive().nullable(),
  currencySymbol: z.string().trim().min(1).max(4),
  url: z.url().nullable(),
  claimId: z.string().trim().min(1).nullable(),
  sourceId: z.string().trim().min(1),
  sourceType: z.enum(["current_run_claim", "curated_benchmark"]),
}).strict().superRefine((offer, context) => {
  if (offer.listPrice !== null && offer.listPrice <= offer.currentPrice) {
    context.addIssue({
      code: "custom",
      path: ["listPrice"],
      message: "List price must be higher than the current price",
    });
  }
  if (offer.sourceType === "current_run_claim" && !offer.claimId) {
    context.addIssue({
      code: "custom",
      path: ["claimId"],
      message: "Current-run price evidence must retain its Claim ID",
    });
  }
});

export const observedPriceBandSchema = z.object({
  key: z.enum(priceBandKeys),
  label: z.string().trim().min(2),
  observedLow: z.number().positive(),
  observedHigh: z.number().positive(),
  observationCount: z.number().int().positive(),
  shareOfObservedOffers: z.number().min(0).max(1),
  offerIds: z.array(z.string().trim().min(1)).min(1),
  interpretation: z.string().trim().min(5),
}).strict().superRefine((band, context) => {
  if (band.observedHigh < band.observedLow) {
    context.addIssue({ code: "custom", path: ["observedHigh"], message: "Band high must not be below band low" });
  }
  if (band.offerIds.length !== band.observationCount) {
    context.addIssue({
      code: "custom",
      path: ["offerIds"],
      message: "Band observation count must match its offer references",
    });
  }
});

export const priceMarketStructureSchema = z.object({
  schemaVersion: z.literal("1.0"),
  runId: z.string().trim().min(8),
  product: z.string().trim().min(2),
  market: z.string().trim().min(2),
  generatedAt: z.iso.datetime(),
  currencySymbol: z.string().trim().min(1).max(4),
  offers: z.array(marketOfferPriceSchema).min(1),
  coverage: z.object({
    status: z.enum(marketStructureCoverageStatuses),
    label: z.string().trim().min(2),
    totalObservationCount: z.number().int().positive(),
    usableObservationCount: z.number().int().positive(),
    distinctPriceCount: z.number().int().positive(),
    sourceCount: z.number().int().positive(),
    claimBackedCount: z.number().int().nonnegative(),
    curatedBenchmarkCount: z.number().int().nonnegative(),
    excludedCurrencyCount: z.number().int().nonnegative(),
    limitations: z.array(z.string().trim().min(5)).min(1),
  }).strict(),
  observedRange: z.object({
    low: z.number().positive(),
    high: z.number().positive(),
    median: z.number().positive(),
    span: z.number().nonnegative(),
    highToLowRatio: z.number().positive(),
    discountedOfferCount: z.number().int().nonnegative(),
    medianDiscountRate: z.number().min(0).max(1).nullable(),
  }).strict(),
  bands: z.array(observedPriceBandSchema),
  shape: z.object({
    key: z.enum(observedMarketShapes),
    label: z.string().trim().min(2),
    conclusion: z.string().trim().min(5),
    rationale: z.string().trim().min(5),
  }).strict(),
  largestGap: z.object({
    lowerOfferId: z.string().trim().min(1),
    upperOfferId: z.string().trim().min(1),
    fromPrice: z.number().positive(),
    toPrice: z.number().positive(),
    absoluteGap: z.number().positive(),
    shareOfObservedSpan: z.number().min(0).max(1),
    relativeToMedianGap: z.number().positive(),
    interpretation: z.string().trim().min(5),
  }).strict().nullable(),
  recommendedRangePosition: z.object({
    status: z.enum(recommendedPricePositions),
    label: z.string().trim().min(2),
    low: z.number().positive().nullable(),
    high: z.number().positive().nullable(),
    overlapBandKeys: z.array(z.enum(priceBandKeys)),
    conclusion: z.string().trim().min(5),
    boundary: z.string().trim().min(5),
  }).strict(),
  decisionUse: z.object({
    canAnswer: z.array(z.string().trim().min(3)).min(1),
    cannotAnswer: z.array(z.string().trim().min(3)).min(1),
    nextEvidence: z.array(z.string().trim().min(3)).min(1),
  }).strict(),
  boundary: z.string().trim().min(10),
}).strict().superRefine((structure, context) => {
  const expectedCoverage = structure.coverage.distinctPriceCount >= 6
    ? "sufficient"
    : structure.coverage.distinctPriceCount >= 3
      ? "partial"
      : "insufficient";
  if (structure.coverage.status !== expectedCoverage) {
    context.addIssue({
      code: "custom",
      path: ["coverage", "status"],
      message: `Coverage must be ${expectedCoverage} for the observed distinct-price count`,
    });
  }
  if (structure.coverage.status === "insufficient" && structure.bands.length > 0) {
    context.addIssue({ code: "custom", path: ["bands"], message: "Insufficient coverage cannot publish price bands" });
  }
  if (structure.coverage.status !== "insufficient") {
    priceBandKeys.forEach((key, index) => {
      if (structure.bands[index]?.key !== key) {
        context.addIssue({
          code: "custom",
          path: ["bands", index, "key"],
          message: `Observed price band ${index + 1} must be ${key}`,
        });
      }
    });
    if (structure.bands.length !== priceBandKeys.length) {
      context.addIssue({ code: "custom", path: ["bands"], message: "Usable price structure requires three ordered bands" });
    }
  }
  if (structure.shape.key !== "unresolved" && structure.coverage.status === "insufficient") {
    context.addIssue({ code: "custom", path: ["shape", "key"], message: "Insufficient coverage must keep market shape unresolved" });
  }
});

export type MarketOfferPrice = z.infer<typeof marketOfferPriceSchema>;
export type ObservedPriceBand = z.infer<typeof observedPriceBandSchema>;
export type PriceMarketStructure = z.infer<typeof priceMarketStructureSchema>;

export type PriceMarketStructureValidationIssue = {
  code: string;
  message: string;
  path?: string;
  offerId?: string;
};

export type PriceMarketStructureValidationResult = {
  valid: boolean;
  errors: PriceMarketStructureValidationIssue[];
  warnings: PriceMarketStructureValidationIssue[];
};
