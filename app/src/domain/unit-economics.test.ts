import { calculateUnitEconomics } from "./unit-economics";

describe("unit economics", () => {
  it("does not default unknown costs to zero", () => {
    const result = calculateUnitEconomics({
      revenue: 29,
      purchase: 2.65,
      packaging: null,
      domesticShipping: null,
      internationalLogisticsOrDdp: 5.3,
      unlistedDutyAndClearance: null,
      paymentFee: null,
      refundReserve: null,
      chargebackReserve: null,
      defectAndReship: null,
      otherVariableCost: null,
    });

    expect(result.landedCost).toBeNull();
    expect(result.cm1).toBeNull();
    expect(result.breakEvenCpa).toBeNull();
    expect(result.breakEvenRoas).toBeNull();
    expect(result.missingFields).toContain("packaging");
  });

  it("validates the CM1 identity when all inputs are present", () => {
    const result = calculateUnitEconomics({
      revenue: 50,
      purchase: 10,
      packaging: 1,
      domesticShipping: 2,
      internationalLogisticsOrDdp: 5,
      unlistedDutyAndClearance: 0,
      paymentFee: 2,
      refundReserve: 3,
      chargebackReserve: 1,
      defectAndReship: 2,
      otherVariableCost: 0,
    });

    expect(result.landedCost).toBe(18);
    expect(result.grossProfit).toBe(32);
    expect(result.variableOperatingCost).toBe(8);
    expect(result.cm1).toBe(24);
    expect(result.identityValid).toBe(true);
    expect(result.breakEvenCpa).toBe(24);
    expect(result.breakEvenRoas).toBe(2.0833);
  });
});
