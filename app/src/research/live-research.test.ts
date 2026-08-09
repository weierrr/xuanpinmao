import { describe, expect, it } from "vitest";
import { liveAnalysisSchema, researchClaimsSchema } from "./live-types";

const score = { score: 60, rationale: "Evidence-backed directional signal.", sourceIds: ["SRC-001"] };

const analysis = {
  schemaVersion: "1.0",
  researchRunId: "research-run-test-product-abcdef123456-us",
  generatedAt: "2026-07-22T08:00:00.000Z",
  marketOpportunity: { demand: score, competition: score, trend: score, monetization: score, overall: 60, verdict: "Sample cautiously." },
  competitorInsight: {
    brandPositioning: "Proof-led activewear",
    targetAudience: "US women",
    pricePositioning: "$39-$49",
    skuSummary: "Leggings",
    bundleStrategy: "Cross-sell",
    discountStrategy: "Guarantee",
    sellingPoints: ["Fit"],
    materials: "Competitor-stated material",
    sizeSystem: "XS-XL",
    homepageMessaging: "Move confidently",
    cta: "Shop",
    socialProof: "Merchant displayed",
    reviews: "Merchant displayed",
    ugc: "Merchant displayed",
    whyItSells: ["Clear problem-solution framing"],
    sourceIds: ["SRC-001"],
  },
  customerInsight: {
    painPoints: ["Poor fit"],
    functionalMotives: ["Opacity"],
    emotionalMotives: ["Confidence"],
    socialMotives: ["Gym fashion"],
    sourceIds: ["SRC-001"],
  },
  positioning: {
    targetCustomer: "US women",
    recommendedPriceRange: "$39-$49",
    coreSellingPoint: "Subtle sculpt fit",
    differentiation: ["Fit proof"],
  },
  productDecision: {
    status: "PROCEED_TO_SAMPLE",
    rationale: ["Demand exists"],
    sourceIds: ["SRC-001"],
  },
  actionBoundary: {
    listingAllowed: false,
    adTestAllowed: false,
    reason: "Target SKU evidence is incomplete.",
  },
  unknowns: ["Supplier quote"],
};

describe("live research contracts", () => {
  it("accepts an evidence-backed selection decision while keeping launch actions blocked", () => {
    const parsed = liveAnalysisSchema.parse(analysis);
    expect(parsed.productDecision.status).toBe("PROCEED_TO_SAMPLE");
    expect(parsed.actionBoundary.listingAllowed).toBe(false);
    expect(parsed.actionBoundary.adTestAllowed).toBe(false);
    expect(parsed.marketingTranslation).toBeUndefined();
  });

  it("requires every claim to carry a source id and explicit confidence", () => {
    const parsed = researchClaimsSchema.parse([
      {
        id: "CLM-001",
        sourceId: "SRC-001",
        statement: "A competitor displays a sale price.",
        evidence: "Observed on the public product page.",
        confidence: "High",
        category: "competitor",
        targetScope: "competitor",
      },
    ]);
    expect(parsed[0]?.sourceId).toBe("SRC-001");
    expect(() => researchClaimsSchema.parse([{ ...parsed[0], sourceId: "" }])).toThrow();
  });

  it("rejects decisions without evidence mappings", () => {
    expect(() =>
      liveAnalysisSchema.parse({
        ...analysis,
        productDecision: { ...analysis.productDecision, sourceIds: [] },
      }),
    ).toThrow();
  });
});
