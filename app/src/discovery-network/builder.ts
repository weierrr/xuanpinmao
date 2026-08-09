import { productNameZh } from "../presentation/zh";
import type { RunReport } from "../report/types";
import {
  discoveryNetworkSchema,
  type DiscoveryNetwork,
  type DiscoveryNetworkEdge,
  type DiscoveryNetworkNode,
} from "./types";
import { validateDiscoveryNetwork } from "./validation";

const slug = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 48);

const reportRef = (report: RunReport, label: string, anchor: string) => ({
  kind: "report" as const,
  referenceId: `${report.runId}:${anchor}`,
  url: `/research/${report.runId}/report#${anchor}`,
  label,
});

const statusFromAdjacent = (direct: boolean, label: string): "directional" | "hypothesis" =>
  direct && label !== "研究假设" ? "directional" : "hypothesis";

const buildNodesForReport = (report: RunReport): { nodes: DiscoveryNetworkNode[]; edges: DiscoveryNetworkEdge[] } => {
  const productId = `product:${report.runId}`;
  const reportUrl = `/research/${report.runId}/report`;
  const nodes: DiscoveryNetworkNode[] = [{
    id: productId,
    kind: "product",
    runId: report.runId,
    productNodeId: productId,
    label: productNameZh(report.product),
    description: report.summary.conclusion,
    evidenceStatus: "supported",
    evidenceCount: report.voice.validObservations,
    reportUrl,
    metadata: {
      market: report.market,
      decisionLabel: report.summary.decisions.productSelection.label,
      category: null,
      directProductEvidence: null,
    },
  }];
  const edges: DiscoveryNetworkEdge[] = [];

  report.narrative.users.slice(0, 3).forEach((description, index) => {
    const label = report.demandField?.audienceLabels[index]
      ?? (description.length > 25 ? `${description.slice(0, 24)}…` : description);
    const id = `audience:${report.runId}:${index + 1}`;
    nodes.push({
      id,
      kind: "audience",
      runId: report.runId,
      productNodeId: productId,
      label,
      description,
      evidenceStatus: "directional",
      evidenceCount: report.voice.validObservations,
      reportUrl: `${reportUrl}#chapter-customers`,
      metadata: { market: report.market, decisionLabel: null, category: null, directProductEvidence: null },
    });
    edges.push({
      id: `edge:${report.runId}:audience:${index + 1}`,
      runId: report.runId,
      sourceNodeId: productId,
      targetNodeId: id,
      relationship: "SERVES_AUDIENCE",
      relationshipLabel: "服务这类人群",
      provenance: "inferred",
      evidenceStatus: "directional",
      evidenceRefs: [reportRef(report, "用户与场景分析", "chapter-customers")],
      boundary: "这是当前 Run 对聚合行为人群的归纳，不代表个人画像或人口统计分布。",
    });
  });

  report.narrative.scenarios.slice(0, 3).forEach((description, index) => {
    const label = description.length > 22 ? `${description.slice(0, 21)}…` : description;
    const id = `scenario:${report.runId}:${index + 1}`;
    nodes.push({
      id,
      kind: "scenario",
      runId: report.runId,
      productNodeId: productId,
      label,
      description,
      evidenceStatus: "directional",
      evidenceCount: report.voice.validObservations,
      reportUrl: `${reportUrl}#chapter-customers`,
      metadata: { market: report.market, decisionLabel: null, category: null, directProductEvidence: null },
    });
    edges.push({
      id: `edge:${report.runId}:scenario:${index + 1}`,
      runId: report.runId,
      sourceNodeId: productId,
      targetNodeId: id,
      relationship: "OCCURS_IN_SCENARIO",
      relationshipLabel: "发生在这个场景",
      provenance: "inferred",
      evidenceStatus: "directional",
      evidenceRefs: [reportRef(report, "用户场景", "chapter-customers")],
      boundary: "场景来自当前 Run 的证据归纳，只说明使用语境，不证明场景人群规模或付费强度。",
    });
  });

  report.voice.topPainPoints.slice(0, 4).forEach((pain, index) => {
    const id = `need:${report.runId}:${slug(pain.theme) || index + 1}`;
    const matchingExcerpt = report.voice.representativeExcerpts.find((item) => item.theme === pain.theme);
    nodes.push({
      id,
      kind: "need",
      runId: report.runId,
      productNodeId: productId,
      label: pain.theme,
      description: `${pain.count}/${pain.denominator} 条当前有界观察涉及该主题；不代表市场总体发生率。`,
      evidenceStatus: "supported",
      evidenceCount: pain.count,
      reportUrl: `${reportUrl}#chapter-customers`,
      metadata: { market: report.market, decisionLabel: null, category: null, directProductEvidence: null },
    });
    edges.push({
      id: `edge:${report.runId}:need:${index + 1}`,
      runId: report.runId,
      sourceNodeId: productId,
      targetNodeId: id,
      relationship: "EXPOSES_NEED",
      relationshipLabel: "暴露出这项需求",
      provenance: "observed",
      evidenceStatus: "supported",
      evidenceRefs: matchingExcerpt ? [{
        kind: "voc_observation",
        referenceId: `${report.runId}:${pain.theme}`,
        url: matchingExcerpt.url,
        label: `${pain.theme}代表观察`,
      }] : [reportRef(report, "用户之声", "chapter-customers")],
      boundary: "计数只描述当前有界语料，不能直接外推市场发生率、销量或目标 SKU 表现。",
    });
  });

  report.demandField?.opportunities.slice(0, 4).forEach((opportunity, index) => {
    const id = `opportunity:${report.runId}:${opportunity.id}`;
    const evidenceStatus = statusFromAdjacent(opportunity.directProductEvidence, opportunity.evidenceStatusLabel);
    nodes.push({
      id,
      kind: "opportunity",
      runId: report.runId,
      productNodeId: productId,
      label: opportunity.title,
      description: opportunity.rationale,
      evidenceStatus,
      evidenceCount: opportunity.supportCount,
      reportUrl: `${reportUrl}#chapter-positioning`,
      metadata: {
        market: report.market,
        decisionLabel: opportunity.statusLabel,
        category: opportunity.category,
        directProductEvidence: opportunity.directProductEvidence,
      },
    });
    edges.push({
      id: `edge:${report.runId}:opportunity:${index + 1}`,
      runId: report.runId,
      sourceNodeId: productId,
      targetNodeId: id,
      relationship: "ADJACENT_OPPORTUNITY",
      relationshipLabel: opportunity.relationships.join(" · "),
      provenance: opportunity.directProductEvidence ? "observed" : "inferred",
      evidenceStatus,
      evidenceRefs: [reportRef(report, "相邻机会与任务链", "chapter-positioning")],
      boundary: opportunity.whyNotApproved,
    });
  });

  return { nodes, edges };
};

export const buildDiscoveryNetworkFromReports = (reports: RunReport[]): DiscoveryNetwork => {
  if (reports.length === 0) throw new Error("Discovery network requires at least one Research Run");
  const graphParts = reports.map(buildNodesForReport);
  const nodes = graphParts.flatMap((part) => part.nodes);
  const edges = graphParts.flatMap((part) => part.edges);
  const network = discoveryNetworkSchema.parse({
    schemaVersion: "1.0",
    generatedAt: new Date(Math.max(...reports.map((report) => Date.parse(report.generatedAt)))).toISOString(),
    title: "人群需求发现网络",
    runIds: reports.map((report) => report.runId),
    nodes,
    edges,
    metrics: {
      productCount: nodes.filter((node) => node.kind === "product").length,
      audienceCount: nodes.filter((node) => node.kind === "audience").length,
      scenarioCount: nodes.filter((node) => node.kind === "scenario").length,
      needCount: nodes.filter((node) => node.kind === "need").length,
      opportunityCount: nodes.filter((node) => node.kind === "opportunity").length,
      observedEdgeCount: edges.filter((edge) => edge.provenance === "observed").length,
      inferredEdgeCount: edges.filter((edge) => edge.provenance === "inferred").length,
    },
    boundaries: [
      "当前网络连接的是商品、聚合人群、使用场景和需求主题，不是个人买家身份图谱。",
      "共同讨论和任务相邻不能证明同一用户共同购买；真实共同购买需要订单或行为数据。",
      "相邻机会只用于发现下一轮研究方向，进入单品结论前必须创建独立 Research Run。",
    ],
  });
  const validation = validateDiscoveryNetwork(network);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  return network;
};
