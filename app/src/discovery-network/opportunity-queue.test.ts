import { describe, expect, it } from "vitest";
import { buildCurrentDiscoveryNetwork, buildCurrentDiscoveryOpportunityQueue } from "./service";
import { buildDiscoveryThemeIndex } from "./theme-index-builder";
import { buildDiscoveryOpportunityQueue } from "./opportunity-queue-builder";
import { validateDiscoveryOpportunityQueue } from "./opportunity-queue-validation";
import type { DiscoveryOpportunityQueue } from "./opportunity-queue-types";
import { addSyntheticRunNode } from "./test-network-fixtures";

describe("发现机会候选队列", () => {
  it("当前没有受控跨Run共同主题时保持空队列", async () => {
    const queue = await buildCurrentDiscoveryOpportunityQueue();

    expect(queue.candidates).toHaveLength(0);
    expect(queue.metrics).toEqual({ candidateCount: 0, pendingReviewCount: 0, researchRunReadyCount: 0 });
  });

  it("跨Run归一化命中只会生成待人工复核候选", async () => {
    const network = await buildCurrentDiscoveryNetwork();
    const syntheticNetwork = addSyntheticRunNode(network, "need", "尺码与版型");
    const index = buildDiscoveryThemeIndex(syntheticNetwork);
    const queue = buildDiscoveryOpportunityQueue(index);
    const candidate = queue.candidates.find((item) => item.canonicalLabel === "尺码与版型适配");

    expect(candidate).toMatchObject({ status: "pending_review", canCreateResearchRun: false });
    expect(candidate?.reviewQuestions).toHaveLength(4);
    expect(candidate?.boundary).toContain("不得创建新Run或进入产品结论");
    expect(validateDiscoveryOpportunityQueue(queue, index).valid).toBe(true);
  });

  it("验证器拒绝把未审核候选改成可创建Run", async () => {
    const network = await buildCurrentDiscoveryNetwork();
    const syntheticNetwork = addSyntheticRunNode(network, "need", "尺码与版型");
    const index = buildDiscoveryThemeIndex(syntheticNetwork);
    const queue = buildDiscoveryOpportunityQueue(index);
    const forged = {
      ...queue,
      candidates: queue.candidates.map((candidate) => ({ ...candidate, canCreateResearchRun: true })),
    } as unknown as DiscoveryOpportunityQueue;
    const validation = validateDiscoveryOpportunityQueue(forged, index);

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((issue) => issue.code)).toContain("UNREVIEWED_CANDIDATE_READY");
  });
});
