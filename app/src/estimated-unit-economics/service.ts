import type { PriceRange } from "../report/price-anchors";
import { validateEstimatedUnitEconomicsModel } from "./validation";
import type { EstimatedEconomicsScenario, EstimatedUnitEconomicsModel } from "./types";

export type EstimatedEconomicsCostCoverage = {
  supplierCost: number | null;
  packagingCost: number | null;
  domesticShipping: number | null;
  internationalShipping: number | null;
  unlistedDutyAndClearance: number | null;
  paymentFee: number | null;
  refundReserve: number | null;
  chargebackReserve: number | null;
  defectAndReshipCost: number | null;
  otherVariableCost: number | null;
};

type BuildEstimatedUnitEconomicsInput = {
  runId: string;
  generatedAt: string;
  priceRange: PriceRange | null;
  formalScenarioCount: number;
  costCoverage: EstimatedEconomicsCostCoverage | null;
};

type ScenarioProfile = {
  key: EstimatedEconomicsScenario["key"];
  label: string;
  price: number;
  paymentRate: number;
  paymentFixed: number;
  refundRate: number;
  chargebackRate: number;
  defectRate: number;
  otherVariableCost: number;
  targetRoas: number;
  targetContributionMargin: number;
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const round4 = (value: number): number => Math.round((value + Number.EPSILON) * 10000) / 10000;
const percent = (value: number): string => `${Math.round(value * 100)}%`;

const scenarioFrom = (profile: ScenarioProfile): EstimatedEconomicsScenario => {
  const paymentCost = round2(profile.price * profile.paymentRate + profile.paymentFixed);
  const riskReserve = round2(profile.price * (profile.refundRate + profile.chargebackRate + profile.defectRate));
  const plannedCpaCap = round2(profile.price / profile.targetRoas);
  const targetContribution = round2(profile.price * profile.targetContributionMargin);
  const allowableLandedCost = round2(
    profile.price
      - paymentCost
      - riskReserve
      - profile.otherVariableCost
      - plannedCpaCap
      - targetContribution,
  );
  const allowableLandedCostRate = round4(allowableLandedCost / profile.price);
  const status = allowableLandedCost <= 0
    ? "not_workable" as const
    : allowableLandedCostRate < 0.2
      ? "tight" as const
      : "workable" as const;

  return {
    key: profile.key,
    label: profile.label,
    price: round2(profile.price),
    paymentCost,
    riskReserve,
    otherVariableCost: profile.otherVariableCost,
    plannedCpaCap,
    targetContribution,
    allowableLandedCost,
    allowableLandedCostRate,
    status,
    interpretation: status === "not_workable"
      ? "在这组售价和经营目标下，即使商品免费也无法覆盖准备金、获客和目标贡献利润。"
      : status === "tight"
        ? "总落地成本空间偏紧，供应商报价或物流稍有波动就可能吃掉目标贡献利润。"
        : `采购、包装、国内段、国际物流和税清合计应控制在 ${round2(allowableLandedCost)} 美元以内。`,
  };
};

export const buildEstimatedUnitEconomicsModel = ({
  runId,
  generatedAt,
  priceRange,
  formalScenarioCount,
  costCoverage,
}: BuildEstimatedUnitEconomicsInput): EstimatedUnitEconomicsModel | null => {
  if (!priceRange || priceRange.currencySymbol !== "$" || priceRange.low <= 0 || priceRange.high < priceRange.low) {
    return null;
  }

  const basePrice = round2((priceRange.low + priceRange.high) / 2);
  const profiles: ScenarioProfile[] = [
    {
      key: "defensive",
      label: "防守情景",
      price: priceRange.low,
      paymentRate: 0.04,
      paymentFixed: 0.3,
      refundRate: 0.18,
      chargebackRate: 0.015,
      defectRate: 0.05,
      otherVariableCost: 0.8,
      targetRoas: 2.5,
      targetContributionMargin: 0.1,
    },
    {
      key: "base",
      label: "基准情景",
      price: basePrice,
      paymentRate: 0.035,
      paymentFixed: 0.3,
      refundRate: 0.12,
      chargebackRate: 0.01,
      defectRate: 0.03,
      otherVariableCost: 0.5,
      targetRoas: 2.5,
      targetContributionMargin: 0.15,
    },
    {
      key: "target",
      label: "目标情景",
      price: priceRange.high,
      paymentRate: 0.03,
      paymentFixed: 0.3,
      refundRate: 0.08,
      chargebackRate: 0.0075,
      defectRate: 0.02,
      otherVariableCost: 0.4,
      targetRoas: 3,
      targetContributionMargin: 0.2,
    },
  ];
  const scenarios = profiles.map(scenarioFrom);
  const base = scenarios[1];
  const coverageEntries = costCoverage ? Object.entries(costCoverage) : [];
  const knownCostFields = coverageEntries
    .filter(([, value]) => value !== null)
    .map(([key]) => key);

  return validateEstimatedUnitEconomicsModel({
    schemaVersion: "1.0",
    runId,
    generatedAt,
    status: "planning_estimate",
    method: "reverse_landed_cost_ceiling",
    currency: "USD",
    currencySymbol: "$",
    headline: `按基准售价 ${priceRange.currencySymbol}${base.price} 反推，总落地成本应不高于 ${priceRange.currencySymbol}${base.allowableLandedCost}`,
    summary: "当前没有足够正式成本，模型不猜利润，而是先反推一单生意能够承受的成本上限，供询价、物流比较和买样决策使用。",
    formula: "可承受总落地成本 = 售价 − 支付费用 − 退款/拒付/瑕疵准备金 − 其他变动成本 − 目标获客成本 − 目标贡献利润",
    inputCoverage: {
      recommendedPriceAvailable: true,
      formalScenarioCount,
      knownCostFieldCount: knownCostFields.length,
      totalCostFieldCount: 10,
      knownCostFields,
      formalEconomicsProven: false,
    },
    assumptions: [
      {
        key: "recommended_price",
        label: "建议售价",
        value: base.price,
        formattedValue: `${priceRange.currencySymbol}${base.price}`,
        sourceKind: "recommended_price",
        rationale: "采用报告建议售价区间的中点作为基准情景，不代表真实成交价已经验证。",
      },
      {
        key: "target_roas",
        label: "目标 ROAS",
        value: 2.5,
        formattedValue: "2.5×",
        sourceKind: "planning_benchmark",
        rationale: "用于反推可承受获客成本的规划参数，需要在真实投放后替换。",
      },
      {
        key: "refund_reserve",
        label: "退款准备金",
        value: 0.12,
        formattedValue: percent(0.12),
        sourceKind: "planning_benchmark",
        rationale: "服饰类方向性压力测试参数，不是当前目标款已经发生的退款率。",
      },
      {
        key: "payment_cost",
        label: "支付费用",
        value: 0.035,
        formattedValue: "3.5% + $0.30",
        sourceKind: "planning_benchmark",
        rationale: "用于覆盖支付通道的方向性成本，正式费率需按实际渠道替换。",
      },
      {
        key: "risk_reserve",
        label: "拒付与瑕疵准备金",
        value: 0.04,
        formattedValue: "4%",
        sourceKind: "planning_benchmark",
        rationale: "基准情景合并 1% 拒付与 3% 瑕疵补发准备金，避免把未知风险按零处理。",
      },
      {
        key: "target_contribution_margin",
        label: "目标广告后贡献利润率",
        value: 0.15,
        formattedValue: "15%",
        sourceKind: "planning_benchmark",
        rationale: "保留一笔广告后的目标贡献利润，防止模型只追求账面盈亏平衡。",
      },
    ],
    scenarios,
    baseScenarioKey: "base",
    sensitivities: [
      {
        key: "roas_down",
        label: "投放效率下降",
        change: "目标 ROAS 2.5× → 2.0×",
        impactOnAllowableLandedCost: round2(-(base.price / 2 - base.price / 2.5)),
        interpretation: "获客成本上升会直接压缩同等金额的商品、包装与物流空间。",
      },
      {
        key: "refund_up",
        label: "退款压力上升",
        change: "退款准备金 +5 个百分点",
        impactOnAllowableLandedCost: round2(-(base.price * 0.05)),
        interpretation: "服饰尺码与版型问题会快速侵蚀成本上限，应优先用样品和尺码测试降低退款风险。",
      },
      {
        key: "margin_up",
        label: "利润目标提高",
        change: "目标贡献利润率 +5 个百分点",
        impactOnAllowableLandedCost: round2(-(base.price * 0.05)),
        interpretation: "希望每单多留利润，就必须同步压低采购、包装、物流与税清的总和。",
      },
    ],
    nextEvidence: [
      "取得至少两份同口径目标 SKU 报价，包含采购、包装、MOQ 与交期。",
      "确认国内段、国际物流、税费和清关是否已经包含在报价中。",
      "用真实支付费率、退款率、拒付率和瑕疵补发率替换规划参数。",
      "形成防守、基准和目标三套正式 CM1，并计算正式盈亏平衡 CPA 与 ROAS。",
    ],
    boundary: "这是买样前的方向性反推模型，不是利润预测；它不能证明目标 SKU 会以该售价成交，也不能替代正式报价、真实履约成本、退款数据和投放结果。",
  });
};

