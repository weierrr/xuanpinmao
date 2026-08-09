import { describe, expect, it } from "vitest";
import { createOpportunityDiscoveryPlan, opportunityDiscoveryTaskMarkdown } from "./service";

describe("category opportunity discovery planner", () => {
  it("creates deterministic, auditable coverage targets from a category keyword", () => {
    const now = new Date("2026-07-29T00:00:00.000Z");
    const first = createOpportunityDiscoveryPlan({ categoryKeyword: "3D yoga pants", targetMarket: "us" }, now);
    const second = createOpportunityDiscoveryPlan({ categoryKeyword: "3D yoga pants", targetMarket: "US" }, now);
    expect(first.discoveryId).toBe(second.discoveryId);
    expect(first.targetMarket).toBe("US");
    expect(first.coverageTargets).toMatchObject({
      minimumAsins: 20,
      maximumAsins: 50,
      minimumValidReviews: 500,
      minimumRedditThreads: 20,
    });
    expect(first.stages.map((stage) => stage.code)).toContain("SATURATION_CHECK");
  });

  it("keeps generated category opportunities outside product approval", () => {
    const plan = createOpportunityDiscoveryPlan({ categoryKeyword: "yoga pants", targetMarket: "US" });
    expect(plan.decisionGuardrails.join(" ")).toContain("独立 Research Run");
    expect(opportunityDiscoveryTaskMarkdown(plan)).toContain("不得给出买样、上架或广告测试结论");
  });

  it("combines keyword, image, and competitor-link signals in one plan", () => {
    const plan = createOpportunityDiscoveryPlan({
      categoryKeyword: "refrigerator water filter",
      targetMarket: "US",
      salesChannel: "amazon",
      imageUrls: ["https://example.com/filter.jpg"],
      competitorUrls: ["https://example.com/competitor-a"],
      referenceUrls: ["https://example.com/filter.jpg"],
    });

    expect(plan.imageUrls).toEqual(["https://example.com/filter.jpg"]);
    expect(plan.competitorUrls).toEqual(["https://example.com/competitor-a"]);
    expect(plan.referenceUrls).toEqual([
      "https://example.com/filter.jpg",
      "https://example.com/competitor-a",
    ]);
    expect(opportunityDiscoveryTaskMarkdown(plan)).toContain("目标渠道：amazon");
    expect(opportunityDiscoveryTaskMarkdown(plan)).toContain("商品图片：https://example.com/filter.jpg");
    expect(opportunityDiscoveryTaskMarkdown(plan)).toContain("竞品链接：https://example.com/competitor-a");
  });
});
