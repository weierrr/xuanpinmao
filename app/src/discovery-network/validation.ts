import type {
  DiscoveryNetwork,
  DiscoveryNetworkValidationIssue,
  DiscoveryNetworkValidationResult,
} from "./types";

export const validateDiscoveryNetwork = (network: DiscoveryNetwork): DiscoveryNetworkValidationResult => {
  const errors: DiscoveryNetworkValidationIssue[] = [];
  const warnings: DiscoveryNetworkValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const productIds = new Set(network.nodes.filter((node) => node.kind === "product").map((node) => node.id));

  for (const node of network.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push({ code: "DUPLICATE_NODE", message: `重复节点：${node.id}`, nodeId: node.id });
    }
    nodeIds.add(node.id);
    if (!productIds.has(node.productNodeId)) {
      errors.push({ code: "MISSING_PRODUCT_HUB", message: "节点没有对应的商品中心。", nodeId: node.id });
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of network.edges) {
    if (edgeIds.has(edge.id)) {
      errors.push({ code: "DUPLICATE_EDGE", message: `重复关系：${edge.id}`, edgeId: edge.id });
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      errors.push({ code: "BROKEN_EDGE", message: "关系引用了不存在的节点。", edgeId: edge.id });
    }
    const source = network.nodes.find((node) => node.id === edge.sourceNodeId);
    const target = network.nodes.find((node) => node.id === edge.targetNodeId);
    if (source && target && (source.runId !== edge.runId || target.runId !== edge.runId)) {
      errors.push({ code: "CROSS_RUN_EDGE", message: "第一版网络不允许用推断关系跨 Research Run 连线。", edgeId: edge.id });
    }
    if (edge.evidenceRefs.every((reference) => reference.url.length === 0)) {
      errors.push({ code: "MISSING_EVIDENCE_URL", message: "关系缺少可打开的证据入口。", edgeId: edge.id });
    }
  }

  for (const productId of productIds) {
    if (!network.edges.some((edge) => edge.sourceNodeId === productId)) {
      warnings.push({ code: "ISOLATED_PRODUCT", message: "商品中心没有关联节点。", nodeId: productId });
    }
  }

  if (network.metrics.opportunityCount === 0) {
    warnings.push({ code: "NO_ADJACENT_OPPORTUNITY", message: "当前网络尚未生成任何相邻商品机会。" });
  }

  return { valid: errors.length === 0, errors, warnings };
};
