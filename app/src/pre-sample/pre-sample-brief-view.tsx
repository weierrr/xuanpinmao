import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  PackageSearch,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { PreSampleDecisionBrief } from "./types";
import { productNameZh, statusZh, validationBudgetZh } from "../presentation/zh";
import { MarketingTranslationView } from "../marketing-translation/marketing-translation-view";

const List = ({ items }: Readonly<{ items: string[] }>) => (
  <ul className="list">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
);

export function PreSampleBriefView({ brief }: Readonly<{ brief: PreSampleDecisionBrief }>) {
  return (
    <>
      <div className="topbar">
        <div>
          <span className="plain-badge">买样前机会决策简报</span>
          <h1 className="title brief-title">{productNameZh(brief.product)}</h1>
          <p className="subtitle">目标市场：{brief.market}</p>
        </div>
        <Link className="audit-link" href={brief.advancedAuditUrls.research}><ExternalLink size={15} />高级审计视图</Link>
      </div>

      <section className={`brief-status state-${brief.status.toLowerCase().replaceAll("_", "-")}`}>
        <div>
          <span>当前阶段</span>
          <strong>买样前机会判断</strong>
        </div>
        <div>
          <span>阶段结论</span>
          <h2>{brief.statusLabel}</h2>
        </div>
        <p>{brief.scopeNotice}</p>
      </section>

      <section className={`brief-conclusion state-${brief.status.toLowerCase().replaceAll("_", "-")}`}>
        <span>一句话结论</span>
        <h2>{brief.conclusion}</h2>
      </section>

      {brief.status === "READY_FOR_SOURCING" ? (
        <>
      <section className="section-stack">
        <div className="section-heading"><div><h2>为什么值得或不值得继续</h2><p>只保留对买样决策最有价值的证据与不确定性。</p></div></div>
        <div className="brief-two-column">
          <div>
            <h3>用户是谁</h3>
            <List items={brief.whyContinue.users} />
            <h3>典型场景</h3>
            <List items={brief.whyContinue.scenarios} />
            <h3>核心痛点</h3>
            <List items={brief.whyContinue.painPoints} />
            <h3>当前替代方案及缺口</h3>
            <List items={brief.whyContinue.currentAlternatives} />
          </div>
          <div>
            <h3>竞品为什么能卖</h3>
            <List items={brief.whyContinue.competitorReasons} />
            <h3>机会成立的关键依据</h3>
            <List items={brief.whyContinue.opportunityEvidence} />
            <h3>最大不确定性</h3>
            <List items={brief.whyContinue.majorUnknowns} />
          </div>
        </div>
      </section>

      <section className="section-stack recommendation-panel">
        <div className="recommendation-icon"><PackageSearch size={22} /></div>
        <div>
          <span>推荐产品方向</span>
          <h2>{brief.recommendation.title}</h2>
          <p><strong>目标用户：</strong>{brief.recommendation.targetCustomer}</p>
          <p><strong>核心场景：</strong>{brief.recommendation.targetScenario}</p>
          <p><strong>产品概念：</strong>{brief.recommendation.productConcept}</p>
          <p><strong>核心价值：</strong>{brief.recommendation.coreValue}</p>
          <p><strong>当前证据强度：</strong>{brief.recommendation.evidenceStrength}</p>
          <p>{brief.recommendation.whyFirst}</p>
          <h3>为什么其他方向暂不优先</h3>
          <List items={brief.recommendation.alternativesDeferred} />
        </div>
      </section>

      <div className="brief-two-column section-stack">
        <section className="brief-list-section must-have">
          <h2><CheckCircle2 size={20} />产品必须具备</h2>
          <List items={brief.mustHave} />
        </section>
        <section className="brief-list-section next-stage">
          <h2><FileCheck2 size={20} />进入下一阶段前必须完成</h2>
          <List items={brief.nextStageRequirements} />
        </section>
      </div>

      <section className="section-stack">
        <h2><ShieldAlert size={20} />明确不能做</h2>
        <div className="brief-three-column">
          <div className="prohibition-group"><h3>产品结构与范围</h3><List items={brief.mustNotHave.productScope} /></div>
          <div className="prohibition-group"><h3>营销声明</h3><List items={brief.mustNotHave.marketingClaims} /></div>
          <div className="prohibition-group"><h3>证据与供应链</h3><List items={brief.mustNotHave.evidenceAndSupplyChain} /></div>
        </div>
      </section>

      <section className="section-stack">
        <h2>供应链交接简报</h2>
        <div className="handoff-flow">
          <div><span>寻找方向</span><strong>{brief.recommendation.title}</strong></div>
          <ArrowRight size={18} />
          <div><span>候选样品范围</span><strong>{brief.supplierHandoff.sampleScope}</strong></div>
          <ArrowRight size={18} />
          <div><span>下一关</span><strong>实物、资料与正式报价验证</strong></div>
        </div>
        <div className="brief-two-column handoff-details">
          <div>
            <h3>核心结构和材料方向</h3>
            <List items={brief.supplierHandoff.structureAndMaterialDirections} />
            <h3>需要供应商书面确认</h3>
            <List items={brief.supplierHandoff.supplierConfirmations} />
          </div>
          <div>
            <h3>需要索取的文件</h3>
            <List items={brief.supplierHandoff.requestedDocuments} />
            <h3>公开页面不能代替</h3>
            <List items={brief.supplierHandoff.publicPageLimitations} />
          </div>
        </div>
      </section>

      <section className="section-stack">
        <h2>供应商询盘清单</h2>
        <div className="inquiry-groups">
          {brief.supplierInquiryGroups.map((group) => (
            <div className="inquiry-group" key={group.title}>
              <h3>{group.title}</h3>
              <ol>{group.questionsZh.map((item) => <li key={item}>{item}</li>)}</ol>
            </div>
          ))}
        </div>
      </section>

      <section className="section-stack">
        <h2>样品与市场验证计划</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>测试名称</th><th>怎么做与范围</th><th>预算上限</th><th>通过标准</th><th>失败标准</th><th>停止条件</th></tr></thead>
            <tbody>{brief.validationSteps.map((item) => (
              <tr key={item.internalType}>
                <td><strong>{item.name}</strong><br /><small>{item.durationDays} 天</small></td>
                <td>{item.method}<br /><small>{item.scope}</small></td>
                <td>{validationBudgetZh(item.internalType)}</td>
                <td>{item.pass}</td>
                <td>{item.fail}</td>
                <td>{item.stop}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <div className="brief-two-column section-stack">
        <section className="budget-panel">
          <span>建议验证预算上限</span>
          <strong>{brief.estimatedValidationBudget.label}</strong>
          <h3>{brief.estimatedValidationBudget.budgetFitLabel}</h3>
          <p>{brief.estimatedValidationBudget.note}</p>
        </section>
        <section className="stop-panel">
          <h2>立即停止条件</h2>
          {brief.stopConditionGroups.map((group) => (
            <div key={group.title}><h3>{group.title}</h3><List items={group.conditions} /></div>
          ))}
        </section>
      </div>
        </>
      ) : brief.status === "RESEARCH_MORE" && brief.researchMore ? (
        <>
          <section className="section-stack state-focus-panel research-more-panel">
            <div className="recommendation-icon"><Search size={22} /></div>
            <div>
              <span>当前可能存在的机会</span>
              <p>以下内容仅为待验证假设，不是采购建议。</p>
              <List items={brief.researchMore.possibleOpportunities} />
            </div>
          </section>

          <section className="section-stack">
            <h2>关键缺失证据</h2>
            <List items={brief.researchMore.keyMissingEvidence} />
          </section>

          <section className="section-stack">
            <h2>下一轮研究计划</h2>
            <div className="research-plan-grid">
              {brief.researchMore.researchPlan.map((item) => (
                <article key={item.question}>
                  <h3>{item.question}</h3>
                  <p><strong>建议来源：</strong>{item.suggestedSources.join("；")}</p>
                  <p><strong>研究预算上限：</strong>{item.budgetCap}</p>
                  <p><strong>通过：</strong>{item.pass}</p>
                  <p><strong>失败：</strong>{item.fail}</p>
                  <p><strong>停止：</strong>{item.stop}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="brief-two-column section-stack">
            <section className="brief-list-section next-stage">
              <h2><CheckCircle2 size={20} />升级条件</h2>
              <p>只有满足以下条件后，才可以进入供应商候选研究与受控买样阶段。</p>
              <List items={brief.researchMore.upgradeConditions} />
            </section>
            <section className="brief-list-section must-not">
              <h2><ShieldAlert size={20} />当前不建议投入</h2>
              <List items={brief.researchMore.doNotInvest} />
            </section>
          </div>
        </>
      ) : brief.status === "NOT_WORTH_PURSUING" && brief.notWorthPursuing ? (
        <>
          <section className="section-stack state-focus-panel not-worth-panel">
            <div className="recommendation-icon"><XCircle size={22} /></div>
            <div>
              <span>停止原因</span>
              <List items={brief.notWorthPursuing.stopReasons} />
            </div>
          </section>

          <section className="section-stack">
            <h2>支持证据</h2>
            <List items={brief.notWorthPursuing.supportingEvidence} />
          </section>

          <div className="brief-two-column section-stack">
            <section className="brief-list-section">
              <h2>为什么不是继续补证</h2>
              <List items={brief.notWorthPursuing.whyNotMoreResearch} />
            </section>
            <section className="brief-list-section next-stage">
              <h2>重新评估条件</h2>
              <List items={brief.notWorthPursuing.reassessmentConditions} />
            </section>
          </div>

          <section className="brief-list-section must-not section-stack">
            <h2><ShieldAlert size={20} />当前不建议投入</h2>
            <List items={brief.notWorthPursuing.doNotInvest} />
          </section>
        </>
      ) : null}

      {brief.marketingTranslation
        ? <MarketingTranslationView translation={brief.marketingTranslation} showEvidenceIds={false} />
        : null}

      <section className="section-stack">
        <div className="section-heading">
          <div><h2>用户之声证据</h2><p>评论级观察与文档来源、结论分开统计；计数只描述当前有界语料。</p></div>
          <span className="plain-badge">{statusZh(brief.voiceOfCustomer.confidence.toLowerCase())}</span>
        </div>
        <div className="evidence-metrics">
          <div><span>有效观察</span><strong>{brief.voiceOfCustomer.validObservations}</strong></div>
          <div><span>负面或中性</span><strong>{brief.voiceOfCustomer.negativeOrNeutral}</strong></div>
          <div><span>正向或反证</span><strong>{brief.voiceOfCustomer.positiveOrCounterevidence}</strong></div>
          <div><span>来源族</span><strong>{brief.voiceOfCustomer.sourceFamilyCount}</strong></div>
        </div>
        <p>{brief.voiceOfCustomer.confidenceRationale}</p>
        <p><strong>分母：</strong>{brief.voiceOfCustomer.denominatorDefinition}</p>
        <div className="brief-two-column">
          <div>
            <h3>主要痛点</h3>
            <ul className="list">
              {brief.voiceOfCustomer.topPainPoints.map((item) => (
                <li key={item.theme}><strong>{item.theme}</strong>：{item.count}/{item.denominator} · {item.sourceFamilies.join("、")} · {item.scopeNote}</li>
              ))}
            </ul>
            <h3>期望结果与做法</h3>
            <List items={brief.voiceOfCustomer.desiredOutcomes} />
          </div>
          <div>
            <h3>正向证据与反证</h3>
            <List items={brief.voiceOfCustomer.counterevidence} />
            <h3>代表性短摘录</h3>
            <ul className="list">
              {brief.voiceOfCustomer.representativeExcerpts.map((item) => (
                <li key={`${item.url}-${item.theme}`}><a href={item.url} target="_blank" rel="noreferrer">{item.theme}</a>：{item.excerpt}</li>
              ))}
            </ul>
          </div>
        </div>
        <h3>阻塞项与限制</h3>
        <List items={[...new Set([...brief.voiceOfCustomer.blockers, ...brief.voiceOfCustomer.limitations])]} />
        <p><strong>亚马逊评论级证据：</strong>{brief.voiceOfCustomer.amazonCommentLevelEvidence ? "已取得" : "未取得"}</p>
      </section>

      <section className="section-stack">
        <div className="section-heading">
          <div><h2>证据信任摘要</h2><p>默认只显示可信度概览，内部映射保留在高级审计视图。</p></div>
          <Link className="audit-link" href={brief.advancedAuditUrls.firstPrinciples}>查看高级审计信息</Link>
        </div>
        <div className="evidence-metrics">
          <div><span>来源总数</span><strong>{brief.evidenceTrust.sourceCount}</strong></div>
          <div><span>已验证</span><strong>{brief.evidenceTrust.verifiedCount}</strong></div>
          <div><span>待复核</span><strong>{brief.evidenceTrust.needsReviewCount}</strong></div>
          <div><span>未解决问题</span><strong>{brief.evidenceTrust.unresolvedCount}</strong></div>
        </div>
        <div className="trust-explanations">
          <p>{brief.evidenceTrust.verifiedExplanation}</p>
          <p>{brief.evidenceTrust.needsReviewExplanation}</p>
        </div>
        <div className="source-list">
          {brief.evidenceTrust.sources.map((source) => (
            <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
              <span>{source.title}</span><small>{source.statusLabel}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="section-stack decision-scope">
        <h2>当前决策边界</h2>
        <div><span>正式采购</span><strong>{brief.decisionBoundaries.formalPurchase}</strong></div>
        <div><span>供应商可靠性</span><strong>{brief.decisionBoundaries.supplierReliability}</strong></div>
        <div><span>商品上架</span><strong>{brief.decisionBoundaries.listing}</strong></div>
        <div><span>广告测试</span><strong>{brief.decisionBoundaries.adTest}</strong></div>
      </section>
    </>
  );
}
