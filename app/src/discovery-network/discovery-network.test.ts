import { describe, expect, it } from "vitest";
import { buildCurrentDiscoveryNetwork, buildCurrentDiscoverySystem } from "./service";
import { validateDiscoveryNetwork } from "./validation";
import { buildDiscoveryNetworkFromReports } from "./builder";
import { buildRunReport } from "../report/service";

describe("人群需求发现网络", () => {
  it("可以用同一 Schema 为单份选品报告生成内嵌网络", async () => {
    const report = await buildRunReport("research-run-3d-yoga-pants-28f8bff32ab5-us");
    const network = buildDiscoveryNetworkFromReports([report]);

    expect(network.runIds).toEqual([report.runId]);
    expect(network.metrics.productCount).toBe(1);
    expect(network.nodes.filter((node) => node.kind === "product")).toHaveLength(1);
    expect(network.edges.every((edge) => edge.runId === report.runId)).toBe(true);
    expect(validateDiscoveryNetwork(network).valid).toBe(true);
  });

  it("当前产品范围只使用最新瑜伽裤基准Run", async () => {
    const system = await buildCurrentDiscoverySystem();
    const network = system.network;
    const productNodes = network.nodes.filter((node) => node.kind === "product");

    expect(productNodes).toHaveLength(system.registry.metrics.activeRunCount);
    expect(network.metrics.productCount).toBe(system.registry.metrics.activeRunCount);
    expect(system.registry.metrics).toEqual({
      discoveredRunCount: 1,
      activeRunCount: 1,
      supersededRunCount: 0,
      excludedRunCount: 0,
    });
    expect(network.runIds).toEqual(["research-run-3d-yoga-pants-28f8bff32ab5-us"]);
    expect(validateDiscoveryNetwork(network).valid).toBe(true);
    expect(network.edges.every((edge) => {
      const source = network.nodes.find((node) => node.id === edge.sourceNodeId);
      const target = network.nodes.find((node) => node.id === edge.targetNodeId);
      return source?.runId === edge.runId && target?.runId === edge.runId;
    })).toBe(true);
  });

  it("只把已有 Demand Field 的瑜伽裤相邻机会放进网络", async () => {
    const network = await buildCurrentDiscoveryNetwork();
    const yogaRunId = "research-run-3d-yoga-pants-28f8bff32ab5-us";
    const pawCleanerRunId = "research-run-manual-dog-paw-cleaner-cup-4c8ff1c9a424-us";
    const opportunities = network.nodes.filter((node) => node.kind === "opportunity");

    expect(opportunities).toHaveLength(3);
    expect(opportunities.every((node) => node.runId === yogaRunId)).toBe(true);
    expect(opportunities.some((node) => node.runId === pawCleanerRunId)).toBe(false);
  });

  it("保留 VOC 分母边界，并要求假设关系保持推导性质", async () => {
    const network = await buildCurrentDiscoveryNetwork();
    const needs = network.nodes.filter((node) => node.kind === "need");
    const hypothesisEdges = network.edges.filter((edge) => edge.evidenceStatus === "hypothesis");

    expect(needs.length).toBeGreaterThan(0);
    expect(needs.every((node) => /\d+\/\d+ 条当前有界观察/.test(node.description))).toBe(true);
    expect(hypothesisEdges.length).toBeGreaterThan(0);
    expect(hypothesisEdges.every((edge) => edge.provenance === "inferred")).toBe(true);
  });

  it("当前网络不会加载其他品类Run", async () => {
    const network = await buildCurrentDiscoveryNetwork();

    expect(network.nodes.every((node) => node.runId === "research-run-3d-yoga-pants-28f8bff32ab5-us")).toBe(true);
    expect(network.nodes.some((node) => /洗爪|牙膏|书签|收纳|手机支架/.test(`${node.label} ${node.description}`))).toBe(false);
    expect(network.boundaries.join(" ")).toContain("共同购买");
    expect(network.boundaries.join(" ")).toContain("独立 Research Run");
  });
});
