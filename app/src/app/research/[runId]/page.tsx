import Link from "next/link";
import path from "node:path";
import { Ban, CheckCircle2, ExternalLink, Globe2, Lightbulb, Megaphone, Search } from "lucide-react";
import { readEvidencePackage } from "@/research/evidence-package";
import { readLiveResearchArtifacts } from "@/research/live-research";
import { buildPreSampleDecisionBrief } from "@/pre-sample/service";
import { productNameZh, sourceTitleZh, sourceTypeZh, statusZh } from "@/presentation/zh";

export const dynamic = "force-dynamic";

const stageLabels: Record<string, string> = {
  initializing: "初始化",
  searching_web: "联网研究",
  collecting_evidence: "整理证据",
  analyzing_market: "分析市场",
  generating_decision: "生成决策",
  completed: "已完成",
};

const confidenceLabel: Record<string, string> = {
  verified: "高",
  needs_review: "中 / 低",
  invalid: "无效",
};

const statusStages = ["initializing", "searching_web", "collecting_evidence", "analyzing_market", "generating_decision", "completed"] as const;

export default async function LiveResearchPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) throw new Error("Invalid research run id");
  const packagePath = path.join(process.cwd(), "output", "research", runId);
  const [evidencePackage, artifacts, brief] = await Promise.all([
    readEvidencePackage(packagePath),
    readLiveResearchArtifacts(packagePath),
    buildPreSampleDecisionBrief(runId),
  ]);
  const completedStages = new Set(artifacts.status.history.map((item) => item.stage));
  const scores = [
    ["需求强度", artifacts.analysis.marketOpportunity.demand, "现有公开证据显示运动紧身裤需求持续存在，提臀与塑形风格仍有活跃关注；亚马逊和社区讨论也形成了稳定的品类表达。"],
    ["竞争程度", artifacts.analysis.marketOpportunity.competition, "竞争密集且价格承压，平台上存在大量低于 30 美元的同质商品，成熟独立站促销价主要集中在 40 至 50 美元。"],
    ["趋势表现", artifacts.analysis.marketOpportunity.trend, "Shopify 与持续的社区讨论提供了方向性正向信号，但当前没有取得可复核的 Google Trends 数值序列，TikTok 证据也较弱。"],
    ["变现潜力", artifacts.analysis.marketOpportunity.monetization, "39.99 至 49.90 美元的独立站价格锚点说明：若质量、版型、证明内容和保障政策形成差异，可能高于平台同质商品定价；正式单位经济仍未知。"],
  ] as const;

  return (
    <>
      <div className="topbar">
        <div>
          <span className="plain-badge">高级审计视图</span>
          <h1 className="title">{productNameZh(evidencePackage.researchInput.productName)}</h1>
          <p className="subtitle">{evidencePackage.researchInput.targetMarket} · {runId}</p>
        </div>
        <span className="live-badge"><Globe2 size={14} />真实公开网页</span>
      </div>

      <div className="audit-return">
        <div><strong>普通卖家决策入口</strong><span>查看简化结论、买样要求、预算与停止条件。</span></div>
        <Link className="button" href={`/research/${runId}/brief`}>打开买样前简报</Link>
      </div>

      <div className="research-timeline" aria-label="研究进度">
        {statusStages.map((stage) => (
          <div className={completedStages.has(stage) ? "research-step complete" : "research-step"} key={stage}>
            <span>{completedStages.has(stage) ? <CheckCircle2 size={16} /> : null}</span>
            <strong>{stageLabels[stage]}</strong>
          </div>
        ))}
      </div>

      <div className="grid cols-3">
        <div className="card metric"><span>产品方向决策</span><strong>{statusZh(artifacts.analysis.productDecision.status)}</strong></div>
        <div className="card metric"><span>市场机会评分</span><strong>{artifacts.analysis.marketOpportunity.overall}/100</strong></div>
        <div className="card metric"><span>证据规模</span><strong>{evidencePackage.sources.length} 个来源 / {artifacts.claims.length} 条结论</strong></div>
      </div>

      <section className="research-subnav">
        <Link href={`/research/${runId}/first-principles`}><Lightbulb size={18} /><span><strong>第一性原理</strong><small>需求、供给、约束与机会组合</small></span></Link>
        <Link href={`/research/${runId}/commercial-intelligence`}><span><strong>商业洞察联动</strong><small>C02–C08 映射关系</small></span></Link>
        <Link href={`/research/${runId}/opportunities`}><Search size={18} /><span><strong>连续选品机会</strong><small>同一人群与相邻产品方向</small></span></Link>
        <Link href={`/research/${runId}/marketing`}><Megaphone size={18} /><span><strong>营销转译</strong><small>定位、渠道草案与 Claim 验证</small></span></Link>
        <Link href={`/research/${runId}/decision`}><span><strong>决策边界</strong><small>产品方向与正式目标款</small></span></Link>
      </section>

      <div className="actions-grid" style={{ marginTop: 16 }}>
        {["商品上架", "广告测试"].map((title) => (
          <div className="action-card disabled" key={title}>
            <div className="action-card-title"><span>{title}</span><span className="blocked-badge"><Ban size={14} />禁用</span></div>
            <p>{brief.scopeNotice}</p>
          </div>
        ))}
      </div>

      <section style={{ marginTop: 22 }}>
        <div className="section-heading">
          <div><h2>市场机会</h2><p>{brief.conclusion}</p></div>
          <Link className="button" href={`/api/research/${runId}/report-html`} target="_blank"><ExternalLink size={16} />查看 HTML 报告</Link>
        </div>
        <div className="grid cols-2">
          {scores.map(([label, score, rationale]) => <div className="card" key={label}><h3>{label} · {score.score}/100</h3><p>{rationale}</p></div>)}
        </div>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2>竞品为什么能卖</h2>
        <div className="card">
          <p><strong>定位：</strong>用即时塑形效果和自信叙事，把普通紧身裤包装成明确的问题解决方案。</p>
          <p><strong>价格：</strong>促销价约 49.90 美元，高于平台同质商品，并接近 BRXL 约 39.99 美元的促销锚点。</p>
          <p><strong>组合销售：</strong>通过短裤、运动内衣和上衣交叉销售，并以满 55 美元免邮鼓励多件购买。</p>
          <ul>{brief.whyContinue.competitorReasons.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2>建议卖什么</h2>
        <div className="grid cols-2">
          <div className="card">
            <h3>{brief.recommendation.title}</h3>
            <p><strong>目标用户：</strong>{brief.recommendation.targetCustomer}</p>
            <p><strong>建议售价：</strong>样品质量和落地成本验证后，再评估 39 至 49 美元区间。</p>
          </div>
          <div className="card"><h3>差异化</h3><ul>{brief.mustHave.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2>真实来源与可信度</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>来源编号</th><th>类型</th><th>标题</th><th>可信度</th><th>访问状态</th><th>网址</th></tr></thead>
            <tbody>{evidencePackage.sources.map((source) => (
              <tr key={source.id}>
                <td>{source.id}</td><td>{sourceTypeZh(source.sourceType)}</td><td>{sourceTitleZh(source.title)}</td>
                <td><span className={source.evidenceStatus === "verified" ? "status-badge" : "plain-badge"}>{confidenceLabel[source.evidenceStatus]}</span></td>
                <td>{statusZh(source.accessStatus)}</td>
                <td><a className="source-link" href={source.url} target="_blank" rel="noreferrer">{source.url}</a></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
