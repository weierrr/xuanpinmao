import { calculateOffer, checkDiscountCopy } from "./offer";

describe("offer math", () => {
  it("calculates bundle discounts against plan and reference prices", () => {
    const bundle = calculateOffer({
      kind: "bundle_2",
      quantity: 2,
      totalPrice: 49.3,
      singlePlanPrice: 29,
      referenceUnitPrice: 49,
      currency: "USD",
    });

    expect(bundle.perUnitPrice).toBe(24.65);
    expect(bundle.discountVsSinglePlanPercent).toBe(15);
    expect(bundle.discountVsReferencePercent).toBe(49.69);
  });

  it("detects the two-piece 50 percent copy mismatch", () => {
    const check = checkDiscountCopy(49.3, 98, 50);

    expect(check.expectedTotalPrice).toBe(49);
    expect(check.delta).toBe(0.3);
    expect(check.valid).toBe(false);
  });
});
