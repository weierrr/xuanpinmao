import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildRunReport } from "../report/service";
import { ReportUnifiedActionQueue } from "./report-unified-action-queue";

describe("ReportUnifiedActionQueue", () => {
  it("向读者展示唯一第一步和互不覆盖的两条轨道", async () => {
    const report = await buildRunReport("research-run-3d-yoga-pants-28f8bff32ab5-us");
    render(<ReportUnifiedActionQueue queue={report.unifiedActionQueue} />);

    expect(screen.getByText("现在只先做这一件事")).toBeInTheDocument();
    expect(screen.getByText("主线 · 当前瑜伽裤")).toBeInTheDocument();
    expect(screen.getByText("探索支线 · 相邻机会")).toBeInTheDocument();
    expect(screen.getByText(/相邻机会只能做低成本公开研究/)).toBeInTheDocument();
    expect(screen.getByText(/样品阶段同时完成：同光线、同姿势的视觉盲测/)).toBeInTheDocument();
  });
});
