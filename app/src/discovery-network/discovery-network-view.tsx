"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CircleDot,
  GitBranch,
  Lightbulb,
  MapPin,
  PackageSearch,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import type { DiscoveryNetwork, DiscoveryNetworkNode } from "./types";

const kindLabels = {
  product: "商品中心",
  audience: "聚合人群",
  scenario: "使用场景",
  need: "已观察需求",
  opportunity: "相邻机会",
} as const;

const statusLabels = {
  supported: "已有支持",
  directional: "方向性证据",
  hypothesis: "待验证假设",
} as const;

const KindIcon = ({ kind }: Readonly<{ kind: DiscoveryNetworkNode["kind"] }>) => {
  if (kind === "audience") return <Users size={16} />;
  if (kind === "scenario") return <MapPin size={16} />;
  if (kind === "need") return <CircleDot size={16} />;
  if (kind === "opportunity") return <Sparkles size={16} />;
  return <PackageSearch size={16} />;
};

export function DiscoveryNetworkView({ network }: Readonly<{ network: DiscoveryNetwork }>) {
  const productNodes = network.nodes.filter((node) => node.kind === "product");
  const [selectedProductId, setSelectedProductId] = useState(productNodes[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState(productNodes[0]?.id ?? "");
  const selectedProduct = network.nodes.find((node) => node.id === selectedProductId) ?? productNodes[0];
  const selectedNode = network.nodes.find((node) => node.id === selectedNodeId) ?? selectedProduct;
  const productNodesInNetwork = useMemo(
    () => network.nodes.filter((node) => node.productNodeId === selectedProduct?.id && node.kind !== "product"),
    [network.nodes, selectedProduct?.id],
  );
  const grouped = {
    audience: productNodesInNetwork.filter((node) => node.kind === "audience"),
    scenario: productNodesInNetwork.filter((node) => node.kind === "scenario"),
    need: productNodesInNetwork.filter((node) => node.kind === "need"),
    opportunity: productNodesInNetwork.filter((node) => node.kind === "opportunity"),
  };
  const selectedEdges = selectedNode?.kind === "product"
    ? []
    : network.edges.filter((edge) => edge.sourceNodeId === selectedNode?.id || edge.targetNodeId === selectedNode?.id);

  const selectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedNodeId(productId);
  };

  const renderNode = (node: DiscoveryNetworkNode) => (
    <button
      className={`discovery-network-node kind-${node.kind} status-${node.evidenceStatus}${selectedNode?.id === node.id ? " selected" : ""}`}
      key={node.id}
      onClick={() => setSelectedNodeId(node.id)}
      type="button"
    >
      <span className="discovery-network-node-icon"><KindIcon kind={node.kind} /></span>
      <span>
        <small>{kindLabels[node.kind]} · {statusLabels[node.evidenceStatus]}</small>
        <strong>{node.label}</strong>
        <em>{node.evidenceCount > 0 ? `${node.evidenceCount} 条当前证据` : "尚无直接计数"}</em>
      </span>
    </button>
  );

  if (!selectedProduct || !selectedNode) return null;

  return (
    <>
      <section className="discovery-network-hero">
        <div>
          <span>DISCOVERY NETWORK · EVIDENCE FIRST</span>
          <h2>从一个商品，看见一群人正在发生的一组需求</h2>
          <p>网络连接当前 Research Run 中的聚合人群、使用场景、用户需求和相邻机会。每条关系都保留证据状态与边界，不把共同讨论冒充共同购买。</p>
        </div>
        <div className="discovery-network-hero-mark" aria-hidden="true">
          <GitBranch size={74} strokeWidth={1.4} />
          <span>{network.metrics.productCount} 个商品中心</span>
        </div>
      </section>

      <section className="discovery-network-metrics" aria-label="发现网络覆盖">
        <div><strong>{network.metrics.audienceCount}</strong><span>聚合人群</span></div>
        <div><strong>{network.metrics.scenarioCount}</strong><span>使用场景</span></div>
        <div><strong>{network.metrics.needCount}</strong><span>已观察需求</span></div>
        <div><strong>{network.metrics.opportunityCount}</strong><span>相邻机会</span></div>
        <div><strong>{network.metrics.observedEdgeCount}/{network.metrics.inferredEdgeCount}</strong><span>观察关系 / 推导关系</span></div>
      </section>

      <div className="discovery-network-product-tabs" role="tablist" aria-label="选择商品中心">
        {productNodes.map((product) => (
          <button
            aria-selected={selectedProduct.id === product.id}
            className={selectedProduct.id === product.id ? "active" : ""}
            key={product.id}
            onClick={() => selectProduct(product.id)}
            role="tab"
            type="button"
          >
            <span>{product.label}</span>
            <small>{product.metadata.decisionLabel}</small>
          </button>
        ))}
      </div>

      <section className="discovery-network-workspace">
        <div className="discovery-network-board">
          <div className="discovery-network-lane lane-audience">
            <header><Users size={17} /><span>谁正在面对这个问题</span></header>
            {grouped.audience.map(renderNode)}
          </div>

          <div className="discovery-network-center">
            <span className="discovery-network-orbit orbit-one" />
            <span className="discovery-network-orbit orbit-two" />
            <button
              className={`discovery-network-product${selectedNode.id === selectedProduct.id ? " selected" : ""}`}
              onClick={() => setSelectedNodeId(selectedProduct.id)}
              type="button"
            >
              <PackageSearch size={28} />
              <small>{selectedProduct.metadata.market} · 商品中心</small>
              <strong>{selectedProduct.label}</strong>
              <span>{selectedProduct.metadata.decisionLabel}</span>
            </button>
          </div>

          <div className="discovery-network-lane lane-scenario">
            <header><MapPin size={17} /><span>需求在什么时刻发生</span></header>
            {grouped.scenario.map(renderNode)}
          </div>

          <div className="discovery-network-lane lane-needs">
            <header><CircleDot size={17} /><span>当前语料实际暴露了什么</span></header>
            {grouped.need.map(renderNode)}
          </div>

          <div className="discovery-network-lane lane-opportunities">
            <header><Sparkles size={17} /><span>下一门可能值得研究的生意</span></header>
            {grouped.opportunity.length > 0 ? grouped.opportunity.map(renderNode) : (
              <div className="discovery-network-empty">
                <Lightbulb size={18} />
                <strong>尚未生成相邻商品产物</strong>
                <p>该 Run 已有核心研究链路，但还需要独立 Demand Field 才能显示相邻机会。</p>
              </div>
            )}
          </div>
        </div>

        <aside className="discovery-network-inspector">
          <span>{kindLabels[selectedNode.kind]} · {statusLabels[selectedNode.evidenceStatus]}</span>
          <h3>{selectedNode.label}</h3>
          <p>{selectedNode.description}</p>
          <dl>
            <div><dt>当前证据</dt><dd>{selectedNode.evidenceCount} 条</dd></div>
            <div><dt>所属市场</dt><dd>{selectedNode.metadata.market}</dd></div>
            {selectedNode.metadata.category ? <div><dt>候选品类</dt><dd>{selectedNode.metadata.category}</dd></div> : null}
            {selectedNode.metadata.directProductEvidence !== null ? (
              <div><dt>直接商品证据</dt><dd>{selectedNode.metadata.directProductEvidence ? "有" : "无"}</dd></div>
            ) : null}
          </dl>

          <div className="discovery-network-relations">
            <h4>为什么会连在一起</h4>
            {selectedEdges.length > 0 ? selectedEdges.map((edge) => (
              <article key={edge.id}>
                <header><strong>{edge.relationshipLabel}</strong><em>{edge.provenance === "observed" ? "直接观察" : "证据归纳"}</em></header>
                <p>{edge.boundary}</p>
                {edge.evidenceRefs.map((reference) => (
                  <Link href={reference.url} key={`${edge.id}-${reference.referenceId}`}>{reference.label}<ArrowRight size={13} /></Link>
                ))}
              </article>
            )) : <p className="discovery-network-no-relations">这是当前商品中心，选择周围节点可查看具体关系依据。</p>}
          </div>

          <Link className="discovery-network-report-link" href={selectedNode.reportUrl}>
            查看对应完整报告 <ArrowRight size={15} />
          </Link>
        </aside>
      </section>

      <section className="discovery-network-boundaries">
        <header><ShieldAlert size={20} /><div><span>当前数据边界</span><strong>这是一张需求关系图，不是订单买家图谱</strong></div></header>
        <ul>{network.boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}</ul>
      </section>
    </>
  );
}
