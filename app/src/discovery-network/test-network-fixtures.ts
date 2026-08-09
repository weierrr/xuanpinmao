import type { DiscoveryNetwork, DiscoveryNetworkNode } from "./types";

export const syntheticRunId = "research-run-synthetic-theme-review-us";

export const addSyntheticRunNode = (
  network: DiscoveryNetwork,
  kind: Exclude<DiscoveryNetworkNode["kind"], "product" | "scenario" | "opportunity">,
  label: string,
): DiscoveryNetwork => {
  const sourceProduct = network.nodes.find((node) => node.kind === "product");
  const sourceNode = network.nodes.find((node) => node.kind === kind);
  if (!sourceProduct || !sourceNode) throw new Error(`Missing source nodes for ${kind}`);
  const sourceEdge = network.edges.find((edge) => edge.targetNodeId === sourceNode.id);
  if (!sourceEdge) throw new Error(`Missing source edge for ${kind}`);
  const productId = `product:${syntheticRunId}`;
  const nodeId = `${kind}:${syntheticRunId}:1`;
  const syntheticProduct = {
    ...sourceProduct,
    id: productId,
    runId: syntheticRunId,
    productNodeId: productId,
    label: "合成测试商品",
  };
  const syntheticNode = {
    ...sourceNode,
    id: nodeId,
    runId: syntheticRunId,
    productNodeId: productId,
    label,
  };
  const syntheticEdge = {
    ...sourceEdge,
    id: `edge:${syntheticRunId}:${kind}:1`,
    runId: syntheticRunId,
    sourceNodeId: productId,
    targetNodeId: nodeId,
  };
  return {
    ...network,
    runIds: [...network.runIds, syntheticRunId],
    nodes: [...network.nodes, syntheticProduct, syntheticNode],
    edges: [...network.edges, syntheticEdge],
    metrics: {
      ...network.metrics,
      productCount: network.metrics.productCount + 1,
      audienceCount: network.metrics.audienceCount + (kind === "audience" ? 1 : 0),
      needCount: network.metrics.needCount + (kind === "need" ? 1 : 0),
      observedEdgeCount: network.metrics.observedEdgeCount + (syntheticEdge.provenance === "observed" ? 1 : 0),
      inferredEdgeCount: network.metrics.inferredEdgeCount + (syntheticEdge.provenance === "inferred" ? 1 : 0),
    },
  };
};
