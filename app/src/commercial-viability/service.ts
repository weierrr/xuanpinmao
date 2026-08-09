import type { FirstPrinciplesBundle, OpportunityHypothesis } from "../first-principles/types";
import {
  commercialViabilityCardSchema,
  type CommercialViabilityCard,
  type CommercialViabilityDimension,
} from "./types";

type BuildCommercialViabilityInput = {
  bundle: FirstPrinciplesBundle;
  economicsScenarioCount: number;
};

type OpportunityScore = OpportunityHypothesis["scores"][keyof OpportunityHypothesis["scores"]];

const evidenceRefs = (opportunity: OpportunityHypothesis, claimIds: string[]) => [
  { objectType: "opportunity" as const, id: opportunity.id },
  ...claimIds.map((id) => ({ objectType: "claim" as const, id })),
];

const scoreGate = (score: number | null): CommercialViabilityDimension["gateStatus"] => {
  if (score === null) return "blocked";
  if (score >= 70) return "positive";
  if (score >= 50) return "directional";
  return "blocked";
};

const scoreDimension = ({
  key,
  label,
  source,
  opportunity,
  positiveConclusion,
  directionalConclusion,
  blocker,
  nextAction,
}: {
  key: CommercialViabilityDimension["key"];
  label: string;
  source: OpportunityScore;
  opportunity: OpportunityHypothesis;
  positiveConclusion: string;
  directionalConclusion: string;
  blocker: string;
  nextAction: string;
}): CommercialViabilityDimension => {
  const gateStatus = scoreGate(source.score);
  return {
    key,
    label,
    scoreStatus: source.status,
    score: source.score,
    gateStatus,
    conclusion: gateStatus === "positive"
      ? positiveConclusion
      : gateStatus === "directional"
        ? directionalConclusion
        : blocker,
    rationale: source.rationale,
    blocker: gateStatus === "blocked" ? blocker : null,
    nextAction,
    evidenceRefs: evidenceRefs(opportunity, source.claim_ids),
  };
};

const decisionLabel = {
  STOP: "停止投入",
  RESEARCH_MORE: "补证后再判断",
  CONTROLLED_SAMPLE: "允许受控买样",
  COMMERCIAL_GO: "商业可行性已通过",
} as const;

export const buildCommercialViabilityCard = ({
  bundle,
  economicsScenarioCount,
}: BuildCommercialViabilityInput): CommercialViabilityCard | null => {
  const opportunity = bundle.opportunity_hypotheses.find(
    (item) => item.id === bundle.recommended_opportunity_id,
  );
  if (!opportunity) return null;

  const demand = scoreDimension({
    key: "demand",
    label: "需求成立度",
    source: opportunity.scores.demand_fit,
    opportunity,
    positiveConclusion: "当前证据足以支持明确需求方向。",
    directionalConclusion: "已经看到需求信号，但人群规模、频率或付费强度仍需补证。",
    blocker: "需求证据不足以支持继续投入。",
    nextAction: "用目标人群访谈、概念选择或真实行为数据验证需求强度。",
  });
  const differentiation = scoreDimension({
    key: "differentiation",
    label: "差异化成立度",
    source: opportunity.scores.differentiation,
    opportunity,
    positiveConclusion: "产品差异能被用户快速理解，并与现有替代方案拉开距离。",
    directionalConclusion: "方向具有可解释差异，但是否足以改变选择仍未验证。",
    blocker: "当前方向缺少足够差异，容易回到同质化竞争。",
    nextAction: "用盲测和三秒复述测试确认差异是否可见、可懂、值得选择。",
  });

  const targetSupplyAtoms = bundle.supply_atoms.filter((atom) => opportunity.supply_atom_ids.includes(atom.id));
  const verifiedSupplyCount = targetSupplyAtoms.filter((atom) => atom.target_sku_verified).length;
  const supplySource = opportunity.scores.supply_feasibility;
  const supplyGate = supplySource.status === "scored" && supplySource.score !== null
    ? scoreGate(supplySource.score)
    : "blocked";
  const supply: CommercialViabilityDimension = {
    key: "supply",
    label: "供应可实现性",
    scoreStatus: supplySource.status,
    score: supplySource.score,
    gateStatus: supplyGate,
    conclusion: supplyGate === "positive"
      ? "目标结构已有可比较供应方案，具备继续验证基础。"
      : supplyGate === "directional"
        ? "存在供应线索，但规格、报价、MOQ 或交付一致性仍未闭合。"
        : "没有正式目标供应商、可比规格和报价，供应可行性不能判断。",
    rationale: `${supplySource.rationale} 当前目标供应原子验证 ${verifiedSupplyCount}/${targetSupplyAtoms.length}。`,
    blocker: supplyGate === "blocked" ? "正式供应商、目标规格、报价、MOQ 与交期证据缺失。" : null,
    nextAction: "取得至少两份同口径供应商规格与报价包，再决定是否授权买样。",
    evidenceRefs: [
      { objectType: "opportunity", id: opportunity.id },
      ...targetSupplyAtoms.map((atom) => ({ objectType: "supply_atom" as const, id: atom.id })),
      ...supplySource.claim_ids.map((id) => ({ objectType: "claim" as const, id })),
    ],
  };

  const economicsSource = opportunity.scores.monetization_potential;
  const economicsGate = economicsSource.status === "scored"
    && economicsSource.score !== null
    && economicsScenarioCount > 0
    ? scoreGate(economicsSource.score)
    : "blocked";
  const unitEconomics: CommercialViabilityDimension = {
    key: "unit_economics",
    label: "单位经济",
    scoreStatus: economicsSource.status,
    score: economicsSource.score,
    gateStatus: economicsGate,
    conclusion: economicsGate === "positive"
      ? "正式成本情景支持正向贡献利润。"
      : economicsGate === "directional"
        ? "价格与成本存在初步空间，但保守情景仍需校准。"
        : "竞品售价不能代替目标款单位经济，当前无法判断正式盈利能力。",
    rationale: `${economicsSource.rationale} 当前正式单位经济情景 ${economicsScenarioCount} 个。`,
    blocker: economicsGate === "blocked" ? "采购、包装、物流、履约、退款和获客成本尚未形成完整情景。" : null,
    nextAction: "用正式报价建立悲观、基准和乐观三种 CM1 情景，并执行缺失字段停止规则。",
    evidenceRefs: [
      { objectType: "opportunity", id: opportunity.id },
      { objectType: "unit_economics", id: `${bundle.run_id}:scenarios:${economicsScenarioCount}` },
      ...economicsSource.claim_ids.map((id) => ({ objectType: "claim" as const, id })),
    ],
  };

  const risk = scoreDimension({
    key: "risk_control",
    label: "风险可控性",
    source: opportunity.scores.risk_exposure,
    opportunity,
    positiveConclusion: "主要质量、合规、退货和执行风险已有明确控制方式。",
    directionalConclusion: "风险已经被识别，但部分控制措施仍需要真实样品或运营数据。",
    blocker: "质量、合规、供应或退货风险仍可能推翻商业成立。",
    nextAction: "把高影响风险绑定到样品测试、合规文件和停止条件，逐项关闭。",
  });

  const dimensions = [demand, differentiation, supply, unitEconomics, risk];
  const decisiveBlockers = dimensions.flatMap((dimension) => dimension.blocker ? [dimension.blocker] : []);
  const productDecision = bundle.decision_summary.product_selection_decision;
  const formalDecision = bundle.decision_summary.formal_sku_decision;
  const allPositive = dimensions.every((dimension) => dimension.gateStatus === "positive");
  const decision = productDecision === "REJECT" || formalDecision === "REJECT"
    ? "STOP" as const
    : formalDecision === "GO" && allPositive
      ? "COMMERCIAL_GO" as const
      : productDecision === "PROCEED_TO_SAMPLE"
        ? "CONTROLLED_SAMPLE" as const
        : "RESEARCH_MORE" as const;
  const commercialViabilityProven = decision === "COMMERCIAL_GO";

  const allowedActions = decision === "STOP"
    ? ["只保留研究记录，不再追加供应、样品或营销投入。"]
    : decision === "COMMERCIAL_GO"
      ? ["在已验证的目标 SKU、市场、渠道和预算边界内执行商业动作。"]
      : decision === "CONTROLLED_SAMPLE"
        ? ["联系供应商并比较正式规格与报价。", "经人工授权后进行小规模买样和预注册测试。"]
        : ["补充需求与偏好证据。", "索取供应商规格和报价，但不付款下单。", "建立单位经济与风险验证方案。"];
  const blockedActions = commercialViabilityProven
    ? ["不得把通过结论扩展到未经验证的 SKU、渠道、市场或价格。"]
    : ["正式采购和大货承诺。", "正式上架。", "广告投放或放量。", "把竞品与心理证据写成目标 SKU 已验证性能。"];

  return commercialViabilityCardSchema.parse({
    schemaVersion: "1.0",
    runId: bundle.run_id,
    generatedAt: bundle.generated_at,
    decision,
    decisionLabel: decisionLabel[decision],
    commercialViabilityProven,
    summary: commercialViabilityProven
      ? "需求、差异化、供应、单位经济和风险控制均已跨过当前门槛。"
      : decision === "CONTROLLED_SAMPLE"
        ? "方向值得进入受控买样，但商业可行性仍需由目标供应、样品和单位经济证明。"
        : decision === "STOP"
          ? "关键方向已被否决，继续投入缺少商业依据。"
          : "当前只能确认部分商业信号，决定性供应、成本或风险证据仍不足。",
    dimensions,
    evidenceCoverage: {
      assessedDimensions: dimensions.filter((dimension) => dimension.scoreStatus === "scored").length,
      totalDimensions: 5,
      positiveDimensions: dimensions.filter((dimension) => dimension.gateStatus === "positive").length,
      blockedDimensions: dimensions.filter((dimension) => ["blocked", "failed"].includes(dimension.gateStatus)).length,
    },
    decisiveBlockers,
    allowedActions,
    blockedActions,
    nextGateConditions: bundle.decision_summary.entry_conditions,
    boundary: "商业可行性卡只汇总当前 Run 已有证据，不用平均分掩盖未评分维度；任何上游通过都不能自动替代目标 SKU、正式报价、样品、合规和单位经济门禁。",
  });
};
