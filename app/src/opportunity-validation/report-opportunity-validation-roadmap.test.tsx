import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildRunReport } from "../report/service";
import { ReportOpportunityValidationRoadmap } from "./report-opportunity-validation-roadmap";

describe("ReportOpportunityValidationRoadmap", () => {
  it("把研究优先级、证据边界和未知预算直接展示给读者", async () => {
    const report = await buildRunReport("research-run-3d-yoga-pants-28f8bff32ab5-us");
    if (!report.opportunityValidationRoadmap) throw new Error("Expected opportunity roadmap");

    render(<ReportOpportunityValidationRoadmap roadmap={report.opportunityValidationRoadmap} />);

    expect(screen.getByText("相邻机会先研究哪个？")).toBeInTheDocument();
    expect(screen.getByText("探索 1 · 优先补充研究")).toBeInTheDocument();
    expect(screen.getAllByText("无痕运动内裤").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/当前无真实预算数据/)).toHaveLength(3);
    expect(screen.getByText(/不会替代当前瑜伽裤的主线验证/)).toBeInTheDocument();
  });
});
