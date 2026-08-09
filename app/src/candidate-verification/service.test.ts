import { describe, expect, it } from "vitest";
import { competitorAdvertisingAuditFor } from "../report/competitor-advertising-audit";
import { buildCandidateVerificationWorkspace } from "./service";

const runId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

describe("candidate product verification workspace", () => {
  it("stays in an honest empty state until a real candidate is submitted", () => {
    const workspace = buildCandidateVerificationWorkspace({
      runId,
      direction: "视觉磨皮与自然轮廓管理款",
      productConcept: "用高密哑光面料、无前缝和稳定高腰实现视觉平滑。",
      mustHave: ["防透", "无前缝", "稳定高腰"],
      priceMarketStructure: null,
      advertisingAudit: competitorAdvertisingAuditFor(runId),
    });

    expect(workspace.status).toBe("awaiting_candidate");
    expect(workspace.candidate).toBeNull();
    expect(workspace.variantFacts).toEqual([]);
    expect(workspace.matchAssessment).toBeNull();
    expect(workspace.matchRules.map((rule) => rule.level)).toEqual([
      "exact",
      "near",
      "adjacent",
      "mismatch",
    ]);
    expect(workspace.references.length).toBeGreaterThan(0);
  });

  it("keeps target-SKU performance unverified without samples", () => {
    const workspace = buildCandidateVerificationWorkspace({
      runId,
      direction: "视觉磨皮与自然轮廓管理款",
      productConcept: "用高密哑光面料、无前缝和稳定高腰实现视觉平滑。",
      mustHave: ["防透", "无前缝", "稳定高腰"],
      priceMarketStructure: null,
      advertisingAudit: null,
    });

    expect(workspace.evidenceModules.find((module) => module.key === "target_performance"))
      .toMatchObject({ status: "unverified", statusLabel: "尚未实测" });
  });
});
