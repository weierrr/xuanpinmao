import { describe, expect, it } from "vitest";
import { createOpportunityDiscoveryPlan } from "@/opportunity-discovery/service";
import { buildWhiteboardReportModules, createResearchWhiteboard } from "./service";
import type { LiveResearchAnalysis, ResearchClaim } from "@/research/live-types";

describe("research whiteboard", () => {
  it("starts with confirmed scope and pending evidence lanes", () => {
    const plan = createOpportunityDiscoveryPlan({
      categoryKeyword: "refrigerator water filter",
      targetMarket: "US",
      salesChannel: "amazon",
      imageUrls: [],
      competitorUrls: ["https://example.com/filter"],
      referenceUrls: [],
    });
    const whiteboard = createResearchWhiteboard(plan, new Date("2026-08-09T00:00:00.000Z"));

    expect(whiteboard.product).toBe("refrigerator water filter");
    expect(whiteboard.stages.scope.status).toBe("complete");
    expect(whiteboard.stages.market.status).toBe("pending");
    expect(whiteboard.stages.validation_report.status).toBe("pending");
    expect(whiteboard.activity).toHaveLength(1);
  });

  it("stores the six seller modules as the report instead of progress-only metadata", () => {
    const score = { score: 50, rationale: "有方向性证据。", sourceIds: ["SRC-001"] };
    const analysis = {
      schemaVersion: "1.0", researchRunId: "research-run-filter-test-us", generatedAt: "2026-08-09T00:00:00.000Z",
      marketOpportunity: { demand: score, competition: score, trend: score, monetization: score, overall: 50, verdict: "有需求但竞争高，需要先受控买样。" },
      competitorInsight: { brandPositioning: "认证与适配", targetAudience: "美国家庭", pricePositioning: "$30-$50", skuSummary: "按接口族拆分", bundleStrategy: "多件装", discountStrategy: "订阅", sellingPoints: ["适配"], materials: "未知", sizeSystem: "按型号", homepageMessaging: "适配与认证", cta: "核对型号", socialProof: "公开评价", reviews: "漏水与适配", ugc: "公开讨论", whyItSells: ["周期性替换需求"], sourceIds: ["SRC-001"] },
      customerInsight: { painPoints: ["担心漏水"], functionalMotives: ["降低替换成本"], emotionalMotives: ["购买更安心"], socialMotives: ["为家庭提供饮水"], sourceIds: ["SRC-001"] },
      positioning: { targetCustomer: "重视适配与认证的家庭", recommendedPriceRange: "$30-$50", coreSellingPoint: "适配可查、性能可验", differentiation: ["先做一个接口族"] },
      productDecision: { status: "PROCEED_TO_SAMPLE", rationale: ["可用样品验证"], sourceIds: ["SRC-001"] },
      actionBoundary: { listingAllowed: false, adTestAllowed: false, reason: "正式报价和样品性能未知。" },
      unknowns: ["正式供应商报价"],
    } satisfies LiveResearchAnalysis;
    const claims: ResearchClaim[] = [{ id: "CLM-001", sourceId: "SRC-001", statement: "存在周期替换需求", evidence: "公开来源", confidence: "High", category: "market", targetScope: "market" }];
    const modules = buildWhiteboardReportModules(analysis, claims, new Date("2026-08-09T00:00:00.000Z"));

    expect(modules.map((item) => item.title)).toEqual(["市场与机会", "用户画像", "竞品分析", "产品方案", "营销打法", "验证方案"]);
    expect(modules.every((item) => item.conclusion.length > 0)).toBe(true);
  });
});
