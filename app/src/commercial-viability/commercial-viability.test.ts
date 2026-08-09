import { describe, expect, it } from "vitest";
import { readFirstPrinciplesBundle } from "../first-principles/service";
import { buildCommercialViabilityCard } from "./service";
import { commercialViabilityCardSchema } from "./types";

const runId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

describe("commercial viability decision card", () => {
  it("stops at research-more when supply, economics and risk remain decisive blockers", async () => {
    const bundle = await readFirstPrinciplesBundle(runId);
    const card = buildCommercialViabilityCard({ bundle, economicsScenarioCount: 0 });

    expect(card).not.toBeNull();
    expect(card?.decision).toBe("RESEARCH_MORE");
    expect(card?.commercialViabilityProven).toBe(false);
    expect(card?.dimensions.map((dimension) => dimension.key)).toEqual([
      "demand", "differentiation", "supply", "unit_economics", "risk_control",
    ]);
    expect(card?.evidenceCoverage).toMatchObject({
      assessedDimensions: 3,
      totalDimensions: 5,
      positiveDimensions: 0,
      blockedDimensions: 3,
    });
    expect(card?.dimensions.find((dimension) => dimension.key === "supply")?.score).toBeNull();
    expect(card?.dimensions.find((dimension) => dimension.key === "unit_economics")?.blocker)
      .toContain("采购、包装、物流");
  });

  it("allows controlled sampling without claiming commercial viability", async () => {
    const bundle = structuredClone(await readFirstPrinciplesBundle(runId));
    bundle.decision_summary.product_selection_decision = "PROCEED_TO_SAMPLE";
    const card = buildCommercialViabilityCard({ bundle, economicsScenarioCount: 0 });

    expect(card?.decision).toBe("CONTROLLED_SAMPLE");
    expect(card?.commercialViabilityProven).toBe(false);
    expect(card?.allowedActions.join("\n")).toContain("人工授权");
    expect(card?.blockedActions).toContain("正式上架。");
  });

  it("only reaches commercial-go when every decisive dimension is positive", async () => {
    const bundle = structuredClone(await readFirstPrinciplesBundle(runId));
    const opportunity = bundle.opportunity_hypotheses.find((item) => item.id === bundle.recommended_opportunity_id);
    if (!opportunity) throw new Error("Expected a recommended opportunity");
    for (const key of ["demand_fit", "differentiation", "supply_feasibility", "monetization_potential", "risk_exposure"] as const) {
      opportunity.scores[key] = {
        ...opportunity.scores[key],
        status: "scored",
        score: 80,
      };
    }
    for (const atom of bundle.supply_atoms) atom.target_sku_verified = true;
    bundle.decision_summary.product_selection_decision = "PROCEED_TO_SAMPLE";
    bundle.decision_summary.formal_sku_decision = "GO";

    const card = buildCommercialViabilityCard({ bundle, economicsScenarioCount: 3 });
    expect(card?.decision).toBe("COMMERCIAL_GO");
    expect(card?.commercialViabilityProven).toBe(true);
    expect(card?.decisiveBlockers).toEqual([]);
    expect(card?.dimensions.every((dimension) => dimension.gateStatus === "positive")).toBe(true);
  });

  it("rejects a proven card that is not commercial-go", async () => {
    const bundle = await readFirstPrinciplesBundle(runId);
    const card = buildCommercialViabilityCard({ bundle, economicsScenarioCount: 0 });
    expect(() => commercialViabilityCardSchema.parse({
      ...card,
      commercialViabilityProven: true,
    })).toThrow();
  });
});
