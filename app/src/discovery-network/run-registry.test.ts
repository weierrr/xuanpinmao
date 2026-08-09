import { describe, expect, it } from "vitest";
import { buildRunReport } from "../report/service";
import { buildCurrentDiscoverySystem, primaryDiscoveryRunId } from "./service";
import { buildDiscoveryRunRegistryFromReports } from "./run-registry";
import { validateDiscoveryRunRegistry } from "./run-registry-validation";

describe("Research Run基准注册表", () => {
  it("当前产品范围只注册最新瑜伽裤报告", async () => {
    const system = await buildCurrentDiscoverySystem();

    expect(system.registry.entries).toHaveLength(1);
    expect(system.registry.entries[0]).toMatchObject({ runId: primaryDiscoveryRunId, status: "active" });
    expect(system.registry.boundaries.join(" ")).toContain("不自动扫描或优化其他报告目录");
    expect(validateDiscoveryRunRegistry(system.registry).valid).toBe(true);
  });

  it("未来同一商品出现新版时仍能覆盖旧版", async () => {
    const current = await buildRunReport(primaryDiscoveryRunId);
    const previous = {
      ...current,
      runId: "research-run-3d-yoga-pants-previous-version-us",
      generatedAt: "2026-07-01T00:00:00.000Z",
    };
    const registry = buildDiscoveryRunRegistryFromReports([previous, current]);

    expect(registry.entries.find((entry) => entry.runId === current.runId)).toMatchObject({ status: "active" });
    expect(registry.entries.find((entry) => entry.runId === previous.runId)).toMatchObject({
      status: "superseded",
      supersededByRunId: current.runId,
    });
  });

  it("显式排除的基准Run必须保留原因", async () => {
    const current = await buildRunReport(primaryDiscoveryRunId);
    const registry = buildDiscoveryRunRegistryFromReports([current], [{
      runId: "research-run-incomplete-yoga-audit-us",
      reason: "缺少生成完整瑜伽裤报告所需的产物文件。",
    }]);
    const excluded = registry.entries.find((entry) => entry.status === "excluded");

    expect(excluded).toMatchObject({ productKey: null, reportGeneratedAt: null });
    expect(excluded?.exclusionReason).toContain("缺少");
    expect(validateDiscoveryRunRegistry(registry).valid).toBe(true);
  });
});
