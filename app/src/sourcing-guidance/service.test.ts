import { describe, expect, it } from "vitest";
import { sourcingCopyText, sourcingStarterFor } from "./service";

describe("sourcing starter", () => {
  it("provides searchable keywords and a factory-ready brief", () => {
    const starter = sourcingStarterFor("research-run-3d-yoga-pants-28f8bff32ab5-us");
    if (!starter) throw new Error("expected yoga sourcing starter");

    expect(starter.coreKeywords).toContain("视觉磨皮瑜伽裤");
    expect(starter.combinationQueries).toHaveLength(4);
    expect(starter.notice).toContain("供应商报价和样品后确认");
    expect(sourcingCopyText(starter)).toContain("发给工厂的话");
    expect(sourcingCopyText(starter)).toContain("不要医用压力裤");
  });

  it("does not reuse the yoga sourcing language for unrelated runs", () => {
    expect(sourcingStarterFor("research-run-another-product-us")).toBeNull();
  });
});
