import { describe, expect, it } from "vitest";
import { buildCurrentDiscoveryNetwork, buildCurrentDiscoveryThemeIndex } from "./service";
import { buildDiscoveryThemeIndex } from "./theme-index-builder";
import { validateDiscoveryThemeIndex } from "./theme-index-validation";
import { addSyntheticRunNode, syntheticRunId } from "./test-network-fixtures";

const yogaRunId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

describe("发现网络主题归一化与跨 Run 聚合", () => {
  it("单一瑜伽裤基准不会伪造跨Run共同主题", async () => {
    const index = await buildCurrentDiscoveryThemeIndex();

    expect(index.metrics.crossRunCandidateCount).toBe(0);
    expect(index.clusters.every((cluster) => cluster.runIds.length === 1)).toBe(true);
    expect(index.boundaries.join(" ")).toContain("不证明共同购买");
  });

  it("只用受控同义词把跨 Run 同类节点标成待人工复核候选", async () => {
    const network = await buildCurrentDiscoveryNetwork();
    const syntheticNetwork = addSyntheticRunNode(network, "need", "尺码与版型");
    const index = buildDiscoveryThemeIndex(syntheticNetwork);
    const candidate = index.clusters.find((cluster) => cluster.canonicalKey === "need:alias:size-fit");

    expect(candidate).toMatchObject({
      canonicalLabel: "尺码与版型适配",
      normalizationMethod: "controlled_alias",
      crossRunCandidate: true,
      reviewStatus: "human_review_required",
      runIds: [syntheticRunId, yogaRunId].sort(),
    });
    expect(candidate?.members).toHaveLength(2);
    expect(candidate?.boundary).toContain("不能据此推断共同购买");
  });

  it("相同词语但节点类型不同仍保持分离", async () => {
    const network = await buildCurrentDiscoveryNetwork();
    const syntheticNetwork = addSyntheticRunNode(network, "audience", "版型与尺码");
    const index = buildDiscoveryThemeIndex(syntheticNetwork);

    expect(index.clusters.some((cluster) => cluster.canonicalKey === "audience:alias:size-fit")).toBe(true);
    expect(index.clusters.find((cluster) => cluster.canonicalKey === "need:alias:size-fit")?.runIds).toEqual([yogaRunId]);
    expect(index.metrics.crossRunCandidateCount).toBe(0);
  });

  it("验证器拒绝把单 Run 主题伪装成跨 Run 候选", async () => {
    const network = await buildCurrentDiscoveryNetwork();
    const index = buildDiscoveryThemeIndex(network);
    const firstCluster = index.clusters[0];
    const forged = {
      ...index,
      clusters: index.clusters.map((cluster) => cluster.id === firstCluster.id
        ? { ...cluster, crossRunCandidate: true, reviewStatus: "human_review_required" as const }
        : cluster),
    };
    const validation = validateDiscoveryThemeIndex(forged, network);

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((issue) => issue.code)).toContain("INVALID_CROSS_RUN_FLAG");
    expect(validation.errors.map((issue) => issue.code)).toContain("INVALID_REVIEW_STATUS");
  });

  it("验证器会核对来源 Run、节点覆盖和聚合指标", async () => {
    const network = await buildCurrentDiscoveryNetwork();
    const index = buildDiscoveryThemeIndex(network);
    const removedCluster = index.clusters[0];
    const forged = {
      ...index,
      runIds: [syntheticRunId],
      clusters: index.clusters.slice(1),
      metrics: { ...index.metrics, clusterCount: index.metrics.clusterCount + 1 },
    };
    const validation = validateDiscoveryThemeIndex(forged, network);

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((issue) => issue.code)).toContain("INDEX_RUN_SCOPE_MISMATCH");
    expect(validation.errors.map((issue) => issue.code)).toContain("UNASSIGNED_THEME_NODE");
    expect(validation.errors.map((issue) => issue.code)).toContain("INDEX_METRIC_MISMATCH");
    expect(removedCluster.members.length).toBeGreaterThan(0);
  });
});
