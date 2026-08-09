import { describe, expect, it } from "vitest";
import { navigationItemsForPath } from "./navigation";

const hrefFor = (pathname: string, label: string): string | undefined =>
  navigationItemsForPath(pathname).find((item) => item.label === label)?.href;

describe("project-aware navigation", () => {
  it("collapses a live Research Run to a single report entry", () => {
    const runId = "research-run-3d-yoga-pants-dccf676c3167-us";
    const pathname = `/research/${runId}/report`;
    const items = navigationItemsForPath(pathname);
    expect(hrefFor(pathname, "选品报告")).toBe(`/research/${runId}/report`);
    expect(hrefFor(pathname, "项目列表")).toBe("/projects");
    expect(hrefFor(pathname, "项目概览")).toBe(`/projects/research-project-${runId}`);
    expect(hrefFor(pathname, "运行详情")).toBe(`/runs/${runId}`);
    expect(items.map((item) => item.label)).toEqual([
      "发现品类机会",
      "项目列表",
      "选品报告",
      "项目概览",
      "运行详情",
    ]);
  });

  it("does not expose empty risk, economics or duplicate report entries for a live Research Run", () => {
    const runId = "research-run-3d-yoga-pants-dccf676c3167-us";
    const labels = navigationItemsForPath(`/research/${runId}/report`).map((item) => item.label);
    for (const removed of ["风险模块", "单位经济", "买样前简报", "营销转译", "连续选品机会", "高级审计"]) {
      expect(labels).not.toContain(removed);
    }
  });

  it("keeps the T21 fixture inside the fixture project without live marketing links", () => {
    const items = navigationItemsForPath("/projects/project-t21-fixture");
    expect(hrefFor("/projects/project-t21-fixture", "项目概览")).toBe("/projects/project-t21-fixture");
    expect(hrefFor("/projects/project-t21-fixture", "运行详情")).toBe("/runs/T21-full-20260714");
    expect(hrefFor("/projects/project-t21-fixture", "决策报告")).toBe("/runs/T21-full-20260714/decision");
    expect(items.some((item) => item.label === "营销转译")).toBe(false);
  });

  it("shows only global navigation when no project is selected", () => {
    expect(navigationItemsForPath("/discover").map((item) => item.label))
      .toEqual(["发现品类机会", "项目列表"]);
  });
});
