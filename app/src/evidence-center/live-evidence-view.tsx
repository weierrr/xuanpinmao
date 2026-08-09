import Link from "next/link";
import { Database, FileSearch, MessageSquareText, Network, TriangleAlert } from "lucide-react";
import { demandFieldTextZh, demandStatusZh } from "../demand-field/presentation";
import type { LiveEvidenceCenter } from "./live-evidence";
import { Metric, PageHeader } from "../app/components";

const categoryLabels: Record<string, string> = {
  competitor: "竞品",
  market: "市场",
  trend: "趋势",
  customer: "用户",
  regulation: "法规",
  supplier: "供应商",
};

const scopeLabels: Record<string, string> = {
  competitor: "竞品",
  market: "市场/品类",
  target_product: "目标商品",
};

export function LiveEvidenceCenterView({
  runId,
  evidence,
  persistedSourceCount,
  persistedClaimCount,
}: Readonly<{
  runId: string;
  evidence: LiveEvidenceCenter;
  persistedSourceCount: number;
  persistedClaimCount: number;
}>) {
  const { evidencePackage, claims, analysis, vocSummary, demandField } = evidence;
  const mappingErrorCount = evidence.missingClaimSourceIds.length;
  const unknowns = [...new Set([
    ...analysis.unknowns,
    ...evidencePackage.unresolvedItems.map((item) => `${item.priority}｜${item.question}：${item.reason}`),
  ])];
  const databaseLag = persistedSourceCount !== evidencePackage.sources.length || persistedClaimCount !== claims.length;

  return (
    <>
      <PageHeader
        title="证据中心"
        subtitle="Evidence Package、Atomic Claims、用户之声、未知项与需求映射"
        dataOrigin="live"
      />
      <div className="tabs">
        <a href="#source-pages">来源页</a>
        <a href="#atomic-claims">Atomic Claims</a>
        <a href="#voc-evidence">用户之声</a>
        <a href="#unknowns">未知项</a>
        <a href="#demand-field">需求场</a>
        <a href="#mapping">映射与同步</a>
      </div>

      <div className="evidence-metrics">
        <div><span>公开来源页</span><strong>{evidencePackage.sources.length}</strong></div>
        <div><span>Atomic Claims</span><strong>{claims.length}</strong></div>
        <div><span>VOC 有效观察</span><strong>{vocSummary?.coverage.valid_observations ?? 0}</strong></div>
        <div><span>映射错误</span><strong>{mappingErrorCount}</strong></div>
      </div>

      <section className="callout evidence-layer-notice">
        <strong>这些数字属于不同证据层，不能直接相加，也不能只看数据库行数。</strong>
        <p>29 个公开来源页支撑 22 条原子 Claim；用户之声层另外包含 {vocSummary?.coverage.valid_observations ?? 0} 条评论级观察。VOC 是有边界语料，不代表市场总体发生率。</p>
      </section>

      <section id="source-pages" className="card evidence-section">
        <div className="section-heading">
          <div><h2>公开研究来源页</h2><p>每个来源保留访问状态、快照与派生 Claim 数量。</p></div>
          <FileSearch size={22} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>标题</th><th>类型</th><th>目标实体</th><th>访问</th><th>证据状态</th><th>Claim</th></tr></thead>
            <tbody>{evidencePackage.sources.map((source) => (
              <tr key={source.id}>
                <td className="mono">{source.id}</td>
                <td><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></td>
                <td>{categoryLabels[source.sourceType] ?? source.sourceType}</td>
                <td>{source.targetEntity}</td>
                <td>{source.accessStatus}</td>
                <td>{source.evidenceStatus === "verified" ? "已验证" : source.evidenceStatus === "needs_review" ? "待复核" : "无效"}</td>
                <td>{evidence.claimCountBySource.get(source.id) ?? 0}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section id="atomic-claims" className="card evidence-section">
        <div className="section-heading">
          <div><h2>Atomic Claims</h2><p>Claim 与来源一一映射；竞品或市场事实不能当作目标 SKU 已验证事实。</p></div>
          <Network size={22} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>来源</th><th>原子结论</th><th>类别</th><th>适用范围</th><th>置信度</th></tr></thead>
            <tbody>{claims.map((claim) => (
              <tr key={claim.id}>
                <td className="mono">{claim.id}</td>
                <td className="mono">{claim.sourceId}</td>
                <td>{claim.statement}</td>
                <td>{categoryLabels[claim.category] ?? claim.category}</td>
                <td>{scopeLabels[claim.targetScope] ?? claim.targetScope}</td>
                <td>{claim.confidence}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section id="voc-evidence" className="card evidence-section">
        <div className="section-heading">
          <div><h2>用户之声证据</h2><p>评论级观察单独统计，不把页面数冒充评论量。</p></div>
          <MessageSquareText size={22} />
        </div>
        {vocSummary ? (
          <>
            <div className="evidence-metrics">
              <div><span>有效观察</span><strong>{vocSummary.coverage.valid_observations}</strong></div>
              <div><span>负面或中性</span><strong>{vocSummary.coverage.negative_or_neutral}</strong></div>
              <div><span>来源页</span><strong>{vocSummary.coverage.source_count}</strong></div>
              <div><span>来源族 / 平台</span><strong>{vocSummary.coverage.source_family_count} / {vocSummary.coverage.platform_count}</strong></div>
            </div>
            <p><strong>可信度：</strong>{vocSummary.confidence}。{vocSummary.confidence_rationale}</p>
            <p><strong>统计分母：</strong>{vocSummary.denominator_definition}</p>
            <div className="grid cols-2">
              <div><h3>主要痛点</h3><ul className="list">{vocSummary.top_pain_points.map((item) => <li key={item.theme}><strong>{demandFieldTextZh(item.theme)}</strong>：{item.count}/{item.denominator}</li>)}</ul></div>
              <div><h3>代表性评论短摘录</h3><ul className="list">{vocSummary.representative_excerpts.map((item) => <li key={`${item.url}-${item.theme}`}><a href={item.url} target="_blank" rel="noreferrer">{demandFieldTextZh(item.theme)}</a>：{item.excerpt}</li>)}</ul></div>
            </div>
          </>
        ) : <p>当前 Run 尚未生成用户之声摘要。</p>}
      </section>

      <section id="unknowns" className="card evidence-section">
        <div className="section-heading">
          <div><h2>未知项与证据边界</h2><p>缺数据必须保留为未知，不能用营销文案补造。</p></div>
          <TriangleAlert size={22} />
        </div>
        <ul className="list">{unknowns.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section id="demand-field" className="card evidence-section">
        <div className="section-heading">
          <div><h2>Demand Field 证据映射</h2><p>从 VOC 聚合需求，不推断个人身份；相邻机会仍需独立 Research Run。</p></div>
          <Network size={22} />
        </div>
        {demandField ? (
          <>
            <div className="grid cols-3">
              <Metric label="聚合人群" value={demandField.audience_clusters.length} />
              <Metric label="需求原子" value={demandField.need_atoms.length} />
              <Metric label="相邻机会" value={demandField.adjacent_opportunities.length} />
            </div>
            <div className="grid cols-2 evidence-needs">
              <div><h3>需求原子</h3><ul className="list">{demandField.need_atoms.map((item) => <li key={item.id}><strong>{item.id} · {demandFieldTextZh(item.label)}</strong>：{demandFieldTextZh(item.statement)}（{demandStatusZh(item.evidence_status)}）</li>)}</ul></div>
              <div><h3>相邻机会</h3><ul className="list">{demandField.adjacent_opportunities.map((item) => <li key={item.id}><strong>{demandFieldTextZh(item.title)}</strong>：{demandStatusZh(item.evidence_status)}，{item.direct_product_evidence ? "有直接商品证据" : "任务链假设"}</li>)}</ul><Link className="button secondary-button" href={`/research/${runId}/opportunities`}>查看完整机会地图</Link></div>
            </div>
          </>
        ) : <p>当前 Run 尚未生成 Demand Field。</p>}
      </section>

      <section id="mapping" className="card evidence-section">
        <div className="section-heading">
          <div><h2>映射校验与数据库同步</h2><p>Evidence Package 是本次真实研究的权威产物；Prisma 是工作台持久化快照。</p></div>
          <Database size={22} />
        </div>
        <div className="grid cols-2">
          <div>
            <h3>当前 Run 映射</h3>
            <p>Claim → Source 错误：<strong>{mappingErrorCount}</strong></p>
            <p>缺失 Source ID：{evidence.missingClaimSourceIds.join("、") || "无"}</p>
          </div>
          <div className={databaseLag ? "sync-warning" : ""}>
            <h3>Prisma 持久化快照</h3>
            <p>来源：{persistedSourceCount} / {evidencePackage.sources.length}</p>
            <p>Claims：{persistedClaimCount} / {claims.length}</p>
            <p>{databaseLag ? "同步滞后：这里的差值不代表研究证据缺失。" : "已与 Evidence Package 同步。"}</p>
          </div>
        </div>
      </section>
    </>
  );
}
