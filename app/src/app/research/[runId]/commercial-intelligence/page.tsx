import Link from "next/link";
import { ArrowRight, BrainCircuit } from "lucide-react";
import { readFirstPrinciplesBundle } from "@/first-principles/service";
import { readLiveResearchArtifacts } from "@/research/live-research";
import path from "node:path";
import { buildPreSampleDecisionBrief } from "@/pre-sample/service";
import { productNameZh, statusZh } from "@/presentation/zh";

export const dynamic = "force-dynamic";

const linkRows = [
  ["C02", "需求洞察", "需求原子"],
  ["C05", "供给与约束", "供给原子与约束条件"],
  ["C06", "机会定义", "推荐机会方向"],
  ["C07", "价值主张", "价值主张与明确不做"],
  ["C08", "验证设计", "验证实验"],
] as const;

export default async function CommercialIntelligencePage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) throw new Error("Invalid research run id");
  const [bundle, artifacts, brief] = await Promise.all([
    readFirstPrinciplesBundle(runId),
    readLiveResearchArtifacts(path.join(process.cwd(), "output", "research", runId)),
    buildPreSampleDecisionBrief(runId),
  ]);
  return (
    <>
      <div className="topbar">
        <div><h1 className="title">商业洞察联动</h1><p className="subtitle">{productNameZh(bundle.product)} · {runId}</p></div>
        <span className="live-badge"><BrainCircuit size={14} />C02–C08</span>
      </div>
      <nav className="tabs" aria-label="研究视图">
        <Link href={`/research/${runId}`}>真实研究</Link>
        <Link href={`/research/${runId}/first-principles`}>第一性原理</Link>
        <Link className="active" href={`/research/${runId}/commercial-intelligence`}>商业洞察</Link>
        <Link href={`/research/${runId}/marketing`}>营销转译</Link>
        <Link href={`/research/${runId}/decision`}>决策边界</Link>
      </nav>

      <div className="card linkage-overview">
        <div><span>既有商业结论</span><strong>{statusZh(artifacts.analysis.productDecision.status)}</strong></div>
        <ArrowRight size={20} />
        <div><span>机会组合推荐</span><strong>{brief.recommendation.title}</strong></div>
        <ArrowRight size={20} />
        <div><span>正式边界</span><strong>{statusZh(bundle.decision_summary.formal_sku_decision)}</strong></div>
      </div>

      <section className="section-stack">
        <h2>映射关系</h2>
        <div className="linkage-list">
          {linkRows.map(([code, name, output]) => (
            <div className="linkage-row" key={code}>
              <strong>{code}</strong><span>{name}</span><ArrowRight size={16} /><b>{output}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="section-stack">
        <h2>从市场信号到机会定义</h2>
        <div className="grid cols-3">
          <div className="card"><h3>市场结论</h3><p>{brief.conclusion}</p></div>
          <div className="card"><h3>用户问题</h3><p>{brief.whyContinue.painPoints.join("；")}</p></div>
          <div className="card"><h3>推荐价值主张</h3><p>{brief.recommendation.coreValue}</p></div>
        </div>
      </section>

      <section className="section-stack">
        <h2>边界保持</h2>
        <div className="callout">
          商业洞察只引用当前研究运行的需求、供给、约束、机会和实验编号；映射不会改写原始结论，也不会提升正式决策状态。
        </div>
      </section>
    </>
  );
}
