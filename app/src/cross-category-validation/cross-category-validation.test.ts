import { describe, expect, it } from "vitest";
import { buildSecondCategoryValidation } from "./service";

const baseInput = {
  runId: "research-run-manual-dog-paw-cleaner-cup-4c8ff1c9a424-us",
  generatedAt: "2026-08-05T00:00:00.000Z",
  product: "manual dog paw cleaner cup",
  listingAllowed: false,
  adTestAllowed: false,
  capabilities: {
    summary: true,
    commercialViability: true,
    voiceOfCustomer: true,
    buildPlan: true,
    validationPlan: true,
    actionBoundary: true,
    consumerPsychology: false,
    priceMarketStructure: false,
    estimatedUnitEconomics: false,
    conclusionGovernance: false,
    marketingDecisionChain: false,
  },
  textCorpus: ["犬只接受度", "脚掌尺寸", "泥污清洁", "内胆拆洗", "彻底干燥", "雨天遛狗"],
} as const;

describe("second category validation", () => {
  it("passes the core pipeline while keeping missing advanced modules visible", () => {
    const result = buildSecondCategoryValidation(baseInput);
    expect(result).toMatchObject({
      status: "partial",
      statusLabel: "核心链路通过，继续补齐",
      metrics: {
        passedChecks: 5,
        coreCapabilitiesAvailable: 6,
        advancedCapabilitiesAvailable: 0,
        contaminationCount: 0,
      },
    });
    expect(result?.checks.find((check) => check.key === "advanced_modules")?.status).toBe("warning");
  });

  it("fails when clothing-specific conclusions leak into the pet category", () => {
    const result = buildSecondCategoryValidation({
      ...baseInput,
      textCorpus: [...baseInput.textCorpus, "Ionix 视觉磨皮瑜伽裤"],
    });
    expect(result?.status).toBe("failed");
    expect(result?.metrics.contaminationCount).toBeGreaterThan(0);
    expect(result?.checks.find((check) => check.key === "contamination")?.status).toBe("fail");
  });

  it("does not attach the dog-paw profile to unrelated runs", () => {
    expect(buildSecondCategoryValidation({
      ...baseInput,
      runId: "research-run-unrelated-category-us",
    })).toBeNull();
  });
});

