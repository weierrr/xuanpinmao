import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Calculator,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Lightbulb,
  MessagesSquare,
  Quote,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";
import { productNameZh } from "@/presentation/zh";
import { BarList, DecisionChain, PriceAxis, ScoreMeter, SentimentSplit, ValidationTimeline } from "./charts";
import { ReportNav } from "./report-nav";
import { chapterIcons } from "./chapter-icons";
import { type ReportChapterMeta, type ReportEvidenceLineage, type RunReport } from "./types";
import { competitorBenchmarksFor } from "./competitor-benchmarks";
import { competitorAdvertisingAuditFor } from "./competitor-advertising-audit";
import { visualShapingOpportunityFor } from "./visual-shaping-opportunity";
import { marketingPillarCopyZh, mergedNextStageChecklistZh, platformFromUrl, reportTextZh } from "./report-copy";
import type { ConclusionTopic } from "../conclusion-governance/types";
import { buildDiscoveryNetworkFromReports } from "../discovery-network/builder";
import { ReportDiscoveryNetwork } from "../discovery-network/report-discovery-network";
import { ReportOpportunityValidationRoadmap } from "../opportunity-validation/report-opportunity-validation-roadmap";
import { ReportUnifiedActionQueue } from "../action-priority/report-unified-action-queue";
import { ReportValidationExecutionLedger } from "../validation-execution/report-validation-execution-ledger";
import { sellerDecisionFor } from "../seller-decision/service";
import { ReportSellerDecisionCard } from "../seller-decision/report-seller-decision-card";
import { sourcingStarterFor } from "../sourcing-guidance/service";
import { ReportSourcingStarter } from "../sourcing-guidance/report-sourcing-starter";
import { buildCandidateVerificationWorkspace } from "../candidate-verification/service";
import {
  ReportCandidateVerification,
  ReportCreativeReferenceLibrary,
} from "../candidate-verification/report-candidate-verification";

const List = ({ items }: Readonly<{ items: readonly string[] }>) => (
  // Research artifacts legitimately repeat a line across groups, so the index
  // is the only stable key here.
  <ul className="list">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
);

const Chapter = ({
  meta,
  preview,
  children,
}: Readonly<{
  meta: ReportChapterMeta;
  preview?: string;
  children: React.ReactNode;
}>) => {
  const Icon = chapterIcons[meta.id];
  const isResearchProcess = ["market", "competitors", "customers"].includes(meta.id);

  if (isResearchProcess) {
    return (
      <details className={`report-evidence-chapter report-chapter-${meta.id}`} id={`chapter-${meta.id}`}>
        <summary>
          <span className="report-evidence-chapter-index">{meta.index}</span>
          <span className="report-evidence-chapter-icon"><Icon size={19} strokeWidth={1.8} /></span>
          <div className="report-evidence-chapter-copy">
            <strong>{meta.label}</strong>
            <small>{meta.question}</small>
            {preview ? <p className="report-evidence-chapter-preview">{preview}</p> : null}
          </div>
        </summary>
        <div className="report-evidence-chapter-content">{children}</div>
      </details>
    );
  }

  return (
    <section className={`report-chapter report-chapter-${meta.id}`} id={`chapter-${meta.id}`}>
      <div className="report-chapter-head">
        <span className="report-chapter-index">{meta.index}</span>
        <span className="report-chapter-icon"><Icon size={22} strokeWidth={1.8} /></span>
        <div>
          <h2>{meta.label}</h2>
          <p>{meta.question}</p>
        </div>
      </div>
      {children}
    </section>
  );
};

const testTypeLabels: Record<string, string> = {
  concept_test: "概念测试",
  supplier_validation: "供应商验证",
  sample_test: "样品测试",
  pricing_test: "定价测试",
  content_test: "内容测试",
  organic_demand_test: "自然需求测试",
  unit_economics_check: "单位经济核算",
};

const strengthLabels: Record<string, string> = { high: "高", medium: "中", low: "低" };

const evidenceStatusLabels: Record<string, string> = {
  supported: "已有证据支持",
  directional: "方向性证据",
  hypothesis: "待验证假设",
  prohibited: "禁止使用",
};

const trendAcquisitionLabels: Record<string, string> = {
  yielded_sources: "已取得可核查数据",
  no_relevant_results: "未取得相关数据",
  blocked: "本次获取受阻",
  not_executed: "结果未记录",
};

const usageStatusLabels: Record<string, string> = {
  draft_for_validation: "待验证草稿，不可直接上架使用",
  ready_for_use: "可使用",
};

const marketingDecisionRoleLabels = {
  hook: { code: "HOOK", label: "让用户停下来", source: "场景触发 / 心理张力" },
  promise: { code: "PROMISE", label: "让用户想象改变", source: "理想自我 / 结果想象" },
  proof: { code: "PROOF", label: "让用户形成信任", source: "信任形成" },
  offer: { code: "OFFER", label: "让用户降低风险", source: "风险消除" },
  cta: { code: "CTA", label: "让用户采取下一步", source: "最低成本行动" },
} as const;

const reportValueOutcomes = [
  {
    chapterId: "summary",
    number: "01",
    title: "先判断值不值得继续",
    detail: "一分钟看清当前结论、关键未知和允许动作。",
  },
  {
    chapterId: "positioning",
    number: "02",
    title: "明确产品应该做成什么样",
    detail: "得到目标用户、产品方向、差异化与相邻机会。",
  },
  {
    chapterId: "marketing",
    number: "03",
    title: "知道产品应该怎么卖",
    detail: "得到营销转译、消息支柱，以及可说与不可说的 Claim。",
  },
  {
    chapterId: "validation",
    number: "04",
    title: "拿到下一步行动方案",
    detail: "得到实验、预算、周期、通过标准与当前行动边界。",
  },
] as const;

const readerChapterCopy = {
  summary: { index: 1, label: "1分钟判断", question: "这个品能不能卖，机会在哪里" },
  market: { index: 2, label: "市场与机会", question: "需求是否真实，市场还有没有空间" },
  customers: { index: 3, label: "用户画像", question: "谁会买，为什么买，最在意什么" },
  competitors: { index: 4, label: "竞品分析", question: "别人靠什么卖，还有什么没有解决" },
  positioning: { index: 5, label: "产品", question: "应该做给谁、做成什么样" },
  marketing: { index: 6, label: "营销", question: "用户为什么会买、应该怎么表达" },
  validation: { index: 7, label: "验证", question: "下一步做什么、什么情况下停止" },
} as const;

type ReaderChapterId = keyof typeof readerChapterCopy;

const readerChapter = (id: ReaderChapterId): ReportChapterMeta => ({
  id,
  ...readerChapterCopy[id],
});

const readerChapters = (Object.keys(readerChapterCopy) as ReaderChapterId[]).map(readerChapter);

const reportMethodSteps = [
  {
    chapterId: "market",
    title: "市场信号",
    detail: "需求、趋势、竞争与变现",
  },
  {
    chapterId: "competitors",
    title: "竞品打法",
    detail: "定位、价格与成交理由",
  },
  {
    chapterId: "customers",
    title: "用户原声",
    detail: "VoC、场景、痛点与任务链",
  },
  {
    chapterId: "positioning",
    title: "机会推导",
    detail: "产品方向与相邻机会",
  },
  {
    chapterId: "boundary",
    title: "验证收口",
    detail: "成本、合规与行动边界",
  },
] as const;

const ReportLogicMap = () => (
  <aside className="report-logic-map" aria-labelledby="report-logic-title">
    <div className="report-logic-head">
      <div>
        <span className="report-logic-kicker">WHAT YOU WILL GET</span>
        <h3 id="report-logic-title">先看 4 个最终答案，再展开 3 组关键依据</h3>
      </div>
      <p>结论、产品、营销和验证负责指导行动；市场、用户和竞品负责解释为什么。</p>
    </div>
    <ol className="report-value-grid">
      {reportValueOutcomes.map((outcome) => {
        const Icon = chapterIcons[outcome.chapterId];
        return (
          <li key={outcome.chapterId}>
            <a className="report-value-card" href={`#chapter-${outcome.chapterId}`}>
              <span className="report-value-card-top">
                <span className="report-value-number">{outcome.number}</span>
                <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <strong>{outcome.title}</strong>
              <p>{outcome.detail}</p>
              <span className="report-value-link">查看对应分析 <ArrowRight size={14} aria-hidden="true" /></span>
            </a>
          </li>
        );
      })}
    </ol>
  </aside>
);

const ReportResearchMethod = () => (
  <div className="report-method report-method-in-appendix">
    <div className="report-method-head">
      <span>结论是怎么得出的？</span>
      <p>需要复核时，再按研究视角展开</p>
    </div>
    <div className="report-method-scroll">
      <ol className="report-method-track">
        {reportMethodSteps.map((step) => {
          const Icon = chapterIcons[step.chapterId];
          return (
            <li key={step.chapterId}>
              <a className="report-method-step" href={`#chapter-${step.chapterId}`}>
                <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
                <ArrowRight className="report-method-arrow" size={15} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  </div>
);

const EvidenceLineageNotice = ({ lineage }: Readonly<{ lineage: ReportEvidenceLineage }>) => (
  <aside className="report-lineage" aria-labelledby="report-lineage-title">
    <div className="report-lineage-head">
      <div>
        <span>资料基础</span>
        <h3 id="report-lineage-title">
          本报告综合 {lineage.primary.observationCount} 条多渠道反馈与 {lineage.audit.observationCount} 条最新核查反馈
        </h3>
      </div>
      <p>所有章节只呈现合并后的当前结论，不需要读者在两套资料之间自行选择。</p>
    </div>

    <p className="report-lineage-explanation">
      <MessagesSquare size={17} />
      <span>
        多渠道反馈负责识别用户需求、痛点与产品机会；最新反馈和检索负责检查这些判断现在是否仍然可靠。
        两部分资料已经在全文中合并，不形成两套并列结论。
      </span>
    </p>

    <dl className="report-lineage-metrics">
      <div><dt>用户洞察反馈</dt><dd>{lineage.primary.observationCount}</dd><small>覆盖 {lineage.primary.platformCount} 个平台</small></div>
      <div><dt>最新核查反馈</dt><dd>{lineage.audit.observationCount}</dd><small>补充当前有效性</small></div>
      <div><dt>最新实际检索</dt><dd>{lineage.audit.searchQueryCount}</dd><small>包括无结果与受阻记录</small></div>
      <div><dt>核查反馈带日期</dt><dd>{lineage.audit.datedObservationCount}/{lineage.audit.observationCount}</dd><small>用于判断信息新旧</small></div>
    </dl>

    <details className="report-lineage-details">
      <summary>查看资料范围与时间边界</summary>
      <div>
        <section>
          <h4>用户洞察资料</h4>
          <p>{lineage.primary.researchSourceCount} 个研究来源、{lineage.primary.observationCount} 条反馈、{lineage.primary.platformCount} 个平台。</p>
          <small>其中带原始发布日期的反馈：{lineage.primary.datedObservationCount}/{lineage.primary.observationCount}。</small>
        </section>
        <section>
          <h4>最新有效性核查</h4>
          <p>{lineage.audit.researchSourceCount} 个核查来源、{lineage.audit.searchQueryCount} 次检索、{lineage.audit.observationCount} 条反馈。</p>
          <small>其中带原始发布日期的反馈：{lineage.audit.datedObservationCount}/{lineage.audit.observationCount}。</small>
        </section>
      </div>
      <p className="report-lineage-boundary"><AlertTriangle size={16} />{lineage.boundary}</p>
    </details>
  </aside>
);

const viabilityGateLabels = {
  positive: "已跨门槛",
  directional: "方向信号",
  blocked: "决定性缺口",
  failed: "不成立",
} as const;

const CommercialViabilityCard = ({
  card,
}: Readonly<{ card: NonNullable<RunReport["commercialViability"]> }>) => (
  <section className={`report-commercial-card decision-${card.decision.toLowerCase()}`} aria-labelledby="commercial-viability-title">
    <header className="report-commercial-head">
      <div>
        <span>商业可行性门禁</span>
        <h3 id="commercial-viability-title">商业可行性决策卡</h3>
        <p>{card.summary}</p>
      </div>
      <div className="report-commercial-decision">
        <small>当前决策</small>
        <strong>{card.decisionLabel}</strong>
        <span>{card.commercialViabilityProven ? "商业成立已证明" : "商业成立尚未证明"}</span>
      </div>
    </header>

    <div className="report-commercial-coverage">
      <strong>{card.evidenceCoverage.assessedDimensions}/{card.evidenceCoverage.totalDimensions}</strong>
      <span>维度已有评分</span>
      <p>这不是平均分。供应、单位经济等决定性维度未评分时，系统必须停止给出商业成立结论。</p>
    </div>

    <ol className="report-commercial-dimensions">
      {card.dimensions.map((dimension) => (
        <li className={dimension.gateStatus} key={dimension.key}>
          <div className="report-commercial-dimension-top">
            <span>{dimension.label}</span>
            <strong>{dimension.score === null ? "未评分" : `${dimension.score}/100`}</strong>
          </div>
          <em>{viabilityGateLabels[dimension.gateStatus]}</em>
          <p>{dimension.conclusion}</p>
          <details>
            <summary>依据与下一步</summary>
            <p>{dimension.rationale}</p>
            {dimension.blocker ? <p><strong>缺口：</strong>{dimension.blocker}</p> : null}
            <p><strong>下一步：</strong>{dimension.nextAction}</p>
          </details>
        </li>
      ))}
    </ol>

    <div className="report-commercial-actions">
      <article>
        <h4><CheckCircle2 size={16} />当前允许</h4>
        <List items={card.allowedActions} />
      </article>
      <article>
        <h4><Ban size={16} />当前禁止</h4>
        <List items={card.blockedActions} />
      </article>
      <article>
        <h4><Target size={16} />下一道门槛</h4>
        <List items={mergedNextStageChecklistZh([], card.nextGateConditions)} />
      </article>
    </div>

    <p className="report-commercial-boundary"><ShieldAlert size={15} />{card.boundary}</p>
  </section>
);

const estimatedEconomicsStatusLabels = {
  workable: "存在规划空间",
  tight: "成本空间偏紧",
  not_workable: "当前参数不成立",
} as const;

const EstimatedUnitEconomicsCard = ({
  model,
}: Readonly<{ model: NonNullable<RunReport["estimatedUnitEconomics"]> }>) => {
  const base = model.scenarios.find((scenario) => scenario.key === model.baseScenarioKey) ?? model.scenarios[1];
  return (
    <section className="report-estimated-economics" aria-labelledby="estimated-unit-economics-title">
      <header className="report-estimated-economics-head">
        <div>
          <span>假设情景示例 · 成本红线反推</span>
          <h3 id="estimated-unit-economics-title">这单生意最多能承受多少成本？</h3>
          <p>{model.summary}</p>
        </div>
        <div className="report-estimated-economics-status">
          <Calculator size={18} />
          <div><strong>假设情景示例</strong><span>接入真实数据前仅供规划</span></div>
        </div>
      </header>

      <div className="report-cost-ceiling">
        <div>
          <span>基准情景 · 总落地成本红线</span>
          <strong>{model.currencySymbol}{base.allowableLandedCost}<small className="report-value-provenance">推导值</small></strong>
          <p>根据假设售价、规划 CPA 上限和目标贡献利润反推，不代表当前产品的真实成本。</p>
        </div>
        <div className="report-cost-ceiling-ruler" aria-label={`总落地成本最多占售价 ${Math.round(base.allowableLandedCostRate * 100)}%`}>
          <span style={{ width: `${Math.max(0, Math.min(100, base.allowableLandedCostRate * 100))}%` }} />
          <b>{Math.round(base.allowableLandedCostRate * 100)}% 售价<small className="report-value-provenance">推导值</small></b>
        </div>
      </div>

      <p className="report-estimated-economics-formula">{model.formula}</p>

      <div className="report-estimated-scenarios">
        {model.scenarios.map((scenario) => (
          <article key={scenario.key} data-status={scenario.status} className={scenario.key === model.baseScenarioKey ? "is-base" : undefined}>
            <header>
              <div><span>{scenario.label}</span><strong>售价 {model.currencySymbol}{scenario.price}<small className="report-value-provenance">推导值</small></strong></div>
              <em>{estimatedEconomicsStatusLabels[scenario.status]}</em>
            </header>
            <dl>
              <div><dt>支付费用</dt><dd>{model.currencySymbol}{scenario.paymentCost}<small className="report-value-provenance">推导值</small></dd></div>
              <div><dt>风险准备金</dt><dd>{model.currencySymbol}{scenario.riskReserve}<small className="report-value-provenance">推导值</small></dd></div>
              <div><dt>规划 CPA 上限</dt><dd>{model.currencySymbol}{scenario.plannedCpaCap}<small className="report-value-provenance">推导值</small></dd></div>
              <div><dt>目标贡献利润</dt><dd>{model.currencySymbol}{scenario.targetContribution}<small className="report-value-provenance">推导值</small></dd></div>
            </dl>
            <div className="report-estimated-scenario-result">
              <span>可承受总落地成本</span>
              <strong>{model.currencySymbol}{scenario.allowableLandedCost}<small className="report-value-provenance">推导值</small></strong>
            </div>
            <p>{scenario.interpretation}</p>
          </article>
        ))}
      </div>

      <div className="report-estimated-economics-lower">
        <section>
          <header><span>最敏感的变量</span><strong>每项单独变化</strong></header>
          <div className="report-estimated-sensitivities">
            {model.sensitivities.map((item) => (
              <article key={item.key}>
                <span>{item.label}</span>
                <strong>{item.change}<small className="report-value-provenance is-assumption">假设变化</small></strong>
                <b>{item.impactOnAllowableLandedCost < 0 ? "-" : "+"}{model.currencySymbol}{Math.abs(item.impactOnAllowableLandedCost)}<small className="report-value-provenance">推导值</small></b>
                <p>{item.interpretation}</p>
              </article>
            ))}
          </div>
        </section>

        <aside>
          <span>正式成本完整度</span>
          <strong>{model.inputCoverage.knownCostFieldCount}/{model.inputCoverage.totalCostFieldCount}<small className="report-value-provenance is-record">当前记录</small></strong>
          <p>当前已知 {model.inputCoverage.knownCostFieldCount}/{model.inputCoverage.totalCostFieldCount} 个正式成本字段。预估模型不会把未知项填成 0，也不会解除单位经济门禁。</p>
          <details>
            <summary>查看规划假设与下一步补证</summary>
            <div className="report-estimated-assumptions">
              {model.assumptions.map((assumption) => (
                <p key={assumption.key}><strong>{assumption.label} {assumption.formattedValue}<small className="report-value-provenance is-assumption">假设值</small></strong><span>{assumption.rationale}</span></p>
              ))}
            </div>
            <h4>转成正式单位经济前必须补齐</h4>
            <List items={model.nextEvidence} />
          </details>
        </aside>
      </div>

      <p className="report-estimated-economics-boundary"><ShieldAlert size={16} />{model.boundary}</p>
    </section>
  );
};

const secondCategoryCheckStatus = {
  pass: "通过",
  warning: "继续补齐",
  fail: "未通过",
} as const;

const SecondCategoryValidationCard = ({
  validation,
}: Readonly<{ validation: NonNullable<RunReport["secondCategoryValidation"]> }>) => (
  <section className={`report-second-category status-${validation.status}`} aria-labelledby="second-category-validation-title">
    <header className="report-second-category-head">
      <div>
        <span>第二品类验证 · {validation.candidateCategory}</span>
        <h3 id="second-category-validation-title">这套能力换一个品类还能不能成立？</h3>
        <p>{validation.summary}</p>
      </div>
      <div className="report-second-category-status">
        <strong>{validation.metrics.passedChecks}/{validation.metrics.totalChecks}</strong>
        <span>{validation.statusLabel}</span>
      </div>
    </header>

    <div className="report-second-category-metrics">
      <div><strong>{validation.metrics.coreCapabilitiesAvailable}/{validation.metrics.coreCapabilitiesTotal}</strong><span>核心能力可用</span></div>
      <div><strong>{validation.metrics.advancedCapabilitiesAvailable}/{validation.metrics.advancedCapabilitiesTotal}</strong><span>高级模块已覆盖</span></div>
      <div><strong>{validation.metrics.contaminationCount}</strong><span>品类污染项</span></div>
      <div><strong>{validation.metrics.distinctiveTermCount}</strong><span>独立品类事实</span></div>
    </div>

    <div className="report-second-category-checks">
      {validation.checks.map((check) => (
        <article key={check.key} data-status={check.status}>
          <header><span>{check.label}</span><em>{secondCategoryCheckStatus[check.status]}</em></header>
          <p>{check.conclusion}</p>
          <details>
            <summary>查看依据{check.nextAction ? "与下一步" : ""}</summary>
            <List items={check.evidence} />
            {check.nextAction ? <p><strong>下一步：</strong>{check.nextAction}</p> : null}
          </details>
        </article>
      ))}
    </div>

    <p className="report-second-category-boundary"><ShieldAlert size={16} />{validation.boundary}</p>
  </section>
);

export function ReportView({ report }: Readonly<{ report: RunReport }>) {
  const productName = productNameZh(report.product);
  const { summary } = report;
  const consumerPsychology = report.consumerPsychology;
  const conclusionGovernance = report.conclusionGovernance;
  const governedConclusion = (topic: ConclusionTopic) =>
    conclusionGovernance?.currentByTopic[topic]?.[0] ?? null;
  const governedText = (topic: ConclusionTopic, fallback: string): string =>
    governedConclusion(topic)?.statement ?? fallback;
  const recommendedScore = report.opportunities
    .find((item) => item.id === report.recommendedOpportunityId)?.score ?? null;
  const priceAnchors = [...report.priceAnchors, ...competitorBenchmarksFor(report.runId)]
    .sort((a, b) => a.current - b.current);
  const priceMarketStructure = report.priceMarketStructure;
  const priceOfferById = new Map(priceMarketStructure?.offers.map((offer) => [offer.id, offer]) ?? []);
  const advertisingAudit = competitorAdvertisingAuditFor(report.runId);
  const visualShapingOpportunity = visualShapingOpportunityFor(report.runId);
  const hasYogaSpecialization = advertisingAudit !== null || visualShapingOpportunity !== null;
  const currentRecommendedDirection = governedText(
    "product_direction",
    visualShapingOpportunity?.direction ?? summary.recommendedDirection ?? report.recommendation.title,
  );
  const currentCoreValue = governedText(
    "core_value",
    visualShapingOpportunity?.recommendation.coreValue ?? report.recommendation.coreValue,
  );
  const currentTargetCustomer = governedText(
    "target_customer",
    visualShapingOpportunity?.recommendation.targetCustomer ?? report.recommendation.targetCustomer,
  );
  const currentTargetScenario = governedText(
    "target_scenario",
    visualShapingOpportunity?.recommendation.targetScenario ?? report.recommendation.targetScenario,
  );
  const currentProductConcept = governedText(
    "product_concept",
    visualShapingOpportunity?.recommendation.productConcept ?? report.recommendation.productConcept,
  );
  const currentEvidenceStrength = governedText(
    "evidence_strength",
    visualShapingOpportunity?.recommendation.evidenceStrength ?? report.recommendation.evidenceStrength,
  );
  const currentRecommendationRationale = governedText(
    "recommendation_rationale",
    visualShapingOpportunity?.recommendation.whyFirst ?? summary.decisions.firstPrinciplesRecommendation,
  );
  const currentMarketingValue = governedText(
    "marketing_value_proposition",
    report.marketing?.valueProposition ?? "当前尚无营销价值主张",
  );
  const currentDecisionBoundary = governedConclusion("decision_boundary")?.statement ?? null;
  const reconciliationStages = conclusionGovernance
    ? ([
      { label: "让用户点进来", topic: "attention_driver" },
      { label: "让用户相信", topic: "belief_driver" },
      { label: "让用户敢下单", topic: "purchase_risk_reducer" },
    ] satisfies Array<{ label: string; topic: ConclusionTopic }>).flatMap(({ label, topic }) => {
      const conclusion = governedConclusion(topic);
      return conclusion ? [{ label, conclusion }] : [];
    })
    : advertisingAudit?.reconciliation.stages.map((stage) => ({
      label: stage.label,
      conclusion: {
        statement: stage.conclusion,
        claimBoundary: stage.evidenceScope,
      },
    })) ?? [];
  const primaryCompetitorName = hasYogaSpecialization ? "Ionix Sculpt 3D 塑形紧身裤" : "本次主要竞品样本";
  const ionixProductSource = report.appendix.evidence.sources.find((source) =>
    source.originalTitle.includes("Ionix Sculpt 3D"));
  const ionixBrandSource = report.appendix.evidence.sources.find((source) =>
    source.originalTitle === "Ionix Labs Homepage");
  const nextStageChecklist = mergedNextStageChecklistZh(report.nextStageRequirements, report.entryConditions);
  const discoveryNetwork = buildDiscoveryNetworkFromReports([report]);
  const sellerDecision = sellerDecisionFor(report.runId);
  const sourcingStarter = sourcingStarterFor(report.runId);
  const sellerEvidenceBasis = sellerDecision
    ? [
      {
        value: report.voice.validObservations.toLocaleString(),
        label: "条买家反馈",
        detail: report.voicePlatformCounts.map((item) => `${item.platform} ${item.count}`).join("、"),
      },
      {
        value: String(priceMarketStructure?.coverage.usableObservationCount ?? 0),
        label: "个在售价格",
        detail: "用来判断市场大致卖多少钱",
      },
      {
        value: String(advertisingAudit?.hooks.length ?? 0),
        label: "个重点竞品",
        detail: "Ionix、Silix的广告和商品页",
      },
    ]
    : [];
  const candidateWorkspace = visualShapingOpportunity
    ? buildCandidateVerificationWorkspace({
      runId: report.runId,
      direction: currentRecommendedDirection,
      productConcept: currentProductConcept,
      mustHave: report.mustHave,
      priceMarketStructure,
      advertisingAudit,
    })
    : null;

  return (
    <div className="report-view">
      <ReportNav
        chapters={readerChapters}
        backHref="/"
        title={productName}
        subtitle={`${report.market} 市场`}
      />

      <div className="report-body">
        {/* 0 - 结论摘要：全部由后续章节的字段汇总，不引入新结论。 */}
        <Chapter meta={readerChapter("summary")}>
          <ReportLogicMap />

          {sellerDecision ? (
            <>
              <ReportSellerDecisionCard card={sellerDecision} evidenceBasis={sellerEvidenceBasis} />
              {sourcingStarter ? <ReportSourcingStarter starter={sourcingStarter} /> : null}
              <details className="appendix-block report-summary-boundary-detail">
                <summary>哪些事情还没有被证明？</summary>
                <div className="report-summary-boundary-content">
                  <div className="summary-verdict">
                    <h3>{summary.conclusion}</h3>
                    <p className="scope-notice">{summary.scopeNotice}</p>
                  </div>
                  <DecisionChain
                    steps={[
                      { label: "当前推荐方向", value: currentRecommendedDirection, state: "pass" },
                      {
                        label: "商品方向决策",
                        value: summary.decisions.productSelection.label,
                        state: summary.decisions.productSelection.value === "PROCEED_TO_SAMPLE" ? "pass" : "hold",
                      },
                      {
                        label: "正式目标款决策",
                        value: summary.decisions.formalSku.label,
                        state: summary.decisions.formalSku.value === "GO" ? "pass" : "hold",
                      },
                    ]}
                  />
                  <p className="report-chain-rationale">
                    <Lightbulb size={15} />
                    {currentRecommendationRationale}
                  </p>
                  <div className="summary-boundary">
                    <div className={summary.listingAllowed ? "boundary-chip allowed" : "boundary-chip denied"}>
                      {summary.listingAllowed ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                      <span>上架{summary.listingAllowed ? "已允许" : "禁止"}</span>
                    </div>
                    <div className={summary.adTestAllowed ? "boundary-chip allowed" : "boundary-chip denied"}>
                      {summary.adTestAllowed ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                      <span>广告测试{summary.adTestAllowed ? "已允许" : "禁止"}</span>
                    </div>
                  </div>
                </div>
              </details>
            </>
          ) : (
            <>
              <div className="summary-verdict">
                <h3>{summary.conclusion}</h3>
                <p className="scope-notice">{summary.scopeNotice}</p>
              </div>
              <DecisionChain
                steps={[
                  { label: "当前推荐方向", value: currentRecommendedDirection, state: "pass" },
                  {
                    label: "商品方向决策",
                    value: summary.decisions.productSelection.label,
                    state: summary.decisions.productSelection.value === "PROCEED_TO_SAMPLE" ? "pass" : "hold",
                  },
                  {
                    label: "正式目标款决策",
                    value: summary.decisions.formalSku.label,
                    state: summary.decisions.formalSku.value === "GO" ? "pass" : "hold",
                  },
                ]}
              />
              <p className="report-chain-rationale">
                <Lightbulb size={15} />
                {currentRecommendationRationale}
              </p>
              <div className="summary-metrics">
                <div className="summary-metric">
                  <span>推荐方向</span>
                  <strong className="summary-metric-text">{currentRecommendedDirection}</strong>
                </div>
                <div className="summary-metric">
                  <span>下一步成本</span>
                  <strong className="summary-metric-text">
                    {summary.nextStepCost.experimentCount} 个实验 ·{" "}
                    {summary.nextStepCost.totalDurationDays} 天 ·{" "}
                    {summary.nextStepCost.budgetAmount === null
                      ? "预算未知"
                      : `${summary.nextStepCost.budgetCurrency} ${summary.nextStepCost.budgetAmount.toLocaleString()}`}
                  </strong>
                  <p>{report.validationBudget.budgetFitLabel}</p>
                </div>
              </div>
            </>
          )}

          {!sellerDecision && sourcingStarter ? <ReportSourcingStarter starter={sourcingStarter} /> : null}

          {!sellerDecision ? (
            <div className="summary-boundary">
              <div className={summary.listingAllowed ? "boundary-chip allowed" : "boundary-chip denied"}>
                {summary.listingAllowed ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                <span>上架{summary.listingAllowed ? "已允许" : "禁止"}</span>
              </div>
              <div className={summary.adTestAllowed ? "boundary-chip allowed" : "boundary-chip denied"}>
                {summary.adTestAllowed ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                <span>广告测试{summary.adTestAllowed ? "已允许" : "禁止"}</span>
              </div>
            </div>
          ) : null}

          <ReportUnifiedActionQueue queue={report.unifiedActionQueue} />

          {report.commercialViability ? (
            <details className="appendix-block report-summary-decision-detail">
              <summary>查看商业可行性判定依据</summary>
              <CommercialViabilityCard card={report.commercialViability} />
            </details>
          ) : null}

          {summary.criticalUnknowns.length > 0 && (
            <div className="card summary-unknowns">
              <h3><AlertTriangle size={18} />最关键的未知</h3>
              <List items={summary.criticalUnknowns} />
            </div>
          )}
        </Chapter>

        {/* 1 - 市场值不值得做 */}
        <Chapter
          meta={readerChapter("market")}
          preview={reportTextZh(report.marketChapter.verdict)}
        >
          <div className="report-market-panel">
            <ScoreMeter value={report.marketChapter.overall} label="市场机会总分" />
            <BarList
              caption="四个维度的评分"
              scaleNote="同一 0–100 标尺；评分来自本次研究的公开证据"
              max={100}
              data={report.marketChapter.scores.map((score) => ({
                label: score.label,
                value: score.score,
              }))}
            />
          </div>
          <details className="appendix-block report-score-explanation">
            <summary><CircleHelp size={18} />各项评分为什么是这个分数</summary>
            <div className="card">
              <h3>综合判断 {report.marketChapter.overall}/100</h3>
              <p>{reportTextZh(report.marketChapter.verdict)}</p>
              {report.marketChapter.scores.map((score) => (
                <p key={score.label}><strong>{score.label}</strong>：{reportTextZh(score.rationale)}</p>
              ))}
              {report.marketChapter.trendAcquisition && (
                <div className="report-data-acquisition">
                  <div>
                    <strong>Google Trends 数值</strong>
                    <span className={`report-query-outcome ${report.marketChapter.trendAcquisition.outcome}`}>
                      {trendAcquisitionLabels[report.marketChapter.trendAcquisition.outcome]}
                    </span>
                    <p>
                      已按美国市场、过去五年执行趋势查询；只有取得可复核的时间序列后，才能更新趋势判断。
                    </p>
                  </div>
                  <a
                    href={report.marketChapter.trendAcquisition.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开 Google Trends 重新获取<ExternalLink size={15} />
                  </a>
                </div>
              )}
            </div>
          </details>

          {priceMarketStructure && (
            <section className="report-price-structure" aria-labelledby="price-market-structure-title">
              <header className="report-price-structure-head">
                <div>
                  <span>通用价格带 · 公开报价结构</span>
                  <h3 id="price-market-structure-title">这个市场的价格是怎么分层的？</h3>
                  <p>只对当前已核查公开报价做结构化分层，不把商品数当销量，也不生成缺乏成交权重的“市场均价”。</p>
                </div>
                <div className="report-price-coverage" data-status={priceMarketStructure.coverage.status}>
                  <strong>{priceMarketStructure.coverage.usableObservationCount}</strong>
                  <span>个可比报价</span>
                  <em>{priceMarketStructure.coverage.label}</em>
                </div>
              </header>

              <div className="report-price-structure-metrics">
                <div>
                  <span>已观察区间</span>
                  <strong>{priceMarketStructure.currencySymbol}{priceMarketStructure.observedRange.low}–{priceMarketStructure.currencySymbol}{priceMarketStructure.observedRange.high}</strong>
                  <small>跨度 {priceMarketStructure.currencySymbol}{priceMarketStructure.observedRange.span}</small>
                </div>
                <div>
                  <span>样本中位价</span>
                  <strong>{priceMarketStructure.currencySymbol}{priceMarketStructure.observedRange.median}</strong>
                  <small>不是销量加权市场均价</small>
                </div>
                <div>
                  <span>价格形态</span>
                  <strong>{priceMarketStructure.shape.label}</strong>
                  <small>最高 / 最低约 {priceMarketStructure.observedRange.highToLowRatio}×</small>
                </div>
                <div>
                  <span>促销报价</span>
                  <strong>{priceMarketStructure.observedRange.discountedOfferCount}/{priceMarketStructure.coverage.usableObservationCount}</strong>
                  <small>{priceMarketStructure.observedRange.medianDiscountRate === null
                    ? "未形成可读折扣样本"
                    : `样本折扣中位数 ${Math.round(priceMarketStructure.observedRange.medianDiscountRate * 100)}%`}</small>
                </div>
              </div>

              {priceMarketStructure.bands.length > 0 ? (
                <div className="report-price-band-ladder">
                  {priceMarketStructure.bands.map((band) => (
                    <article key={band.key} data-band={band.key}>
                      <header>
                        <span>{band.label}</span>
                        <strong>{priceMarketStructure.currencySymbol}{band.observedLow}{band.observedHigh !== band.observedLow
                          ? `–${priceMarketStructure.currencySymbol}${band.observedHigh}`
                          : ""}</strong>
                      </header>
                      <div className="report-price-band-share" aria-label={`${band.observationCount} 个报价，占已观察商品 ${Math.round(band.shareOfObservedOffers * 100)}%`}>
                        <span style={{ width: `${band.shareOfObservedOffers * 100}%` }} />
                      </div>
                      <p>{band.interpretation}</p>
                      <ul>
                        {band.offerIds.map((offerId) => {
                          const offer = priceOfferById.get(offerId);
                          return offer ? <li key={offerId}>{offer.label}<b>{offer.currencySymbol}{offer.currentPrice}</b></li> : null;
                        })}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="report-price-structure-empty">
                  <AlertTriangle size={18} />
                  <p>不同价格点不足 3 个，暂不发布低位、主流和高位价格带。</p>
                </div>
              )}

              <div className="report-price-structure-reading">
                <article>
                  <span>结构判断</span>
                  <h4>{priceMarketStructure.shape.conclusion}</h4>
                  <p>{priceMarketStructure.shape.rationale}</p>
                </article>
                <article className="recommendation">
                  <span>建议价格的位置</span>
                  <h4>{priceMarketStructure.recommendedRangePosition.label}</h4>
                  <p>{priceMarketStructure.recommendedRangePosition.conclusion}</p>
                  <small>{priceMarketStructure.recommendedRangePosition.boundary}</small>
                </article>
              </div>

              {priceMarketStructure.largestGap && (
                <p className="report-price-gap">
                  <CircleHelp size={15} />
                  最大相邻价差：{priceMarketStructure.currencySymbol}{priceMarketStructure.largestGap.fromPrice}
                  → {priceMarketStructure.currencySymbol}{priceMarketStructure.largestGap.toPrice}，
                  占已观察跨度 {Math.round(priceMarketStructure.largestGap.shareOfObservedSpan * 100)}%。
                  {priceMarketStructure.largestGap.interpretation}
                </p>
              )}

              <details className="report-price-structure-boundary">
                <summary>这张结构图能回答什么、不能回答什么</summary>
                <div>
                  <section><h4>可以回答</h4><List items={priceMarketStructure.decisionUse.canAnswer} /></section>
                  <section><h4>不能回答</h4><List items={priceMarketStructure.decisionUse.cannotAnswer} /></section>
                  <section><h4>下一步补证</h4><List items={priceMarketStructure.decisionUse.nextEvidence} /></section>
                </div>
              </details>
              <p className="report-price-structure-note"><ShieldAlert size={16} />{priceMarketStructure.boundary}</p>
            </section>
          )}

          {report.estimatedUnitEconomics && (
            <EstimatedUnitEconomicsCard model={report.estimatedUnitEconomics} />
          )}

          {visualShapingOpportunity && (
            <section className="report-breakout-score" aria-labelledby="breakout-score-title">
              <header className="report-breakout-head">
                <div className="report-breakout-total">
                  <span>爆品潜力分</span>
                  <strong>{visualShapingOpportunity.breakoutScore.overall}<small>/100</small></strong>
                  <em>值得验证，暂不放量</em>
                </div>
                <div>
                  <span>第二层评分 · 具体方向</span>
                  <h3 id="breakout-score-title">这条产品方向具不具备爆品结构？</h3>
                  <p>{visualShapingOpportunity.breakoutScore.verdict}</p>
                </div>
              </header>

              <div className="report-breakout-formula" aria-label="爆品潜力评分公式">
                {visualShapingOpportunity.breakoutScore.factors.map((factor, index) => (
                  <div key={factor.key}>
                    {index > 0 && <b aria-hidden="true">×</b>}
                    <span>{factor.label}</span>
                  </div>
                ))}
              </div>

              <div className="report-breakout-grid">
                {visualShapingOpportunity.breakoutScore.factors.map((factor, index) => (
                  <article key={factor.key} data-status={factor.status}>
                    <header>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <h4>{factor.label}</h4>
                      <strong>{factor.score}</strong>
                    </header>
                    <div className="report-breakout-bar" aria-label={`${factor.label} ${factor.score} 分`}>
                      <span style={{ width: `${factor.score}%` }} />
                    </div>
                    <p>{factor.rationale}</p>
                    <footer><span>{factor.status}</span><p><strong>下一步：</strong>{factor.nextAction}</p></footer>
                  </article>
                ))}
              </div>

              <p className="report-breakout-method">
                <CircleHelp size={15} />
                <span><strong>为什么不是简单平均：</strong>{visualShapingOpportunity.breakoutScore.method}</span>
              </p>
            </section>
          )}

          <div className="card">
            <h3>机会成立的关键依据</h3>
            <List items={report.narrative.opportunityEvidence} />
          </div>

          {visualShapingOpportunity && (
            <section className="report-macro-opportunity" aria-labelledby="macro-opportunity-title">
              <header>
                <div>
                  <span>宏观机会补充</span>
                  <h3 id="macro-opportunity-title">这种外观焦虑到底覆盖多少人？</h3>
                  <p>先看困扰覆盖面和邻近付费市场，再用保守渗透率判断可能的数量级。</p>
                </div>
              </header>
              <div className="report-macro-metrics">
                {visualShapingOpportunity.macroMetrics.map((metric) => (
                  <article key={metric.label}>
                    <span>{metric.evidenceType}</span>
                    <strong>{metric.value}</strong>
                    <h4>{metric.label}</h4>
                    <p>{metric.interpretation}</p>
                    <a href={metric.sourceUrl} target="_blank" rel="noreferrer">
                      {metric.sourceLabel}<ExternalLink size={12} />
                    </a>
                  </article>
                ))}
              </div>
              <div className="report-sizing-scenario">
                <div>
                  <h4>如果只触达其中很小一部分</h4>
                  <p>售价按 44 美元、每人每年购买 1 条进行情景测算。</p>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>年购买渗透率</th><th>对应购买人数</th><th>年零售额</th></tr></thead>
                    <tbody>
                      {visualShapingOpportunity.sizingScenarios.map((scenario) => (
                        <tr key={scenario.penetration}>
                          <td>{scenario.penetration}</td><td>{scenario.buyers}</td><td>{scenario.annualRevenue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="report-sizing-boundary"><AlertTriangle size={15} />{visualShapingOpportunity.sizingBoundary}</p>
              </div>
            </section>
          )}
        </Chapter>

        {/* 2 - 别人为什么能卖 */}
        <Chapter
          meta={readerChapter("competitors")}
          preview={advertisingAudit?.reconciliation.headline ?? reportTextZh(report.competitors.brandPositioning)}
        >
          {advertisingAudit && (
            <section className="report-conclusion-reconciliation" aria-labelledby="reconciled-conclusion-title">
              <header>
                <span>核心转化结论 · 截至 {advertisingAudit.asOf}</span>
                <h3 id="reconciled-conclusion-title">{advertisingAudit.reconciliation.headline}</h3>
                <p>{advertisingAudit.reconciliation.summary}</p>
              </header>
              <div className="report-reconciliation-stages">
                {reconciliationStages.map((stage, index) => (
                  <article key={stage.label}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h4>{stage.label}</h4>
                    <p>{stage.conclusion.statement}</p>
                    <small>{stage.conclusion.claimBoundary}</small>
                  </article>
                ))}
              </div>
            </section>
          )}

          {advertisingAudit && (
            <section className="report-ad-audit" aria-labelledby="competitor-ad-audit-title">
              <header className="report-ad-audit-head">
                <div>
                  <span>广告入口证据</span>
                  <h3 id="competitor-ad-audit-title">不同竞品分别用什么抓手把用户带进来？</h3>
                  <p>以下只回答广告入口，不再与商品页证明、售后承诺和成交动作混为一个结论。</p>
                </div>
                <a href={advertisingAudit.metaLibraryUrl} target="_blank" rel="noreferrer">
                  打开 Meta 广告资料库继续核查<ExternalLink size={14} />
                </a>
              </header>

              {!consumerPsychology && (
                <div className="report-ad-funnel" aria-label="竞品广告转化链路">
                  {[
                    ["分品牌广告抓手", "Ionix 切外观焦虑；Silix 切身体不适，不能混用"],
                    ["落地页兑现", "用即时平滑、自然塑形和体感解释产品"],
                    ["信任装置", "叠加用户故事、效果表达和退款承诺"],
                    ["成交动作", "用折扣、保证和明确按钮推动下单"],
                  ].map(([title, body], index) => (
                    <div className="report-ad-funnel-step" key={title}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{title}</strong>
                      <p>{body}</p>
                      {index < 3 && <ArrowRight className="report-ad-funnel-arrow" size={18} aria-hidden="true" />}
                    </div>
                  ))}
                </div>
              )}

              <div className="report-ad-hook-grid">
                {advertisingAudit.hooks.map((item) => (
                  <article className="report-ad-hook" key={item.competitor}>
                    <div className="report-ad-hook-title">
                      <h4>{item.competitor} 的抓手</h4>
                      <span data-level={item.level}>{item.level}</span>
                    </div>
                    <dl>
                      <div><dt>广告入口</dt><dd>{item.hook}</dd></div>
                      <div><dt>为什么容易点击</dt><dd>{item.whyItWorks}</dd></div>
                      <div><dt>落地页怎么接</dt><dd>{item.landingPageHandoff}</dd></div>
                      <div className="risk"><dt>证据与使用边界</dt><dd>{item.risk}</dd></div>
                    </dl>
                    <div className="report-ad-hook-sources">
                      {item.sources.map((source) => (
                        <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
                          {source.label}<ExternalLink size={12} />
                        </a>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <p className="report-ad-audit-boundary">
                <ShieldAlert size={16} />{advertisingAudit.metaAccessNote}
                “去橘皮”等抓手会完整保留为竞品观察，但在拿到广告原件、目标样品和功效依据前，不进入可直接使用的营销文案。
              </p>
            </section>
          )}

          <div className="card report-legacy-conversion">
            <span>竞品成交证据</span>
            <h3>购买页如何承接兴趣并促成下单</h3>
            <p className="appendix-note">这些内容解释用户进入页面后为什么愿意继续考虑，不再代表广告最初用什么吸引用户。</p>
            <List items={report.narrative.competitorReasons} />
          </div>
          <div className="card">
            <h3>用户当前的替代方案与缺口</h3>
            <List items={report.narrative.currentAlternatives} />
          </div>

          {report.competitorStance.length > 0 && (
            <div className="card">
              <h3>重点对标：{primaryCompetitorName}</h3>
              <p className="appendix-note">
                左边拆解{hasYogaSpecialization ? " Ionix" : "本次主要竞品样本"}已经怎么卖，右边给出我们的产品要求；是否真正做到，仍需目标样品实测。
              </p>
              <div className="table-wrap">
                <table className="report-stance-table">
                  <colgroup><col className="stance-dimension-col" /><col className="stance-competitor-col" /><col className="stance-ours-col" /></colgroup>
                  <thead>
                    <tr>
                      <th>对比维度</th>
                      <th>
                        <div className="report-stance-source-head">
                          <span>{hasYogaSpecialization ? "Ionix 怎么做" : "竞品样本怎么做"}</span>
                          <span className="report-stance-source-links">
                            {ionixProductSource && (
                              <a href={ionixProductSource.url} target="_blank" rel="noreferrer">
                                查看商品页 <ExternalLink size={12} />
                              </a>
                            )}
                            {ionixBrandSource && (
                              <a href={ionixBrandSource.url} target="_blank" rel="noreferrer">
                                查看品牌页 <ExternalLink size={12} />
                              </a>
                            )}
                          </span>
                        </div>
                      </th>
                      <th>我们应该怎么做</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.competitorStance.map((row) => (
                      <tr key={row.dimension}>
                        <td className="report-stance-dimension">{row.dimension}</td>
                        <td>{reportTextZh(row.competitor)}</td>
                        <td><List items={row.ours} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {priceAnchors.length > 0 && (
            <PriceAxis
              anchors={priceAnchors}
              range={report.priceRange}
              rangeText={report.priceRangeText}
              structure={priceMarketStructure}
            />
          )}

          <details className="appendix-block">
            <summary>查看更多{hasYogaSpecialization ? " Ionix" : "主要竞品"}拆解</summary>
            <div className="fact-grid">
            <div className="fact"><span>品牌定位</span><p>{reportTextZh(report.competitors.brandPositioning)}</p></div>
            <div className="fact"><span>目标人群</span><p>{reportTextZh(report.competitors.targetAudience)}</p></div>
            <div className="fact"><span>价格带</span><p>{reportTextZh(report.competitors.pricePositioning)}</p></div>
            <div className="fact"><span>SKU 结构</span><p>{reportTextZh(report.competitors.skuSummary)}</p></div>
            <div className="fact"><span>组合策略</span><p>{reportTextZh(report.competitors.bundleStrategy)}</p></div>
            <div className="fact"><span>折扣策略</span><p>{reportTextZh(report.competitors.discountStrategy)}</p></div>
            <div className="fact"><span>材质</span><p>{reportTextZh(report.competitors.materials)}</p></div>
            <div className="fact"><span>尺码体系</span><p>{reportTextZh(report.competitors.sizeSystem)}</p></div>
            <div className="fact"><span>社会证明</span><p>{reportTextZh(report.competitors.socialProof)}</p></div>
            <div className="fact"><span>评论表现</span><p>{reportTextZh(report.competitors.reviews)}</p></div>
            <div className="fact"><span>用户内容</span><p>{reportTextZh(report.competitors.ugc)}</p></div>
            <div className="fact"><span>首页信息</span><p>{reportTextZh(report.competitors.homepageMessaging)}</p></div>
            </div>
            <div className="card">
              <h3>核心卖点</h3>
              <List items={report.competitors.sellingPoints.map(reportTextZh)} />
            </div>
            <div className="card">
              <h3>{hasYogaSpecialization ? "Ionix 商品页" : "竞品购买页"}如何促成下单</h3>
              <List items={report.competitors.whyItSells.map(reportTextZh)} />
            </div>
          </details>
        </Chapter>

        {/* 3 - 用户到底在买什么 */}
        <Chapter
          meta={readerChapter("customers")}
          preview={currentTargetCustomer}
        >
          {conclusionGovernance && (
            <div className="card report-current-audience">
              <span>当前人群与场景</span>
              <h3>{currentTargetCustomer}</h3>
              <p>{currentTargetScenario}</p>
              <small>{governedConclusion("target_customer")?.claimBoundary}</small>
            </div>
          )}
          <div className="motive-grid">
            <div className={`card report-persona-card${hasYogaSpecialization ? "" : " without-image"}`}>
              <div className="report-persona-copy"><h3>用户是谁</h3><List items={report.narrative.users} /></div>
              {hasYogaSpecialization ? (
                <Image
                  className="report-persona-image"
                  src="/report-assets/3d-yoga-pants-customer-persona.png"
                  alt="一位美国女性在健身房进行深蹲训练，并在训练后穿着同一条自然塑形紧身裤进行日常活动"
                  width={724}
                  height={543}
                  priority={false}
                />
              ) : null}
            </div>
            <div className="card"><h3>典型场景</h3><List items={report.narrative.scenarios} /></div>
            <div className="card"><h3>核心痛点</h3><List items={report.narrative.painPoints} /></div>
            <div className="card"><h3>最大不确定性</h3><List items={report.narrative.majorUnknowns} /></div>
          </div>

          {consumerPsychology && (
            <section className="report-psychology" aria-labelledby="consumer-psychology-title">
              <header className="report-psychology-head">
                <div>
                  <span>用户决策链</span>
                  <h3 id="consumer-psychology-title">用户为什么会行动？</h3>
                  <p>从真实用户表达开始，把触发、心理张力、结果想象、信任和风险消除放进同一条链，而不是在不同章节各写一套购买原因。</p>
                </div>
                <div className="report-psychology-status">
                  <Lightbulb size={18} />
                  <span>目标 SKU 尚未实测<br />营销仍是待验证草案</span>
                </div>
              </header>

              <ol className="report-psychology-chain">
                {consumerPsychology.stages.map((stage, index) => (
                  <li className="report-psychology-stage" key={stage.id}>
                    <div className="report-psychology-stage-top">
                      <span className="report-psychology-index">{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <span className="report-psychology-short">{stage.shortLabel}</span>
                        <h4>{stage.label}</h4>
                      </div>
                      <span className={`evidence-status ${stage.evidenceStatus}`}>
                        {stage.evidenceStatusLabel}
                      </span>
                    </div>
                    <p className="report-psychology-question">{stage.question}</p>
                    <p className="report-psychology-conclusion">{stage.conclusion}</p>
                    <dl className="report-psychology-meta">
                      <div><dt>心理机制</dt><dd>{stage.mechanismLabel}</dd></div>
                      <div><dt>作用范围</dt><dd>{stage.scopeLabel}</dd></div>
                      <div><dt>支持证据</dt><dd>{stage.supportCount} 项</dd></div>
                      <div><dt>反向证据</dt><dd>{stage.counterevidenceCount} 项</dd></div>
                    </dl>
                    <details>
                      <summary>证据边界与下一步验证</summary>
                      <p><strong>表达边界：</strong>{stage.claimBoundary}</p>
                      {stage.unknowns.length > 0 && (
                        <><h5>关键未知</h5><List items={stage.unknowns} /></>
                      )}
                      {stage.validationNeeded.length > 0 && (
                        <><h5>需要验证</h5><List items={stage.validationNeeded} /></>
                      )}
                    </details>
                    {index < consumerPsychology.stages.length - 1 && (
                      <ArrowRight className="report-psychology-arrow" size={19} aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ol>

              <p className="report-psychology-boundary">
                <ShieldAlert size={16} />{consumerPsychology.overallBoundary}
              </p>
            </section>
          )}

          <ReportDiscoveryNetwork network={discoveryNetwork} />

          {report.opportunityValidationRoadmap ? (
            <ReportOpportunityValidationRoadmap roadmap={report.opportunityValidationRoadmap} />
          ) : null}

          {report.voice.available ? (
            <div className="voc-panel">
              <div className="voc-head">
                <h3><MessagesSquare size={18} />用户之声证据</h3>
                <span className={`voc-confidence voc-${report.voice.confidence.toLowerCase()}`}>
                  可信度 {report.voice.confidence}
                </span>
              </div>
              <p className="voc-rationale">{report.voice.confidenceRationale}</p>
              {report.voicePlatformCounts.length > 0 && (
                <div className="voc-source-summary">
                  <strong>这 699 条用户反馈来自哪里？</strong>
                  <p>
                    {report.voicePlatformCounts.map((item) => `${item.platform} ${item.count} 条`).join("、")}。
                    既包括 Amazon 和品牌商品评论，也包括 Reddit 社区与 Trustpilot 独立评论。
                  </p>
                </div>
              )}
              {report.evidenceLineage && (
                <p className="voc-lineage-label">
                  当前用户洞察主体：{report.evidenceLineage.primary.label} ·
                  {report.evidenceLineage.primary.observationCount} 条多渠道观察
                </p>
              )}
              <div className="voc-coverage">
                <div><strong>{report.voice.validObservations}</strong><span>有效观察</span></div>
                <div><strong>{report.voice.negativeOrNeutral}</strong><span>负面或中性</span></div>
                <div><strong>{report.positiveEvidenceCount}</strong><span>正向证据</span></div>
                <div><strong>{report.counterevidence.length}</strong><span>直接反证</span></div>
                <div><strong>{report.voice.sourceCount}</strong><span>来源数</span></div>
                <div><strong>{report.voice.platformCount}</strong><span>平台数</span></div>
              </div>
              <p className="voc-denominator">{report.voice.denominatorDefinition}</p>

              {report.sentimentSplit.length > 0 && (
                <SentimentSplit
                  caption="同一主题：抱怨 vs 满意"
                  rows={report.sentimentSplit.map((row) => {
                    const pain = report.voice.topPainPoints.find((item) => item.theme === row.theme);
                    return {
                      ...row,
                      sourceLabel: pain?.sourceFamilies.join("、"),
                    };
                  })}
                  denominator={report.voice.topPainPoints[0]?.denominator ?? 0}
                />
              )}

              {report.missingObservationDates && report.evidenceLineage ? (
                <div className="callout adjacent-boundary">
                  <strong>历史主体语料没有原始发布时间。</strong>
                  历史 {report.evidenceLineage.primary.observationCount} 条观察继续负责完整用户洞察，
                  但不能用于判断近期变化；本次审计语料中有{" "}
                  {report.evidenceLineage.audit.datedObservationCount}/
                  {report.evidenceLineage.audit.observationCount} 条保留了原始日期，
                  只用于证明新的日期记录能力，不代表全部历史语料已经补齐。
                </div>
              ) : report.missingObservationDates ? (
                <div className="callout adjacent-boundary">
                  <strong>这批观察没有原始发布时间。</strong>
                  语料只记录了抓取时间，因此无法判断某个主题是长期存在的老问题，
                  还是最近才集中爆发——两者对应的策略完全不同（前者是结构性机会，后者是时间窗口）。
                  需要在采集阶段保留原帖与评论日期，才能做出这个区分。
                </div>
              ) : null}

              {report.counterevidence.length > 0 && (
                <div className="card">
                  <h3>直接反证（{report.counterevidence.length} 条）</h3>
                  <p className="appendix-note">
                    这些观察直接反驳了上面的痛点，与单纯的好评不同，因此单独列出内容而不只给计数。
                  </p>
                  <ul className="report-counterevidence">
                    {report.counterevidence.map((item, index) => (
                      <li key={`${index}-${item.paraphrase}`}>
                        <span className="report-counterevidence-theme">{item.theme}</span>
                        <span>{reportTextZh(item.paraphrase)}</span>
                        {item.quote && <span className="report-counterevidence-quote">原话：“{reportTextZh(item.quote)}”</span>}
                        <a className="report-counterevidence-source" href={item.url} target="_blank" rel="noreferrer">
                          查看 {item.platform} 原文<ExternalLink size={12} />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.voice.representativeExcerpts.length > 0 && (
                <div className="voc-excerpts">
                  {report.voice.representativeExcerpts.map((excerpt) => (
                    <blockquote key={`${excerpt.theme}-${excerpt.excerpt}`}>
                      <Quote size={14} />
                      <span>{reportTextZh(excerpt.excerpt)}</span>
                      <a href={excerpt.url} target="_blank" rel="noreferrer">
                        {platformFromUrl(excerpt.url)} · 查看原文<ExternalLink size={12} />
                      </a>
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="callout">本次研究没有取得评论级用户之声证据，用户动机部分仅来自公开页面与社区讨论。</div>
          )}
        </Chapter>

        {/* 4 - 那我该做成什么样 */}
        <Chapter meta={readerChapter("positioning")}>
          {visualShapingOpportunity && (
            <section className="report-anxiety-map" aria-labelledby="anxiety-map-title">
              <header>
                <span>产品方向重构</span>
                <h3 id="anxiety-map-title">从“压力”改为“肉眼可见的外观管理”</h3>
                <p><strong>{visualShapingOpportunity.direction}</strong>：{visualShapingOpportunity.thesis}</p>
              </header>
              <div className="report-anxiety-grid">
                {visualShapingOpportunity.anxietyAngles.map((angle) => (
                  <article key={angle.priority}>
                    <div className="report-anxiety-title">
                      <span>{String(angle.priority).padStart(2, "0")}</span>
                      <h4>{angle.anxiety}</h4>
                      <em data-risk={angle.risk}>风险 {angle.risk}</em>
                    </div>
                    <dl>
                      <div><dt>用户想看到</dt><dd>{angle.visibleOutcome}</dd></div>
                      <div><dt>产品怎么实现</dt><dd>{angle.productDirection}</dd></div>
                      <div><dt>当前可测试表达</dt><dd>{angle.usableExpression}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
              <p className="report-anxiety-boundary">
                “去橘皮、瘦腿、改善循环”等竞品抓手可以保留用于理解用户焦虑，但不能直接变成目标商品功效；优先验证的是穿着后的视觉差异。
              </p>
            </section>
          )}

          <article className="report-opportunity-card recommended">
            <header>
              <div>
                <span className="badge-recommended">推荐方向</span>
                <h4>{currentRecommendedDirection}</h4>
              </div>
              {recommendedScore !== null && <span className="report-opportunity-score">{recommendedScore}</span>}
            </header>
            <p>{currentCoreValue}</p>
            <dl className="report-opportunity-meta">
              <div><dt>目标客户</dt><dd>{currentTargetCustomer}</dd></div>
              <div><dt>使用场景</dt><dd>{currentTargetScenario}</dd></div>
              <div><dt>产品构想</dt><dd>{currentProductConcept}</dd></div>
              <div><dt>证据强度</dt><dd>{currentEvidenceStrength}</dd></div>
            </dl>
            <p className="report-opportunity-rationale">
              {currentRecommendationRationale}
            </p>
          </article>

          <BarList
            caption="三个候选方向的评分对比"
            scaleNote="推荐方向名称采用当前报告口径；分数来自第一性原理评分模型"
            max={100}
            data={report.opportunities.map((opportunity) => ({
              label: opportunity.id === report.recommendedOpportunityId
                ? currentRecommendedDirection
                : reportTextZh(opportunity.title),
              value: opportunity.score,
              emphasis: opportunity.id === report.recommendedOpportunityId,
            }))}
          />

          <div className="card">
            <h3>为什么其他方向暂不优先</h3>
            <List items={report.recommendation.alternativesDeferred} />
          </div>

          <details className="appendix-block">
            <summary>
              <Target size={14} /> 查看三个产品方向的评分与完整对比
            </summary>
            <div className="report-opportunity-grid">
              {report.opportunities.map((opportunity) => {
                const isRecommended = opportunity.id === report.recommendedOpportunityId;
                const declined = report.alternativesNotRecommended.find(
                  (item) => item.opportunity_id === opportunity.id,
                );
                return (
                  <article
                    key={opportunity.id}
                    className={`report-opportunity-card ${isRecommended ? "recommended" : ""}`}
                  >
                    <header>
                      <div>
                        {isRecommended && <span className="badge-recommended">推荐</span>}
                        <h4>{isRecommended ? currentRecommendedDirection : reportTextZh(opportunity.title)}</h4>
                      </div>
                      <span className="report-opportunity-score">{opportunity.score}</span>
                    </header>
                    <p>{reportTextZh(opportunity.core_value_proposition)}</p>
                    <dl className="report-opportunity-meta">
                      <div><dt>目标客户</dt><dd>{reportTextZh(opportunity.target_customer)}</dd></div>
                      <div><dt>使用场景</dt><dd>{reportTextZh(opportunity.target_scenario)}</dd></div>
                      <div><dt>可行性</dt><dd>{strengthLabels[opportunity.feasibility]}</dd></div>
                      <div><dt>证据强度</dt><dd>{strengthLabels[opportunity.evidence_strength]}</dd></div>
                    </dl>
                    <p className="report-opportunity-rationale">{reportTextZh(opportunity.score_rationale)}</p>
                    {declined && <p className="report-opportunity-declined">暂不优先：{reportTextZh(declined.reason)}</p>}
                  </article>
                );
              })}
            </div>
            <div className="card">
              <h3>为什么优先推荐</h3>
              <p>{reportTextZh(report.recommendationRationale)}</p>
            </div>
            <div className="card">
              <h3>定位与差异化</h3>
              <p><strong>建议价格带</strong>：{reportTextZh(report.positioning.recommendedPriceRange)}</p>
              <p>{reportTextZh(report.positioning.targetCustomer)}</p>
              <p>{reportTextZh(report.positioning.coreSellingPoint)}</p>
              <List items={report.positioning.differentiation.map(reportTextZh)} />
            </div>
          </details>
          <div className="card">
            <h3><CheckCircle2 size={18} />产品必须具备</h3>
            <List items={report.mustHave} />
          </div>

          {candidateWorkspace ? <ReportCandidateVerification workspace={candidateWorkspace} /> : null}

          {/* Adjacent opportunities: discovered here, approved nowhere. Each one
              needs its own Research Run before it becomes a product decision. */}
          {report.demandField && report.demandField.opportunities.length > 0 && (
            <details className="appendix-block report-adjacent-opportunities-detail">
              <summary><Users size={16} />展开同一人群的相邻机会</summary>

              <div className="card">
                <p className="appendix-note">
                  目标人群：{report.demandField.audienceLabels.join("；")}
                </p>
                <ol className="report-taskchain">
                  {report.demandField.taskChain.map((step) => (
                    <li key={step.sequence}>
                      <span className="report-taskchain-index">{step.sequence}</span>
                      <span className="report-taskchain-label">{step.label}</span>
                      <span className="report-taskchain-stage">{step.stageLabel}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {report.demandField.opportunitiesNotApproved && (
                <div className="callout adjacent-boundary">
                  <strong>以下方向均未获批准。</strong>
                  它们只是与当前人群和任务链存在关联的候选，需要分别创建独立调研任务重新取证，
                  不影响本商品的现有决策。
                </div>
              )}

              <div className="report-adjacent-grid">
                {report.demandField.opportunities.map((opportunity) => (
                  <article className="report-adjacent-card" key={opportunity.id}>
                    <header>
                      <h4>{opportunity.title}</h4>
                      <span className="report-adjacent-status">{opportunity.statusLabel}</span>
                    </header>
                    <p className="report-adjacent-category">{opportunity.category}</p>

                    <div className="report-adjacent-tags">
                      {opportunity.relationships.map((relationship) => (
                        <span key={relationship}>{relationship}</span>
                      ))}
                    </div>

                    <dl className="report-opportunity-meta">
                      <div><dt>关联强度</dt><dd>{opportunity.strengthLabel}</dd></div>
                      <div><dt>证据状态</dt><dd>{opportunity.evidenceStatusLabel}</dd></div>
                      <div><dt>支持观察</dt><dd>{opportunity.supportCount} 条</dd></div>
                      <div><dt>反向证据</dt><dd>{opportunity.counterevidenceCount} 条</dd></div>
                    </dl>

                    {!opportunity.directProductEvidence && (
                      <p className="report-adjacent-warn">
                        语料中没有直接出现该商品，此方向由任务链推断得出。
                      </p>
                    )}

                    <p className="report-adjacent-rationale">{opportunity.rationale}</p>

                    <details className="appendix-block">
                      <summary>为什么还不能推进</summary>
                      <p>{opportunity.whyNotApproved}</p>
                      {opportunity.validationQuestions.length > 0 && (
                        <>
                          <h4>需要先回答</h4>
                          <List items={opportunity.validationQuestions} />
                        </>
                      )}
                    </details>
                  </article>
                ))}
              </div>

              <div className="report-opportunity-page-cta">
                <div>
                  <strong>在独立页面继续查看这些机会</strong>
                  <p>完整展示用户画像、任务链、候选产品、证据强弱和下一轮研究问题，也可以单独复制链接分享。</p>
                </div>
                <Link href={`/research/${report.runId}/opportunities`}>
                  打开连续选品机会页 <ArrowRight size={16} />
                </Link>
              </div>
            </details>
          )}
        </Chapter>

        {/* 5 - 怎么用最小成本验证 */}
        <Chapter meta={readerChapter("validation")}>
          <details className="appendix-block report-validation-ledger-detail">
            <summary>查看验证任务执行台账</summary>
            <ReportValidationExecutionLedger
              ledger={report.validationExecutionLedger}
              showInternalControls={false}
            />
          </details>

          {visualShapingOpportunity && (
            <section className="report-visual-test">
              <div>
                <span>样品阶段关键验收</span>
                <h3>{visualShapingOpportunity.validation.title}</h3>
                <p>{visualShapingOpportunity.validation.method}</p>
              </div>
              <dl>
                <div><dt>样本</dt><dd>{visualShapingOpportunity.validation.sample}</dd></div>
                <div><dt>通过</dt><dd>{visualShapingOpportunity.validation.pass}</dd></div>
                <div><dt>失败</dt><dd>{visualShapingOpportunity.validation.fail}</dd></div>
              </dl>
            </section>
          )}

          <div className="budget-banner">
            <div>
              <span>验证预算</span>
              <strong>{report.validationBudget.label}</strong>
            </div>
            <div>
              <span>预算匹配</span>
              <strong>{report.validationBudget.budgetFitLabel}</strong>
            </div>
            <p>{report.validationBudget.note}</p>
          </div>

          <ValidationTimeline
            caption="验证顺序与各阶段时长"
            totalDays={summary.nextStepCost.totalDurationDays}
            steps={report.validationSteps.map((step) => ({
              name: step.name,
              typeLabel: testTypeLabels[step.internalType] ?? step.name,
              days: step.durationDays,
              budget: step.budgetCap,
            }))}
          />

          <details className="appendix-block report-validation-experiments-detail">
            <summary>展开完整实验方案（{report.validationSteps.length} 个）</summary>
            <div className="report-experiment-list">
              {report.validationSteps.map((step, index) => (
                <article className="report-experiment" key={`${step.internalType}-${index}`}>
                  <header>
                    <span className="report-experiment-index">实验 {index + 1}</span>
                    <span className="report-experiment-type">
                      {testTypeLabels[step.internalType] ?? step.name}
                    </span>
                    <span className="report-experiment-cost">
                      {step.durationDays} 天 · {step.budgetCap}
                    </span>
                  </header>
                  <p className="report-experiment-method">{step.method}</p>
                  <dl className="report-experiment-criteria">
                    <div><dt>范围</dt><dd>{step.scope}</dd></div>
                    <div><dt>衡量指标</dt><dd>{step.metric}</dd></div>
                    <div><dt>通过</dt><dd>{step.pass}</dd></div>
                    <div><dt>失败</dt><dd>{step.fail}</dd></div>
                    <div><dt>停止</dt><dd>{step.stop}</dd></div>
                    <div><dt>通过后</dt><dd>{step.nextIfPass}</dd></div>
                    <div><dt>失败后</dt><dd>{step.nextIfFail}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </details>

          <h3 className="chapter-subhead"><ShieldAlert size={18} />立即停止条件</h3>
          <div className="motive-grid">
            {report.stopConditionGroups.map((group) => (
              <div className="card" key={group.title}>
                <h3>{group.title}</h3>
                <List items={group.conditions} />
              </div>
            ))}
          </div>

          <h3 className="chapter-subhead">供应链交接与询盘</h3>
          <div className="card">
            <h3>产品方向</h3>
            <p>{currentProductConcept}</p>
            <h3>需要供应商书面确认</h3>
            <List items={report.supplierHandoff.supplierConfirmations} />
            <h3>需要索取的文件</h3>
            <List items={report.supplierHandoff.requestedDocuments} />
          </div>
          <details className="appendix-block">
            <summary>展开完整供应商询盘清单（{report.supplierInquiryGroups.length} 组）</summary>
            <div className="motive-grid">
              {report.supplierInquiryGroups.map((group) => (
                <div className="card" key={group.title}>
                  <h3>{group.title}</h3>
                  <List items={group.questionsZh} />
                </div>
              ))}
            </div>
          </details>
        </Chapter>

        {/* 6 - 能怎么宣传、不能怎么宣传 */}
        <Chapter meta={readerChapter("marketing")}>
          {report.marketing ? (
            <>
              {report.marketing.decisionChain ? (
                <section className="report-marketing-bridge" aria-labelledby="marketing-bridge-title">
                  <header>
                    <div>
                      <span>PSYCHOLOGY → MESSAGE</span>
                      <h3 id="marketing-bridge-title">心理链如何转成营销表达</h3>
                    </div>
                    <p>营销章节不再独立发明购买理由；每种表达都回指心理链节点，并继承其证据等级和验证要求。</p>
                  </header>
                  <ol>
                    {report.marketing.decisionChain.mappings.map((mapping, index) => {
                      const role = marketingDecisionRoleLabels[mapping.role];
                      return (
                        <li key={mapping.role}>
                          <div className="report-marketing-bridge-head">
                            <span>{role.code}</span>
                            <strong>{role.label}</strong>
                          </div>
                          <small>{role.source}</small>
                          <p>{mapping.expression}</p>
                          <div className="report-marketing-bridge-meta">
                            <span className={`evidence-status ${mapping.evidenceStatus}`}>
                              {evidenceStatusLabels[mapping.evidenceStatus]}
                            </span>
                            <span>{mapping.sourceStageIds.join(" · ")}</span>
                          </div>
                          {index < 4 ? (
                            <ArrowRight size={18} aria-hidden="true" />
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="report-marketing-bridge-boundary">
                    <ShieldAlert size={15} />{report.marketing.decisionChain.boundary}
                  </p>
                </section>
              ) : null}

              {candidateWorkspace ? <ReportCreativeReferenceLibrary workspace={candidateWorkspace} /> : null}

              <div className="card verdict-card">
                <h3>价值主张</h3>
                <p>{currentMarketingValue}</p>
                <p className="appendix-note">
                  当前状态：{usageStatusLabels[report.marketing.status] ?? report.marketing.status}
                </p>
                {governedConclusion("marketing_value_proposition") && (
                  <p className="report-governed-boundary">
                    <ShieldAlert size={14} />{governedConclusion("marketing_value_proposition")?.claimBoundary}
                  </p>
                )}
              </div>

              <h3 className="chapter-subhead">可以怎么说</h3>
              <div className="motive-grid">
                {report.marketing.messagePillars.map((pillar) => (
                  <div className="card" key={pillar.id}>
                    <h3>{report.marketing?.decisionChain
                      ? pillar.productSellingPoint
                      : marketingPillarCopyZh[pillar.id]?.title ?? pillar.productSellingPoint}</h3>
                    <p className="report-marketing-copy">
                      {report.marketing?.decisionChain
                        ? pillar.marketingCopy
                        : marketingPillarCopyZh[pillar.id]?.copy ?? pillar.marketingCopy}
                    </p>
                    <dl className="pillar-meta">
                      <div><dt>用户收益</dt><dd>{pillar.customerBenefit}</dd></div>
                      <div><dt>使用场景</dt><dd>{pillar.useScenario}</dd></div>
                      <div><dt>情绪价值</dt><dd>{pillar.emotionalValue}</dd></div>
                    </dl>
                    <span className={`evidence-status ${pillar.evidenceStatus}`}>
                      {evidenceStatusLabels[pillar.evidenceStatus] ?? pillar.evidenceStatus}
                    </span>
                  </div>
                ))}
              </div>

              <details className="appendix-block">
                <summary>渠道文案草稿（未经验证，不可直接上架使用）</summary>
                <div className="card">
                  <h3>标题</h3>
                  <p>{report.marketing.channelDrafts.listingTitle.text}</p>
                  <h3>首屏</h3>
                  <p>{report.marketing.channelDrafts.hero.headline}</p>
                  <p>{report.marketing.channelDrafts.hero.subheadline}</p>
                  <h3>广告角度</h3>
                  <List items={report.marketing.channelDrafts.adAngles.map((draft) => draft.text)} />
                  <h3>内容钩子</h3>
                  <List items={report.marketing.channelDrafts.contentHooks.map((draft) => draft.text)} />
                </div>
              </details>

              <details className="appendix-block">
                <summary>这套营销表达的使用条件（{report.marketing.usageBoundaries.length} 条）</summary>
                <List items={report.marketing.usageBoundaries.map(reportTextZh)} />
              </details>

              <div className="card prohibited">
                <h3><Ban size={18} />禁止使用的营销声明</h3>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>声明</th><th>为什么禁止</th></tr></thead>
                    <tbody>
                      {report.marketing.prohibitedClaims.map((claim) => (
                        <tr key={claim.claim}>
                          <td>{claim.claim}</td>
                          <td>{claim.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="callout">本次研究尚未生成营销转译产物，以下只保留合规红线。</div>
              <div className="card prohibited">
                <h3><Ban size={18} />禁止使用的营销声明</h3>
                <List items={report.prohibitedMarketingClaims} />
              </div>
            </>
          )}
        </Chapter>

        {/* 验证层收口：行动边界不再作为第五个正文入口。 */}
        <section className="report-validation-boundary" id="chapter-boundary" aria-labelledby="validation-boundary-title">
          <header className="report-validation-boundary-head">
            <span>验证结论</span>
            <div>
              <h3 id="validation-boundary-title">当前允许做什么</h3>
              <p>只有完成对应验证，后续商业动作才会解锁。</p>
            </div>
          </header>
          {currentDecisionBoundary && (
            <div className="callout report-current-boundary">
              <strong>当前行动边界：</strong>{currentDecisionBoundary}
            </div>
          )}
          <div className="boundary-grid">
            <div className="boundary-item"><span>正式采购</span><p>{report.boundaries.formalPurchase}</p></div>
            <div className="boundary-item"><span>供应商可靠性</span><p>{report.boundaries.supplierReliability}</p></div>
            <div className="boundary-item"><span>上架</span><p>{report.boundaries.listing}</p></div>
            <div className="boundary-item"><span>广告测试</span><p>{report.boundaries.adTest}</p></div>
          </div>
          <div className="card next-stage-checklist">
            <h3>进入下一阶段前必须完成（{nextStageChecklist.length} 项）</h3>
            <List items={nextStageChecklist} />
            <p className="next-stage-rationale">
              <strong>为什么现在还不能继续：</strong>{reportTextZh(report.boundaryRationale)}
            </p>
          </div>
          <div className="card prohibited">
            <h3><Ban size={18} />明确不能做</h3>
            <h4>产品结构与范围</h4>
            <List items={report.mustNotHave.productScope} />
            <h4>证据与供应链</h4>
            <List items={report.mustNotHave.evidenceAndSupplyChain} />
          </div>
        </section>

        {/* 研究过程与证据：给需要复核的人，默认折叠。 */}
        <section className="report-chapter report-appendix" id="chapter-appendix">
          <div className="report-chapter-head">
            <span className="report-chapter-index">附</span>
            <div>
              <h2>研究过程与证据附录</h2>
              <p>研究方法、原始资料、来源台账、证据边界与待补信息</p>
            </div>
          </div>

          <p className="report-appendix-intro">
            市场、用户和竞品的关键结论已经回到正文。以下内容用于复核研究过程与结论来源，不影响正文阅读。
          </p>

          <details className="appendix-block">
            <summary>研究过程与分析视角</summary>
            <ReportResearchMethod />
          </details>

          {report.evidenceLineage && (
            <details className="appendix-block">
              <summary>本报告使用了哪些资料</summary>
              <EvidenceLineageNotice lineage={report.evidenceLineage} />
            </details>
          )}

          {report.secondCategoryValidation ? (
            <details className="appendix-block">
              <summary>第二品类能力验证</summary>
              <SecondCategoryValidationCard validation={report.secondCategoryValidation} />
            </details>
          ) : null}

          <details className="appendix-block">
            <summary>
              {report.evidenceLineage ? `${report.evidenceLineage.primary.label}台账` : "证据台账"}
              （{report.appendix.evidence.sourceCount} 来源 · 已验证{" "}
              {report.appendix.evidence.verifiedCount} · 待复核 {report.appendix.evidence.needsReviewCount}）
            </summary>
            <p className="appendix-note">{report.appendix.evidence.verifiedExplanation}</p>
            <p className="appendix-note">{report.appendix.evidence.needsReviewExplanation}</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>来源</th><th>原始标题与地址</th><th>状态</th></tr>
                </thead>
                <tbody>
                  {report.appendix.evidence.sources.map((source) => (
                    <tr key={source.url}>
                      <td>{source.title}</td>
                      <td>
                        <span className="source-original">{source.originalTitle}</span>
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.url}<ExternalLink size={12} />
                        </a>
                      </td>
                      <td><span className={`evidence-status ${source.status}`}>{source.statusLabel}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {report.evidenceLineage && (
            <details className="appendix-block">
              <summary>组合证据边界（{report.evidenceLineage.audit.limitations.length} 条）</summary>
              <p className="appendix-note">{report.evidenceLineage.boundary}</p>
              <List items={report.evidenceLineage.audit.limitations.map(reportTextZh)} />
            </details>
          )}

          <details className="appendix-block">
            <summary>未知与待补证（{report.appendix.unknowns.length}）</summary>
            <List items={report.appendix.unknowns.map(reportTextZh)} />
          </details>

          {/* 风险模块与单位经济只在真的有数据时出现，不做空入口。 */}
          {report.appendix.riskModuleCount > 0 && (
            <details className="appendix-block">
              <summary>风险模块（{report.appendix.riskModuleCount}）</summary>
              <p className="appendix-note">
                <Link href={`/runs/${report.runId}/risk`}>打开风险模块明细</Link>
              </p>
            </details>
          )}
          {report.appendix.economicsScenarioCount > 0 && (
            <details className="appendix-block">
              <summary>单位经济情景（{report.appendix.economicsScenarioCount}）</summary>
              <p className="appendix-note">
                <Link href={`/runs/${report.runId}/economics`}>打开单位经济明细</Link>
              </p>
            </details>
          )}

        </section>
      </div>
    </div>
  );
}
