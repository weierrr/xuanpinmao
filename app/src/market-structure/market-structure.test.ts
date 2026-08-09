import { describe, expect, it } from "vitest";
import { buildPriceMarketStructure, type MarketOfferPriceInput } from "./service";
import { validatePriceMarketStructure } from "./validation";

const offer = (
  index: number,
  currentPrice: number,
  options: Partial<MarketOfferPriceInput> = {},
): MarketOfferPriceInput => ({
  id: `offer-${index}`,
  label: `Comparable offer ${index}`,
  currentPrice,
  listPrice: null,
  currencySymbol: "$",
  url: `https://example.com/offers/${index}`,
  claimId: `CLM-${String(index).padStart(3, "0")}`,
  sourceId: `SRC-${String(index).padStart(3, "0")}`,
  sourceType: "current_run_claim",
  ...options,
});

const build = (offers: MarketOfferPriceInput[], recommendedRange = { low: 39, high: 49, currencySymbol: "$" }) =>
  buildPriceMarketStructure({
    runId: "research-run-generic-price-structure-us",
    product: "Generic product",
    market: "US",
    generatedAt: "2026-08-04T00:00:00.000Z",
    offers,
    recommendedRange,
  });

describe("generic price bands and observed market structure", () => {
  it("builds three data-driven bands without category-specific price thresholds", () => {
    const structure = build([20, 25, 30, 40, 45, 50, 80].map((price, index) => offer(index + 1, price)));
    if (!structure) throw new Error("expected structure");

    expect(structure.coverage.status).toBe("sufficient");
    expect(structure.coverage.distinctPriceCount).toBe(7);
    expect(structure.bands.map((band) => band.key)).toEqual(["entry", "core", "premium"]);
    expect(structure.bands.map((band) => [band.observedLow, band.observedHigh])).toEqual([
      [20, 30],
      [40, 45],
      [50, 80],
    ]);
    expect(structure.recommendedRangePosition.status).toBe("core");
    expect(structure.shape.key).toBe("anchor_stretched");
    expect(structure.boundary).toContain("不是市场均价、市场份额或需求曲线");
  });

  it("keeps sparse evidence unresolved instead of inventing price bands", () => {
    const structure = build([offer(1, 29), offer(2, 49)]);
    if (!structure) throw new Error("expected structure");

    expect(structure.coverage.status).toBe("insufficient");
    expect(structure.bands).toEqual([]);
    expect(structure.shape.key).toBe("unresolved");
    expect(validatePriceMarketStructure(structure)).toMatchObject({
      valid: true,
      warnings: [{ code: "PRICE_STRUCTURE_COVERAGE_LIMITED" }],
    });
  });

  it("never mixes currencies without an explicit conversion", () => {
    const structure = build([
      offer(1, 20),
      offer(2, 30),
      offer(3, 40),
      offer(4, 50, { currencySymbol: "€" }),
    ]);
    if (!structure) throw new Error("expected structure");

    expect(structure.currencySymbol).toBe("$");
    expect(structure.offers).toHaveLength(3);
    expect(structure.coverage.excludedCurrencyCount).toBe(1);
    expect(structure.coverage.limitations.join(" ")).toContain("未自动换算汇率");
  });

  it("separates observed offer share from sales or market share", () => {
    const structure = build([18, 22, 28, 36, 44, 55].map((price, index) => offer(index + 1, price)));
    if (!structure) throw new Error("expected structure");

    expect(structure.bands.reduce((sum, band) => sum + band.shareOfObservedOffers, 0)).toBeCloseTo(1, 3);
    expect(structure.decisionUse.cannotAnswer).toContain("哪个价格带销量最大或利润最好。");
    expect(structure.coverage.limitations.join(" ")).toContain("不代表销售额或市场份额");
  });

  it("rejects a band that references an unknown offer", () => {
    const structure = build([18, 22, 28, 36, 44, 55].map((price, index) => offer(index + 1, price)));
    if (!structure) throw new Error("expected structure");
    const invalid = structuredClone(structure);
    invalid.bands[0].offerIds[0] = "missing-offer";

    expect(validatePriceMarketStructure(invalid)).toMatchObject({
      valid: false,
      errors: [{ code: "PRICE_BAND_OFFER_MISSING" }],
    });
  });
});
