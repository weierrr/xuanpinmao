import Link from "next/link";
import { Ban, ClipboardCheck, Lightbulb } from "lucide-react";
import { readFirstPrinciplesBundle } from "@/first-principles/service";
import { buildPreSampleDecisionBrief } from "@/pre-sample/service";
import { productNameZh, statusZh } from "@/presentation/zh";

export const dynamic = "force-dynamic";

export default async function ResearchDecisionPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) throw new Error("Invalid research run id");
  const [bundle, brief] = await Promise.all([readFirstPrinciplesBundle(runId), buildPreSampleDecisionBrief(runId)]);

  return (
    <>
      <div className="topbar">
        <div><h1 className="title">决策边界</h1><p className="subtitle">{productNameZh(bundle.product)} · {runId}</p></div>
        <span className="status-badge hold-supply">{statusZh(bundle.decision_summary.formal_sku_decision)}</span>
      </div>
      <nav className="tabs" aria-label="研究视图">
        <Link href={`/research/${runId}`}>真实研究</Link>
        <Link href={`/research/${runId}/first-principles`}>第一性原理</Link>
        <Link href={`/research/${runId}/commercial-intelligence`}>商业洞察</Link>
        <Link className="active" href={`/research/${runId}/decision`}>决策边界</Link>
      </nav>

      <div className="decision-levels">
        <div className="decision-level">
          <Lightbulb size={20} />
          <div><span>第一性原理推荐</span><strong>{brief.recommendation.title}：{brief.recommendation.whyFirst}</strong></div>
        </div>
        <div className="decision-level">
          <ClipboardCheck size={20} />
          <div><span>产品方向决策</span><strong>{statusZh(bundle.decision_summary.product_selection_decision)}</strong></div>
        </div>
        <div className="decision-level formal-hold">
          <Ban size={20} />
          <div><span>正式目标款决策</span><strong>{statusZh(bundle.decision_summary.formal_sku_decision)}</strong></div>
        </div>
      </div>

      <section className="section-stack">
        <h2>进入下一阶段的条件</h2>
        <div className="card">
          <ul className="list">{brief.nextStageRequirements.map((condition) => <li key={condition}>{condition}</li>)}</ul>
        </div>
      </section>

      <section className="section-stack">
        <h2>当前行动权限</h2>
        <div className="actions-grid">
          {["商品上架", "广告测试"].map((name) => (
            <div className="action-card disabled" key={name}>
              <div className="action-card-title"><span>{name}</span><span className="blocked-badge"><Ban size={14} />禁止</span></div>
              <p>{brief.scopeNotice}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
