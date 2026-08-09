import { ArrowRight, CheckCircle2, FlaskConical, Search, Users } from "lucide-react";
import { buildConceptMessageArchitecture } from "../marketing-translation/concept";
import type { DemandFieldArtifact } from "./types";
import {
  demandFieldMetrics,
  demandFieldTextZh,
  demandRelationshipZh,
  demandStatusZh,
} from "./presentation";

export function DemandFieldView({
  artifact,
  createResearchRunAction,
}: Readonly<{
  artifact: DemandFieldArtifact;
  createResearchRunAction?: (formData: FormData) => Promise<void>;
}>) {
  const metrics = demandFieldMetrics(artifact);
  return (
    <>
      <div className="grid cols-3">
        <div className="card metric"><span>聚合人群</span><strong>{metrics.audiences}</strong></div>
        <div className="card metric"><span>任务链步骤</span><strong>{metrics.taskSteps}</strong></div>
        <div className="card metric"><span>相邻机会</span><strong>{metrics.opportunities}</strong></div>
      </div>

      <section className="callout opportunity-boundary">
        <strong>研究边界：这些是同一人群的候选研究方向，不是已批准选品。</strong>
        <p>每个方向都必须创建独立调研任务，重新验证需求、竞争、供应与单位经济。</p>
      </section>

      <section className="section-stack">
        <div className="section-heading">
          <div><h2>聚合用户画像</h2><p>仅描述被证据支持的行为和任务，不推断个人身份或人口属性。</p></div>
          <Users size={22} />
        </div>
        <div className="grid cols-2">
          {artifact.audience_clusters.map((audience) => (
            <article className="card" key={audience.id}>
              <span className="plain-badge">{audience.supporting_observation_ids.length} 条支持观察</span>
              <h3>{demandFieldTextZh(audience.label)}</h3>
              <p>{demandFieldTextZh(audience.definition)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-stack">
        <h2>从当前商品延伸的任务链</h2>
        <div className="demand-task-chain">
          {[...artifact.task_chain].sort((a, b) => a.sequence - b.sequence).map((step, index) => (
            <div className="demand-task-step" key={step.id}>
              <span>{step.sequence}</span>
              <div>
                <small>{demandStatusZh(step.relative_to_current_product)}</small>
                <strong>{demandFieldTextZh(step.label)}</strong>
                <p>{demandFieldTextZh(step.job)}</p>
              </div>
              {index < artifact.task_chain.length - 1 ? <ArrowRight aria-hidden size={20} /> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="section-stack">
        <div className="section-heading">
          <div><h2>同一人群的相邻产品机会</h2><p>先展示证据强弱和缺口，再决定是否开启独立研究。</p></div>
          <Search size={22} />
        </div>
        <div className="opportunity-list">
          {artifact.adjacent_opportunities.map((opportunity) => {
            const concept = opportunity.concept_marketing ?? buildConceptMessageArchitecture(artifact, opportunity);
            return (
            <article className={`opportunity ${opportunity.direct_product_evidence ? "recommended" : ""}`} key={opportunity.id}>
              <header>
                <div>
                  <div className="opportunity-tags">
                    {opportunity.relationship_types.map((relationship) => <span className="plain-badge" key={relationship}>{demandRelationshipZh(relationship)}</span>)}
                  </div>
                  <h3>{demandFieldTextZh(opportunity.title)}</h3>
                  <p>{demandFieldTextZh(opportunity.candidate_category)}</p>
                </div>
                <span className={opportunity.direct_product_evidence ? "status-badge" : "fixture-badge"}>
                  {opportunity.direct_product_evidence ? <CheckCircle2 size={14} /> : null}
                  {opportunity.direct_product_evidence ? "有直接商品证据" : "任务链假设"}
                </span>
              </header>
              <div className="grid cols-3 opportunity-evidence">
                <div><span>证据状态</span><strong>{demandStatusZh(opportunity.evidence_status)}</strong></div>
                <div><span>关系强度</span><strong>{demandStatusZh(opportunity.relationship_strength)}</strong></div>
                <div><span>下一步</span><strong>{demandStatusZh(opportunity.status)}</strong></div>
              </div>
              <p><strong>为什么值得研究：</strong>{demandFieldTextZh(opportunity.rationale)}</p>
              <p><strong>为什么尚未批准：</strong>{demandFieldTextZh(opportunity.why_not_approved)}</p>
              <div className="concept-message-architecture">
                <div className="section-heading">
                  <div>
                    <span className="fixture-badge">概念测试草案</span>
                    <small className="concept-value-label">核心价值主张</small>
                    <h4>{concept.valueProposition}</h4>
                  </div>
                  <FlaskConical size={20} />
                </div>
                <div className="concept-formula">
                  {concept.messagePillars.map((pillar) => (
                    <div key={pillar.id}>
                      <span>{demandStatusZh(pillar.evidenceStatus)}</span>
                      <strong>{pillar.productSellingPoint}</strong>
                      <ArrowRight size={14} />
                      <p>{pillar.customerBenefit}</p>
                      <p><b>场景：</b>{pillar.useScenario}</p>
                      <p><b>情绪价值：</b>{pillar.emotionalValue}</p>
                    </div>
                  ))}
                </div>
                <p><strong>一句话概念：</strong>{concept.oneSentenceConcept}</p>
                <p><strong>待验证：</strong>{concept.hypothesesToValidate.join("；")}</p>
                <p><strong>禁止表达：</strong>{concept.prohibitedClaims.map((item) => item.claim).join("；")}</p>
                {createResearchRunAction ? (
                  <form action={createResearchRunAction}>
                    <input type="hidden" name="opportunityId" value={opportunity.id} />
                    <button className="button" type="submit">创建独立调研任务</button>
                  </form>
                ) : null}
              </div>
              <details>
                <summary>查看下一轮研究关键词</summary>
                <ul className="list">{opportunity.next_research_queries.map((query) => <li className="mono" key={query}>{query}</li>)}</ul>
              </details>
            </article>
          )})}
        </div>
      </section>
    </>
  );
}
