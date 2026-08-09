import { describe, expect, it } from "vitest";
import { buildEstimatedUnitEconomicsModel } from "./service";
import { validateEstimatedUnitEconomicsModel } from "./validation";

describe("estimated unit economics", () => {
  it("reverses a landed-cost ceiling without claiming formal profit", () => {
    const model = buildEstimatedUnitEconomicsModel({
      runId: "research-run-example-us",
      generatedAt: "2026-08-04T00:00:00.000Z",
      priceRange: { low: 39, high: 49, currencySymbol: "$" },
      formalScenarioCount: 0,
      costCoverage: null,
    });

    expect(model).not.toBeNull();
    expect(model?.inputCoverage.formalEconomicsProven).toBe(false);
    expect(model?.inputCoverage.knownCostFieldCount).toBe(0);
    expect(model?.scenarios.map((scenario) => scenario.key)).toEqual(["defensive", "base", "target"]);
    expect(model?.scenarios[1]).toMatchObject({
      price: 44,
      plannedCpaCap: 17.6,
      targetContribution: 6.6,
      allowableLandedCost: 10.42,
      status: "workable",
    });
    expect(model?.headline).toContain("$10.42");
  });

  it("keeps partial formal cost coverage separate from planning assumptions", () => {
    const model = buildEstimatedUnitEconomicsModel({
      runId: "research-run-example-us",
      generatedAt: "2026-08-04T00:00:00.000Z",
      priceRange: { low: 39, high: 49, currencySymbol: "$" },
      formalScenarioCount: 1,
      costCoverage: {
        supplierCost: 3.2,
        packagingCost: null,
        domesticShipping: null,
        internationalShipping: 5.4,
        unlistedDutyAndClearance: null,
        paymentFee: null,
        refundReserve: null,
        chargebackReserve: null,
        defectAndReshipCost: null,
        otherVariableCost: null,
      },
    });

    expect(model?.inputCoverage).toMatchObject({
      formalScenarioCount: 1,
      knownCostFieldCount: 2,
      knownCostFields: ["supplierCost", "internationalShipping"],
      formalEconomicsProven: false,
    });
  });

  it("stops when no USD recommendation range can anchor the estimate", () => {
    expect(buildEstimatedUnitEconomicsModel({
      runId: "research-run-example-us",
      generatedAt: "2026-08-04T00:00:00.000Z",
      priceRange: null,
      formalScenarioCount: 0,
      costCoverage: null,
    })).toBeNull();
  });

  it("rejects malformed scenario order", () => {
    const model = buildEstimatedUnitEconomicsModel({
      runId: "research-run-example-us",
      generatedAt: "2026-08-04T00:00:00.000Z",
      priceRange: { low: 39, high: 49, currencySymbol: "$" },
      formalScenarioCount: 0,
      costCoverage: null,
    });
    if (!model) throw new Error("expected model");

    expect(() => validateEstimatedUnitEconomicsModel({
      ...model,
      scenarios: [model.scenarios[1], model.scenarios[0], model.scenarios[2]],
    })).toThrow(/must be defensive/);
  });
});

