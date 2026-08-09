import Link from "next/link";
import { Ban, CheckCircle2, CircleHelp, FlaskConical, Lightbulb, ShieldAlert } from "lucide-react";
import type { FirstPrinciplesBundle, OpportunityHypothesis } from "./types";
import type { VocSummary } from "../voc/types";
import type { PreSampleDecisionBrief } from "../pre-sample/types";
import { productNameZh, statusZh, supplyCategoryZh, validationBudgetZh, validationTypeZh } from "../presentation/zh";

type FirstPrinciplesBrief = Pick<
  PreSampleDecisionBrief,
  "whyContinue" | "recommendation" | "mustHave" | "mustNotHave" | "nextStageRequirements" | "validationSteps" | "scopeNotice" | "voiceOfCustomer"
>;

const scoreLabels: Record<keyof OpportunityHypothesis["scores"], string> = {
  demand_fit: "需求匹配",
  evidence_strength: "证据强度",
  differentiation: "差异化",
  supply_feasibility: "供给可行性",
  constraint_fit: "约束匹配",
  validation_cost: "验证成本",
  monetization_potential: "变现潜力",
  risk_exposure: "风险暴露",
};

const ReasoningColumn = ({
  title,
  icon,
  items,
  statements,
}: {
  title: string;
  icon: React.ReactNode;
  items: FirstPrinciplesBundle["fact_hypothesis_unknown"]["facts"];
  statements: string[];
}) => (
  <div className="reasoning-column">
    <h3>{icon}{title}</h3>
    {items.map((item, index) => (
      <div className="reasoning-item" key={item.id}>
        <strong>{item.id}</strong>
        <p>{statements[index]}</p>
        <span className="plain-badge">可信度：{statusZh(item.confidence)}</span>
        <span className="plain-badge">{item.validation_required ? "需要验证" : "无需追加验证"}</span>
        {item.supporting_claim_ids.length > 0 ? <small>结论编号：{item.supporting_claim_ids.join(", ")}</small> : null}
      </div>
    ))}
  </div>
);

export function FirstPrinciplesView({
  bundle,
  vocSummary = null,
  brief,
}: Readonly<{ bundle: FirstPrinciplesBundle; vocSummary?: VocSummary | null; brief?: FirstPrinciplesBrief }>) {
  const localizedBrief: FirstPrinciplesBrief = brief ?? {
    whyContinue: {
      users: ["目标用户待进一步确认"],
      scenarios: ["目标场景待进一步确认"],
      painPoints: ["用户痛点待进一步确认"],
      currentAlternatives: ["当前替代方案待进一步确认"],
      competitorReasons: ["竞品销售原因待进一步确认"],
      opportunityEvidence: ["机会证据待进一步确认"],
      majorUnknowns: ["关键证据仍未知", "供应商与目标款仍未知", "正式成本仍未知", "执行资源仍未知"],
    },
    recommendation: {
      title: "当前推荐机会",
      internalTitle: "Current opportunity",
      targetCustomer: "目标用户待进一步确认",
      targetScenario: "目标场景待进一步确认",
      productConcept: "产品概念待进一步确认",
      coreValue: "核心价值待进一步确认",
      whyFirst: "需要通过有边界的验证继续确认。",
      alternativesDeferred: ["其他方向暂不优先", "其他方向暂不优先"],
      evidenceStrength: "证据强度待进一步确认",
    },
    mustHave: ["目标产品必须通过实物和资料验证"],
    mustNotHave: {
      productScope: ["不在验证前扩大范围"],
      marketingClaims: ["不使用未经证明的声明"],
      evidenceAndSupplyChain: ["不把公开资料当作目标款事实"],
    },
    nextStageRequirements: ["补齐目标款、供应链、合规和成本证据"],
    validationSteps: [],
    scopeNotice: "当前结论仅用于决定下一步验证，不代表正式目标款已经通过。",
    voiceOfCustomer: {
      available: false,
      confidence: "INSUFFICIENT",
      confidenceRationale: "当前没有可用于展示的用户之声摘要。",
      validObservations: 0,
      negativeOrNeutral: 0,
      positiveOrCounterevidence: 0,
      sourceCount: 0,
      sourceFamilyCount: 0,
      platformCount: 0,
      denominatorDefinition: "当前有效观察数",
      topPainPoints: [],
      desiredOutcomes: [],
      counterevidence: [],
      representativeExcerpts: [],
      blockers: [],
      limitations: [],
      amazonCommentLevelEvidence: false,
    },
  };
  const factsZh = [
    "现有用户讨论对明显提臀褶皱造型评价两极。",
    "已观察到前中缝不适和可能卡裆等舒适性问题。",
    "在美国销售服装前，需要满足纤维成分、原产地、责任主体和洗护标签要求。",
    "客观健康效果声明在使用前必须具备充分、可靠的科学依据。",
    "公开供应商页面只能证明存在候选样品，不能代替目标款正式报价。",
  ];
  const hypothesesZh = [
    "低存在感的自然塑形结构可能保留塑形吸引力，同时减少用户对夸张提臀造型的排斥。",
    "经过验证的不透、洗后回弹和版型证据，可能支持 39 至 49 美元的独立站价格带。",
    "兼顾训练和日常穿着、带有实用收纳的克制造型，可能比纯健身塑形款覆盖更多场景。",
  ];
  const unknownsZh = localizedBrief.whyContinue.majorUnknowns.slice(0, bundle.fact_hypothesis_unknown.unknowns.length);
  const demandZh = [
    { user: localizedBrief.whyContinue.users[0], scenario: localizedBrief.whyContinue.scenarios[0], trigger: "担心面料拉伸后透视", pain: localizedBrief.whyContinue.painPoints[0], outcome: "获得有实测记录的不透保障", alternative: localizedBrief.whyContinue.currentAlternatives[0], gap: "具体面料和颜色的不透表现通常未经目标款实测" },
    { user: localizedBrief.whyContinue.users[1], scenario: "在健身房和公共场景穿着贴身紧身裤", trigger: "明显提臀褶皱显得过度暴露或评价两极", pain: localizedBrief.whyContinue.painPoints[1], outcome: "以低存在感缝线获得自然塑形", alternative: localizedBrief.whyContinue.currentAlternatives[1], gap: "造型可能过于夸张，不适合部分公共场景" },
    { user: "对前中缝压力和面料位置敏感的女性", scenario: localizedBrief.whyContinue.scenarios[1], trigger: "活动时前中缝或裆部结构发生位移", pain: localizedBrief.whyContinue.painPoints[2], outcome: "长时间穿着仍保持稳定和舒适", alternative: localizedBrief.whyContinue.currentAlternatives[2], gap: "缝线表现会随体型和尺码变化" },
    { user: "希望从健身直接过渡到日常活动的消费者", scenario: localizedBrief.whyContinue.scenarios[1], trigger: "纯健身服缺少日常实用性", pain: "希望一件紧身裤覆盖训练和日常任务", outcome: "兼顾造型、稳定腰头与实用收纳", alternative: "分别准备健身裤和日常下装", gap: "需要换装，随身物品收纳有限" },
    { user: localizedBrief.whyContinue.users[2], scenario: localizedBrief.whyContinue.scenarios[2], trigger: "通用尺码表无法反映不同身材比例", pain: localizedBrief.whyContinue.painPoints[3], outcome: "获得清晰测量、多体型实穿和友好换码支持", alternative: localizedBrief.whyContinue.currentAlternatives[3], gap: "缺少裤长和真实体型适配证据" },
  ];
  const supplyZh: Record<string, { name: string; description: string }> = {
    "SUP-001": { name: "中高克重弹性面料候选", description: "用于验证不透、回弹和洗后稳定性的尼龙或聚酰胺弹性面料候选。" },
    "SUP-002": { name: "低存在感自然塑形缝", description: "在避免明显褶皱和夸张提臀外观的前提下提供自然塑形。" },
    "SUP-003": { name: "无前中缝结构", description: "用于降低前中缝压迫、摩擦和卡裆风险的候选结构。" },
    "SUP-004": { name: "稳定高腰腰头", description: "需要验证卷边、下滑、压迫和活动后复位表现。" },
    "SUP-005": { name: "低存在感侧袋", description: "在不破坏轮廓的前提下，为训练到日常场景提供收纳。" },
    "SUP-006": { name: "小个子与高个子裤长", description: "将腰臀尺码与裤长组合，避免使用单一通用裤长。" },
    "SUP-007": { name: "多体型版型证明", description: "记录不同体型和尺码的实穿照片与关键测量。" },
    "SUP-008": { name: "深蹲、洗涤和腰头测试内容", description: "形成可重复审计的不透、回弹、缝线与腰头移动记录。" },
    "SUP-009": { name: "友好换码服务", description: "用清晰测量说明和有限换码政策降低线上选码焦虑。" },
    "SUP-010": { name: "可买样的 90/10 面料候选款", description: "仅代表公开供应商提供的候选样品，不等同于目标款或正式报价。" },
  };
  const constraintZh = [
    "美国服装标签要求必须在上架前满足。",
    "健康、循环、橘皮、临床和永久改变身形等声明必须有充分依据。",
    "目标款的实物性能尚未验证。",
    "正式目标款单位经济尚不可计算。",
    "尚未提供现有内容资产清单。",
    "尚未验证供应商合作关系。",
    "当前禁止付费广告测试。",
    "不应默认必须复制最明显的提臀褶皱结构。",
    "不应在版型验证前扩展大量颜色、尺码和款式。",
    "不应依赖夸张身体改变声明支撑独立站价格。",
  ];
  const opportunityZh: Record<string, { title: string; concept: string; customer: string; scenario: string; value: string; differentiation: string[]; nonGoals: string[]; assumptions: string[]; risks: string[]; rationale: string }> = {
    "OPP-001": {
      title: localizedBrief.recommendation.title,
      concept: localizedBrief.recommendation.productConcept,
      customer: localizedBrief.recommendation.targetCustomer,
      scenario: localizedBrief.recommendation.targetScenario,
      value: localizedBrief.recommendation.coreValue,
      differentiation: localizedBrief.mustHave.slice(0, 4),
      nonGoals: localizedBrief.mustNotHave.marketingClaims,
      assumptions: ["自然塑形偏好足以支撑一个聚焦产品方向", "实物证明可以支撑 39 至 49 美元价格带", "现有候选样品能够满足目标结构"],
      risks: localizedBrief.whyContinue.majorUnknowns.slice(0, 3),
      rationale: localizedBrief.recommendation.whyFirst,
    },
    "OPP-002": {
      title: "健身到日常的实用塑形款",
      concept: "采用克制塑形结构和低存在感侧袋，同时覆盖训练与日常活动。",
      customer: "比起强压缩，更看重多场景穿着和实用收纳的运动服消费者。",
      scenario: "训练结束后直接通勤、购物或处理日常事务。",
      value: "一条兼顾活动表现、自然修饰和日常实用性的紧身裤。",
      differentiation: ["低存在感收纳", "克制的塑形外观", "不局限于健身房的日常穿着表达"],
      nonGoals: ["不主打极限压缩", "不使用医疗化健康声明", "不假设所有用户都偏好口袋"],
      assumptions: ["多场景穿着是核心购买动机", "口袋不会破坏目标轮廓", "用户愿意接受更克制的塑形效果"],
      risks: ["缺少口袋需求的直接证据", "新增功能可能增加成本", "定位可能过于宽泛"],
      rationale: localizedBrief.recommendation.alternativesDeferred[0],
    },
    "OPP-003": {
      title: "小个子与高个子版型体系",
      concept: "提供不同裤长、清晰测量、无前中缝测试和友好换码说明的版型导向产品。",
      customer: "通用尺码和单一裤长无法良好覆盖的线上运动服消费者。",
      scenario: "无法试穿时在线选择紧身裤。",
      value: "通过测量和多体型示例，让不同身高与比例的消费者更可预测地选到合适版型。",
      differentiation: ["小个子与高个子裤长", "腰围、臀围和裤长说明", "多体型实穿记录", "友好换码流程"],
      nonGoals: ["首轮不扩展大量颜色", "不声称解决所有体型问题", "未验证尺码需求前不扩张库存"],
      assumptions: ["裤长不匹配是重要未满足需求", "供应商能够支持低 MOQ 裤长变体", "降低退货可抵消库存复杂度"],
      risks: ["SKU 数量快速增加", "缺少裤长需求的直接证据", "MOQ 和退货经济性未知"],
      rationale: localizedBrief.recommendation.alternativesDeferred[1],
    },
  };
  const supplyGroups = Object.entries(
    bundle.supply_atoms.reduce<Record<string, FirstPrinciplesBundle["supply_atoms"]>>((groups, atom) => {
      (groups[atom.category] ??= []).push(atom);
      return groups;
    }, {}),
  );
  const constraints = [
    ["硬约束", bundle.constraints.hard],
    ["软约束", bundle.constraints.soft],
    ["伪约束", bundle.constraints.pseudo],
  ] as const;

  return (
    <>
      <div className="topbar">
        <div>
          <span className="plain-badge">高级审计视图</span>
          <h1 className="title">第一性原理机会重构</h1>
          <p className="subtitle">{productNameZh(bundle.product)} · {bundle.market} · {bundle.run_id}</p>
        </div>
        <span className="live-badge"><Lightbulb size={14} />SACL</span>
      </div>

      <nav className="tabs" aria-label="研究视图">
        <Link href={`/research/${bundle.run_id}`}>真实研究</Link>
        <Link className="active" href={`/research/${bundle.run_id}/first-principles`}>第一性原理</Link>
        <Link href={`/research/${bundle.run_id}/commercial-intelligence`}>商业洞察</Link>
        <Link href={`/research/${bundle.run_id}/decision`}>决策边界</Link>
      </nav>

      <section>
        <div className="section-heading">
          <div><h2>问题重构</h2><p>从表面商品转向用户、场景、结果与付费理由。</p></div>
        </div>
        <div className="card problem-reframe">
          <span className="plain-badge">原问题：要不要卖热门提臀褶皱紧身裤？</span>
          <h3>如何让美国女性在深蹲训练和日常活动中，兼顾自然塑形、不透、稳定版型与舒适感，同时减少对夸张造型和未经证明身体改变声明的担忧？</h3>
          <div className="reframe-grid">
            <p><strong>目标用户</strong>{localizedBrief.recommendation.targetCustomer}</p>
            <p><strong>触发场景</strong>{localizedBrief.recommendation.targetScenario}</p>
            <p><strong>期望结果</strong>{localizedBrief.recommendation.coreValue}</p>
            <p><strong>付费理由</strong>{localizedBrief.recommendation.whyFirst}</p>
          </div>
        </div>
      </section>

      {vocSummary ? (
        <section className="section-stack">
          <div className="section-heading">
            <div><h2>用户之声证据</h2><p>评论级观察独立于文档结论；仅用于校准需求、痛点与替代方案。</p></div>
            <span className="plain-badge">可信度：{statusZh(localizedBrief.voiceOfCustomer.confidence.toLowerCase())}</span>
          </div>
          <div className="evidence-metrics">
            <div><span>有效观察</span><strong>{localizedBrief.voiceOfCustomer.validObservations}</strong></div>
            <div><span>负面或中性</span><strong>{localizedBrief.voiceOfCustomer.negativeOrNeutral}</strong></div>
            <div><span>正向或反证</span><strong>{localizedBrief.voiceOfCustomer.positiveOrCounterevidence}</strong></div>
            <div><span>来源族</span><strong>{localizedBrief.voiceOfCustomer.sourceFamilyCount}</strong></div>
          </div>
          <p>{localizedBrief.voiceOfCustomer.confidenceRationale}</p>
          <div className="brief-two-column">
            <div>
              <h3>主要痛点</h3>
              <ul className="list">{localizedBrief.voiceOfCustomer.topPainPoints.map((item) => <li key={item.theme}>{item.theme}：{item.count}/{item.denominator} · {item.sourceFamilies.join("、")}</li>)}</ul>
            </div>
            <div>
              <h3>正向与反证</h3>
              <ul className="list">{localizedBrief.voiceOfCustomer.counterevidence.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
          <p><strong>边界：</strong>这些观察均为竞品或品类经验，不验证目标款。亚马逊评论级证据：{localizedBrief.voiceOfCustomer.amazonCommentLevelEvidence ? "已取得" : "未取得"}。</p>
        </section>
      ) : null}

      <section className="section-stack">
        <h2>事实 / 假设 / 未知</h2>
        <div className="reasoning-grid">
          <ReasoningColumn title="事实" icon={<CheckCircle2 size={17} />} items={bundle.fact_hypothesis_unknown.facts} statements={factsZh} />
          <ReasoningColumn title="假设" icon={<FlaskConical size={17} />} items={bundle.fact_hypothesis_unknown.hypotheses} statements={hypothesesZh} />
          <ReasoningColumn title="未知" icon={<CircleHelp size={17} />} items={bundle.fact_hypothesis_unknown.unknowns} statements={unknownsZh} />
        </div>
      </section>

      <section className="section-stack">
        <h2>需求原子图谱</h2>
        <div className="atom-list">
          {bundle.demand_atoms.map((atom, index) => (
            <div className="atom-row" key={atom.id}>
              <strong>{atom.id}</strong>
              <div><b>{demandZh[index].user}</b><span>{demandZh[index].scenario}</span></div>
              <div><b>触发因素</b><span>{demandZh[index].trigger}</span></div>
              <div><b>痛点 / 任务</b><span>{demandZh[index].pain}</span></div>
              <div><b>期望结果</b><span>{demandZh[index].outcome}</span></div>
              <div><b>当前替代方案</b><span>{demandZh[index].alternative}</span></div>
              <div><b>替代方案缺口</b><span>{demandZh[index].gap}</span></div>
              <span className={atom.evidence_status === "supported" ? "status-badge" : "plain-badge"}>{statusZh(atom.evidence_status)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section-stack">
        <h2>供给原子库</h2>
        <div className="supply-groups">
          {supplyGroups.map(([category, atoms]) => (
            <div className="supply-group" key={category}>
              <h3>{supplyCategoryZh(category)}</h3>
              <div className="grid cols-3">
                {atoms.map((atom) => (
                  <div className="card supply-card" key={atom.id}>
                    <div><span className="plain-badge">{statusZh(atom.customization_level)}</span><strong>{atom.id}</strong></div>
                    <h3>{supplyZh[atom.id]?.name}</h3>
                    <p>{supplyZh[atom.id]?.description}</p>
                    <small>成本信息：{statusZh(atom.cost_visibility)} · {atom.independently_sourceable ? "可独立采购" : "需组合采购"}</small><br />
                    <small>{atom.target_sku_verified ? "目标 SKU 已验证" : "候选供给，未验证目标 SKU"}</small>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-stack">
        <h2>约束图谱</h2>
        <div className="grid cols-3">
          {constraints.map(([label, items]) => (
            <div className="constraint-column" key={label}>
              <h3>{label}</h3>
              {items.map((item) => {
                const allConstraints = [...bundle.constraints.hard, ...bundle.constraints.soft, ...bundle.constraints.pseudo];
                const localized = constraintZh[allConstraints.findIndex((candidate) => candidate.id === item.id)];
                return (
                <div className="constraint-item" key={item.id}>
                  <strong>{item.id} · {localized}</strong>
                  <p>该约束会直接影响产品设计、验证顺序或当前行动权限。</p>
                  <small>设计响应：按买样前简报中的对应要求执行，未取得证据前保持当前边界。</small>
                  <small>可信度：{statusZh(item.confidence)} · 结论编号：{item.supporting_claim_ids.join(", ") || "无"}</small>
                </div>
              )})}
            </div>
          ))}
        </div>
      </section>

      <section className="section-stack">
        <div className="section-heading">
          <div><h2>机会组合</h2><p>候选机会保持差异化，并以八个维度显式评分。</p></div>
        </div>
        <div className="opportunity-list">
          {bundle.opportunity_hypotheses.map((opportunity) => {
            const localized = opportunityZh[opportunity.id] ?? {
              title: localizedBrief.recommendation.title,
              concept: localizedBrief.recommendation.productConcept,
              customer: localizedBrief.recommendation.targetCustomer,
              scenario: localizedBrief.recommendation.targetScenario,
              value: localizedBrief.recommendation.coreValue,
              differentiation: localizedBrief.mustHave,
              nonGoals: localizedBrief.mustNotHave.marketingClaims,
              assumptions: ["仍有关键假设需要验证"],
              risks: localizedBrief.whyContinue.majorUnknowns,
              rationale: localizedBrief.recommendation.whyFirst,
            };
            return (
            <article className={opportunity.id === bundle.recommended_opportunity_id ? "opportunity recommended" : "opportunity"} key={opportunity.id}>
              <header>
                <div><span className="plain-badge">{opportunity.id}</span><h3>{localized.title}</h3></div>
                <strong className="opportunity-score">{opportunity.score}<small>/100</small></strong>
              </header>
              <p><strong>目标用户 / 场景：</strong>{localized.customer} / {localized.scenario}</p>
              <p><strong>产品 / 商品方案：</strong>{localized.concept}</p>
              <p>{localized.value}</p>
              <p><strong>需求 / 供给编号：</strong>{opportunity.target_demand_atom_ids.join(", ")} → {opportunity.supply_atom_ids.join(", ")}</p>
              <div className="score-grid">
                {Object.entries(opportunity.scores).map(([key, value]) => (
                  <div key={key}><span>{scoreLabels[key as keyof OpportunityHypothesis["scores"]]}</span><strong>{value.score ?? "暂无"}</strong></div>
                ))}
              </div>
              <p><strong>差异化：</strong>{localized.differentiation.join("；")}</p>
              <p><strong>明确不做：</strong>{localized.nonGoals.join("；")}</p>
              <p><strong>未验证假设：</strong>{localized.assumptions.join("；")}</p>
              <p><strong>主要风险：</strong>{localized.risks.join("；")}</p>
              <p><strong>证据强度：</strong>{statusZh(opportunity.evidence_strength)} · {localized.rationale}</p>
            </article>
          )})}
        </div>
      </section>

      <section className="section-stack">
        <h2>推荐机会</h2>
        <div className="recommendation-band">
          <Lightbulb size={22} />
          <div>
            <h3>{localizedBrief.recommendation.title}</h3>
            <p>{localizedBrief.recommendation.whyFirst}</p>
            <p><strong>为什么不是其他方向：</strong>{localizedBrief.recommendation.alternativesDeferred.join("；")}</p>
            <p><strong>进入下一阶段：</strong>{localizedBrief.nextStageRequirements.join("；")}</p>
          </div>
        </div>
      </section>

      <section className="section-stack">
        <h2>7–14 天验证计划</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>实验</th><th>方法</th><th>范围</th><th>天数</th><th>预算上限</th><th>指标</th><th>通过</th><th>失败 / 停止</th><th>后续动作</th></tr></thead>
            <tbody>
              {bundle.validation_plan.map((experiment) => {
                const localized = localizedBrief.validationSteps.find((item) => item.internalType === experiment.test_type);
                return (
                <tr key={experiment.id}>
                  <td><strong>{experiment.id}</strong><br />{validationTypeZh(experiment.test_type)}</td>
                  <td>{validationTypeZh(experiment.test_type)}<br /><small>{localized?.method}</small></td>
                  <td>{localized?.scope}</td>
                  <td>{experiment.duration_days}</td>
                  <td>{validationBudgetZh(experiment.test_type)}</td>
                  <td>{localized?.metric}</td>
                  <td>{localized?.pass}</td>
                  <td>{localized?.fail}<br /><small>{localized?.stop}</small></td>
                  <td>通过：{localized?.nextIfPass}<br />失败：{localized?.nextIfFail}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-stack">
        <h2>决策边界</h2>
        <div className="decision-boundary-grid">
          <div className="card metric"><span>产品方向决策</span><strong>{statusZh(bundle.decision_summary.product_selection_decision)}</strong></div>
          <div className="card metric hold-card"><span>正式目标款决策</span><strong>{statusZh(bundle.decision_summary.formal_sku_decision)}</strong></div>
          <div className="action-card disabled">
            <div className="action-card-title"><span>商品上架 / 广告测试</span><span className="blocked-badge"><Ban size={14} />禁止</span></div>
            <p>{localizedBrief.scopeNotice}</p>
          </div>
        </div>
        <div className="callout boundary-note"><ShieldAlert size={18} /><span>第一性原理推荐只决定下一步验证方向，不会解锁正式目标款、商品上架或广告测试。</span></div>
      </section>
    </>
  );
}
