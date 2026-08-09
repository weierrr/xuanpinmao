import type { DiscoveryNetwork } from "./types";
import type {
  DiscoveryThemeIndex,
  DiscoveryThemeIndexValidationIssue,
  DiscoveryThemeIndexValidationResult,
} from "./theme-index-types";

export const validateDiscoveryThemeIndex = (
  index: DiscoveryThemeIndex,
  network: DiscoveryNetwork,
): DiscoveryThemeIndexValidationResult => {
  const errors: DiscoveryThemeIndexValidationIssue[] = [];
  const warnings: DiscoveryThemeIndexValidationIssue[] = [];
  const clusterIds = new Set<string>();
  const canonicalKeys = new Set<string>();
  const assignedNodeIds = new Set<string>();
  const nodesById = new Map(network.nodes.map((node) => [node.id, node]));
  const expectedRunIds = [...new Set(network.runIds)].sort();
  const declaredIndexRunIds = [...new Set(index.runIds)].sort();

  if (expectedRunIds.join("|") !== declaredIndexRunIds.join("|")) {
    errors.push({ code: "INDEX_RUN_SCOPE_MISMATCH", message: "主题索引的 Run 范围与来源网络不一致。" });
  }

  for (const cluster of index.clusters) {
    if (clusterIds.has(cluster.id)) {
      errors.push({ code: "DUPLICATE_CLUSTER", message: "发现重复主题聚合。", clusterId: cluster.id });
    }
    clusterIds.add(cluster.id);
    if (canonicalKeys.has(cluster.canonicalKey)) {
      errors.push({ code: "DUPLICATE_CANONICAL_KEY", message: "同一归一化主题被拆成了多个聚合。", clusterId: cluster.id });
    }
    canonicalKeys.add(cluster.canonicalKey);

    const memberRunIds = [...new Set(cluster.members.map((member) => member.runId))].sort();
    const declaredRunIds = [...cluster.runIds].sort();
    if (memberRunIds.join("|") !== declaredRunIds.join("|")) {
      errors.push({ code: "RUN_ID_MISMATCH", message: "主题聚合的 Run 范围与成员不一致。", clusterId: cluster.id });
    }

    const shouldBeCrossRun = memberRunIds.length > 1;
    if (cluster.crossRunCandidate !== shouldBeCrossRun) {
      errors.push({ code: "INVALID_CROSS_RUN_FLAG", message: "跨 Run 候选标记与成员范围不一致。", clusterId: cluster.id });
    }
    if ((cluster.reviewStatus === "human_review_required") !== shouldBeCrossRun) {
      errors.push({ code: "INVALID_REVIEW_STATUS", message: "跨 Run 候选必须等待人工复核。", clusterId: cluster.id });
    }

    const evidenceCountSum = cluster.members.reduce((sum, member) => sum + member.evidenceCount, 0);
    if (evidenceCountSum !== cluster.boundedEvidenceCountSum) {
      errors.push({ code: "INVALID_EVIDENCE_SUM", message: "有界证据计数合计与成员不一致。", clusterId: cluster.id });
    }

    const membersPerRun = new Map<string, number>();
    for (const member of cluster.members) {
      const node = nodesById.get(member.nodeId);
      if (!node) {
        errors.push({ code: "MISSING_MEMBER_NODE", message: "主题成员引用了不存在的网络节点。", clusterId: cluster.id, nodeId: member.nodeId });
        continue;
      }
      if (node.kind !== cluster.kind || node.runId !== member.runId) {
        errors.push({ code: "MEMBER_SCOPE_MISMATCH", message: "主题成员的类型或 Run 与原节点不一致。", clusterId: cluster.id, nodeId: member.nodeId });
      }
      if (assignedNodeIds.has(member.nodeId)) {
        errors.push({ code: "NODE_IN_MULTIPLE_CLUSTERS", message: "同一节点不能进入多个归一化主题。", clusterId: cluster.id, nodeId: member.nodeId });
      }
      assignedNodeIds.add(member.nodeId);
      membersPerRun.set(member.runId, (membersPerRun.get(member.runId) ?? 0) + 1);
    }

    if ([...membersPerRun.values()].some((count) => count > 1)) {
      warnings.push({ code: "DUPLICATE_THEME_WITHIN_RUN", message: "同一 Run 内出现了多个相同归一化主题，请检查是否需要合并。", clusterId: cluster.id });
    }
  }

  const expectedThemeNodeIds = network.nodes
    .filter((node) => node.kind !== "product")
    .map((node) => node.id);
  for (const nodeId of expectedThemeNodeIds) {
    if (!assignedNodeIds.has(nodeId)) {
      errors.push({ code: "UNASSIGNED_THEME_NODE", message: "存在没有进入主题索引的网络节点。", nodeId });
    }
  }

  const expectedMetrics = {
    clusterCount: index.clusters.length,
    crossRunCandidateCount: index.clusters.filter((cluster) => cluster.crossRunCandidate).length,
    singleRunClusterCount: index.clusters.filter((cluster) => !cluster.crossRunCandidate).length,
    controlledAliasClusterCount: index.clusters.filter((cluster) => cluster.normalizationMethod === "controlled_alias").length,
  };
  for (const [metric, expected] of Object.entries(expectedMetrics)) {
    if (index.metrics[metric as keyof typeof expectedMetrics] !== expected) {
      errors.push({ code: "INDEX_METRIC_MISMATCH", message: `主题索引指标 ${metric} 与实际聚合不一致。` });
    }
  }

  if (index.metrics.crossRunCandidateCount === 0 && index.runIds.length > 1) {
    warnings.push({ code: "NO_CROSS_RUN_CANDIDATE", message: "当前多个 Run 之间没有满足受控归一化规则的共同主题。" });
  }

  return { valid: errors.length === 0, errors, warnings };
};
