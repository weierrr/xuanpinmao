import { describe, expect, it } from "vitest";
import { buildRunReport } from "../report/service";
import { buildOpportunityValidationRoadmap } from "./builder";
import { opportunityValidationRoadmapSchema } from "./types";
import { validateOpportunityValidationRoadmap } from "./validation";

const runId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

describe("机会验证优先级与行动路线图", () => {
  it("为瑜伽裤相邻机会生成探索支线内部顺序", async () => {
    const report = await buildRunReport(runId);
    const roadmap = report.opportunityValidationRoadmap;

    expect(roadmap).not.toBeNull();
    expect(roadmap?.runId).toBe(runId);
    expect(roadmap?.candidates.map((candidate) => [candidate.title, candidate.priority])).toEqual([
      ["无痕运动内裤", "E1_RESEARCH_NEXT"],
      ["运动服洗护保护系统", "E2_RESEARCH_LATER"],
      ["健身到通勤遮挡层", "E3_OBSERVE"],
    ]);
    expect(roadmap?.recommendedCandidateId).toBe(roadmap?.candidates[0].id);
    expect(roadmap && validateOpportunityValidationRoadmap(roadmap).valid).toBe(true);
  });

  it("预算和周期保持未知，不展示推导金额或虚假排期", async () => {
    const report = await buildRunReport(runId);
    const roadmap = report.opportunityValidationRoadmap;

    expect(roadmap?.candidates.every((candidate) => candidate.researchPlan.durationLabel === "未排期")).toBe(true);
    expect(roadmap?.candidates.every((candidate) => candidate.researchPlan.budgetLabel.includes("无真实预算数据"))).toBe(true);
    expect(roadmap?.candidates.every((candidate) => !/USD|\$|人民币|CNY|RMB|¥/i.test(candidate.researchPlan.budgetLabel))).toBe(true);
  });

  it("没有直接商品证据的方向不能被提升为探索优先 1", async () => {
    const report = await buildRunReport(runId);
    const roadmap = buildOpportunityValidationRoadmap({
      runId,
      generatedAt: report.generatedAt,
      demandField: report.demandField,
    });
    if (!roadmap) throw new Error("Expected opportunity roadmap");

    const invalid = {
      ...roadmap,
      recommendedCandidateId: roadmap.candidates[1].id,
      candidates: roadmap.candidates.map((candidate, index) => index === 1 ? {
        ...candidate,
        priority: "E1_RESEARCH_NEXT" as const,
        priorityLabel: "探索 1 · 优先补充研究",
      } : candidate),
      metrics: { ...roadmap.metrics, exploreFirst: 2, researchLater: 0 },
    };

    expect(opportunityValidationRoadmapSchema.safeParse(invalid).success).toBe(false);
  });
});
