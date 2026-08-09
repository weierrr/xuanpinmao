"use client";

import { useState } from "react";
import {
  ArrowRight,
  CircleDot,
  GitBranch,
  MapPin,
  PackageSearch,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import type { DiscoveryNetwork, DiscoveryNetworkNode } from "./types";

const groupMeta = {
  audience: { label: "谁在面对", icon: Users },
  scenario: { label: "何时发生", icon: MapPin },
  need: { label: "暴露什么需求", icon: CircleDot },
  opportunity: { label: "还能研究什么", icon: Sparkles },
} as const;

const statusLabels = {
  supported: "已有支持",
  directional: "方向性证据",
  hypothesis: "待验证假设",
} as const;

type GroupKind = keyof typeof groupMeta;

export function ReportDiscoveryNetwork({ network }: Readonly<{ network: DiscoveryNetwork }>) {
  const product = network.nodes.find((node) => node.kind === "product");
  const [selectedNodeId, setSelectedNodeId] = useState(product?.id ?? "");
  const selectedNode = network.nodes.find((node) => node.id === selectedNodeId) ?? product;
  const selectedEdge = selectedNode?.kind === "product"
    ? null
    : network.edges.find((edge) => edge.targetNodeId === selectedNode?.id) ?? null;

  if (!product || !selectedNode) return null;

  const groups = (Object.keys(groupMeta) as GroupKind[]).map((kind) => ({
    kind,
    ...groupMeta[kind],
    nodes: network.nodes.filter((node) => node.kind === kind),
  }));

  const renderNode = (node: DiscoveryNetworkNode) => (
    <button
      aria-pressed={node.id === selectedNode.id}
      className={`report-discovery-node status-${node.evidenceStatus}${node.id === selectedNode.id ? " selected" : ""}`}
      key={node.id}
      onClick={() => setSelectedNodeId(node.id)}
      type="button"
    >
      <strong>{node.label}</strong>
      <span>{statusLabels[node.evidenceStatus]} · {node.evidenceCount > 0 ? `${node.evidenceCount} 条` : "无直接计数"}</span>
    </button>
  );

  return (
    <section className="report-discovery-network" aria-labelledby="report-discovery-network-title">
      <header className="report-discovery-network-head">
        <div>
          <span>从单品结论继续向外发现</span>
          <h3 id="report-discovery-network-title">这款商品连接着哪些人、场景与相邻机会？</h3>
          <p>这里不生成新结论，只把本报告已经出现的人群、场景、VOC 需求和 Demand Field 放到同一张关系图里。</p>
        </div>
        <div className="report-discovery-network-mark" aria-hidden="true">
          <GitBranch size={28} />
          <strong>{network.nodes.length - 1}</strong>
          <span>个关联节点</span>
        </div>
      </header>

      <div className="report-discovery-map">
        <button
          aria-pressed={selectedNode.id === product.id}
          className={`report-discovery-product${selectedNode.id === product.id ? " selected" : ""}`}
          onClick={() => setSelectedNodeId(product.id)}
          type="button"
        >
          <PackageSearch size={23} />
          <span>{product.metadata.market} · 当前商品</span>
          <strong>{product.label}</strong>
          <em>{product.metadata.decisionLabel}</em>
        </button>

        {groups.map(({ kind, label, icon: Icon, nodes }) => (
          <div className={`report-discovery-group kind-${kind}`} key={kind}>
            <header><Icon size={15} /><span>{label}</span><em>{nodes.length}</em></header>
            <div className="report-discovery-node-list">
              {nodes.length > 0 ? nodes.map(renderNode) : (
                <p className="report-discovery-empty">
                  {kind === "opportunity" ? "尚未生成相邻商品产物" : "当前报告没有可展示节点"}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <aside className="report-discovery-detail" aria-live="polite">
        <div>
          <span>{selectedNode.kind === "product" ? "当前商品中心" : statusLabels[selectedNode.evidenceStatus]}</span>
          <h4>{selectedNode.label}</h4>
          <p>{selectedNode.description}</p>
        </div>
        <div className="report-discovery-evidence">
          {selectedEdge ? (
            <>
              <strong>{selectedEdge.relationshipLabel}</strong>
              <p><ShieldAlert size={14} />{selectedEdge.boundary}</p>
              <a href={selectedEdge.evidenceRefs[0].url}>{selectedEdge.evidenceRefs[0].label}<ArrowRight size={13} /></a>
            </>
          ) : (
            <p>选择人群、场景、需求或相邻机会，查看它为什么与当前商品相连。</p>
          )}
        </div>
      </aside>

      <footer className="report-discovery-network-footer">
        <p>共同讨论不等于共同购买；相邻机会进入决策前，必须创建独立 Research Run。</p>
      </footer>
    </section>
  );
}
