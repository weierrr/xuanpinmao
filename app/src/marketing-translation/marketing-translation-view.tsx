import { Ban, CheckCircle2, FlaskConical, Megaphone } from "lucide-react";
import type { MarketingTranslation } from "./types";
import { demandStatusZh } from "../demand-field/presentation";

const usageLabel = (status: MarketingTranslation["status"]) =>
  status === "ready_for_use" ? "可使用" : "待验证草案";

const decisionRoleLabel = {
  hook: "Hook · 为什么停下来",
  promise: "Promise · 想象什么改变",
  proof: "Proof · 为什么相信",
  offer: "Offer · 为什么敢尝试",
  cta: "CTA · 下一步做什么",
} as const;

export function MarketingTranslationView({
  translation,
  showEvidenceIds = true,
}: Readonly<{
  translation: MarketingTranslation;
  showEvidenceIds?: boolean;
}>) {
  return (
    <>
      <section className={`callout ${translation.status === "ready_for_use" ? "" : "opportunity-boundary"}`}>
        <strong>当前文案状态：{usageLabel(translation.status)}</strong>
        <p>{translation.status === "ready_for_use"
          ? "相关证据与动作权限已通过，仍需按最终渠道版本留存审核记录。"
          : "Listing 或广告权限尚未全部开放，以下内容只能用于概念测试和 Claim 验证。"}</p>
      </section>

      <section className="section-stack">
        <div className="section-heading">
          <div><h2>一句话价值主张</h2><p>{translation.valueProposition}</p></div>
          <Megaphone size={22} />
        </div>
      </section>

      {translation.decisionChain ? (
        <section className="section-stack marketing-decision-chain">
          <div className="section-heading">
            <div><h2>心理链如何转成营销表达</h2><p>每一句话都保留来源心理节点，证据等级不能高于来源。</p></div>
          </div>
          <div className="marketing-decision-chain-grid">
            {translation.decisionChain.mappings.map((mapping) => (
              <article className="card" key={mapping.role}>
                <span className="plain-badge">{decisionRoleLabel[mapping.role]}</span>
                <p>{mapping.expression}</p>
                <small>{demandStatusZh(mapping.evidenceStatus)} · {mapping.sourceStageIds.join(" · ")}</small>
              </article>
            ))}
          </div>
          <p className="appendix-note">{translation.decisionChain.boundary}</p>
        </section>
      ) : null}

      <section className="section-stack">
        <h2>产品卖点到用户价值</h2>
        <div className="translation-table-wrap">
          <table className="translation-table">
            <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
            <thead><tr><th>产品卖点</th><th>用户利益</th><th>使用场景</th><th>情绪价值</th><th>营销话术</th><th>证据</th></tr></thead>
            <tbody>{translation.messagePillars.map((pillar) => (
              <tr key={pillar.id}>
                <td>{pillar.productSellingPoint}</td>
                <td>{pillar.customerBenefit}</td>
                <td>{pillar.useScenario}</td>
                <td>{pillar.emotionalValue}</td>
                <td>{pillar.marketingCopy}</td>
                <td><span className="plain-badge">{demandStatusZh(pillar.evidenceStatus)}</span>{showEvidenceIds ? <small>{pillar.evidenceRefs.map((ref) => `${ref.objectType}:${ref.id}`).join(" · ")}</small> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="section-stack">
        <h2>渠道话术草案</h2>
        <div className="grid cols-2">
          <article className="card"><span className="fixture-badge">{usageLabel(translation.channelDrafts.listingTitle.status)}</span><h3>Listing 标题</h3><p>{translation.channelDrafts.listingTitle.text}</p></article>
          <article className="card"><span className="fixture-badge">{usageLabel(translation.channelDrafts.hero.status)}</span><h3>独立站首屏</h3><p><strong>{translation.channelDrafts.hero.headline}</strong></p><p>{translation.channelDrafts.hero.subheadline}</p></article>
          <article className="card"><h3>广告角度</h3><ol className="list">{translation.channelDrafts.adAngles.map((item) => <li key={item.text}>{item.text}</li>)}</ol></article>
          <article className="card"><h3>内容钩子</h3><ol className="list">{translation.channelDrafts.contentHooks.map((item) => <li key={item.text}>{item.text}</li>)}</ol></article>
        </div>
      </section>

      <section className="section-stack">
        <h2>异议、非目标与使用边界</h2>
        <div className="grid cols-2">
          <article className="card"><h3>关键异议</h3>{translation.objections.map((item) => <p key={item.objection}><strong>{item.objection}</strong><br />{item.responseDirection}</p>)}</article>
          <article className="card"><h3>明确不做</h3><ul className="list">{translation.nonGoals.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
        <div className="must-not marketing-prohibited">
          <h3><Ban size={18} />禁用 Claim</h3>
          <ul>{translation.prohibitedClaims.map((item) => <li key={`${item.category}-${item.claim}`}><strong>{item.claim}</strong>：{item.reason}</li>)}</ul>
        </div>
      </section>

      <section className="section-stack">
        <div className="section-heading"><div><h2>营销验证闭环</h2><p>通过不自动开放上线权限，结果仍需回写对应证据对象。</p></div><FlaskConical size={22} /></div>
        <div className="experiment-list">
          {translation.validationExperiments.map((experiment) => (
            <article className="card" key={experiment.id}>
              <span className="plain-badge">{experiment.id}</span>
              <h3>{experiment.name}</h3>
              <p><strong>关键假设：</strong>{experiment.keyHypothesis}</p>
              <p><strong>表达：</strong>{experiment.marketingExpression}</p>
              <p><strong>人群 / 指标：</strong>{experiment.targetAudience} / {experiment.metric}</p>
              <p><CheckCircle2 size={14} /> <strong>通过：</strong>{experiment.passThreshold}</p>
              <p><Ban size={14} /> <strong>失败：</strong>{experiment.failThreshold}</p>
              <p><strong>停止：</strong>{experiment.stopCondition}</p>
              <p><strong>下一步：</strong>{experiment.nextIfPass}；失败则 {experiment.nextIfFail}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
