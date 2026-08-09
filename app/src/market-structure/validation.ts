import {
  priceMarketStructureSchema,
  type PriceMarketStructureValidationIssue,
  type PriceMarketStructureValidationResult,
} from "./types";

const duplicates = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate];
};

export const validatePriceMarketStructure = (payload: unknown): PriceMarketStructureValidationResult => {
  const parsed = priceMarketStructureSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        code: "INVALID_PRICE_MARKET_STRUCTURE_SCHEMA",
        message: issue.message,
        path: issue.path.join("."),
      })),
      warnings: [],
    };
  }

  const structure = parsed.data;
  const errors: PriceMarketStructureValidationIssue[] = [];
  const warnings: PriceMarketStructureValidationIssue[] = [];
  for (const id of duplicates(structure.offers.map((offer) => offer.id))) {
    errors.push({ code: "DUPLICATE_PRICE_OFFER_ID", message: "Price offer IDs must be unique", offerId: id });
  }
  if (structure.offers.some((offer) => offer.currencySymbol !== structure.currencySymbol)) {
    errors.push({ code: "MIXED_CURRENCY_STRUCTURE", message: "A price structure cannot combine unconverted currencies" });
  }
  if (structure.coverage.usableObservationCount !== structure.offers.length) {
    errors.push({
      code: "PRICE_COVERAGE_COUNT_MISMATCH",
      message: "Usable observation count must match the retained offer population",
      path: "coverage.usableObservationCount",
    });
  }

  const offerIds = new Set(structure.offers.map((offer) => offer.id));
  const bandOfferIds = structure.bands.flatMap((band) => band.offerIds);
  for (const id of bandOfferIds) {
    if (!offerIds.has(id)) {
      errors.push({ code: "PRICE_BAND_OFFER_MISSING", message: "Price band references an unknown offer", offerId: id });
    }
  }
  for (const id of duplicates(bandOfferIds)) {
    errors.push({ code: "PRICE_OFFER_IN_MULTIPLE_BANDS", message: "One offer cannot appear in multiple price bands", offerId: id });
  }
  if (structure.bands.length > 0 && bandOfferIds.length !== structure.offers.length) {
    errors.push({ code: "PRICE_BAND_COVERAGE_INCOMPLETE", message: "Published price bands must cover every retained offer" });
  }
  if (structure.bands.length > 0) {
    const share = structure.bands.reduce((sum, band) => sum + band.shareOfObservedOffers, 0);
    if (Math.abs(share - 1) > 0.001) {
      errors.push({ code: "PRICE_BAND_SHARE_MISMATCH", message: "Observed-offer shares must sum to one", path: "bands" });
    }
  }
  if (structure.coverage.status !== "sufficient") {
    warnings.push({
      code: "PRICE_STRUCTURE_COVERAGE_LIMITED",
      message: "Observed price coverage is not sufficient for a stable category-level structure",
      path: "coverage.status",
    });
  }
  if (structure.coverage.claimBackedCount === 0) {
    warnings.push({
      code: "CURRENT_RUN_PRICE_CLAIMS_MISSING",
      message: "The structure has no current-run claim-backed price observation",
      path: "coverage.claimBackedCount",
    });
  }

  return { valid: errors.length === 0, errors, warnings };
};
