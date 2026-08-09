import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DemandFieldArtifact } from "../demand-field/types";
import { demandFieldArtifactSchema } from "../demand-field/types";
import { demandFieldPaths } from "../demand-field/service";
import { demandFieldTextZh } from "../demand-field/presentation";
import { readConsumerDecisionChain } from "../consumer-psychology/service";
import type {
  ConsumerDecisionChainArtifact,
  ConsumerDecisionStage,
} from "../consumer-psychology/types";
import type { FirstPrinciplesBundle } from "../first-principles/types";
import { readFirstPrinciplesBundle } from "../first-principles/service";
import type { PreSampleDecisionBrief } from "../pre-sample/types";
import { buildPreSampleDecisionBrief, writePreSampleDecisionBrief } from "../pre-sample/service";
import { readEvidencePackage } from "../research/evidence-package";
import { generateLiveResearchReports } from "../research/live-report";
import { liveAnalysisSchema, type LiveResearchAnalysis, type ResearchClaim } from "../research/live-types";
import { liveResearchPaths, readLiveResearchArtifacts } from "../research/live-research";
import {
  marketingTranslationSchema,
  type MarketingDecisionChain,
  type MarketingDecisionRole,
  type MarketingEvidenceRef,
  type MarketingTranslation,
} from "./types";

const uniqueRefs = (refs: MarketingEvidenceRef[]): MarketingEvidenceRef[] => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.objectType}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const standardProhibitedClaims = () => [
  {
    claim: "医疗、改善循环、治疗或健康效果",
    reason: "当前运行没有目标商品的临床或科学实证。",
    category: "medical" as const,
    evidenceStatus: "prohibited" as const,
  },
  {
    claim: "永久效果、绝对效果或保证结果",
    reason: "没有目标商品的长期、重复且适用于当前使用条件的证据时，不得承诺永久或绝对结果。",
    category: "permanent_effect" as const,
    evidenceStatus: "prohibited" as const,
  },
  {
    claim: "未经核验的认证、专利、性能数字或限量稀缺性",
    reason: "认证、专利、数字性能和稀缺性必须逐项取得可审计证据。",
    category: "target_sku_unverified" as const,
    evidenceStatus: "prohibited" as const,
  },
];

type ProductTranslationInput = {
  analysis: LiveResearchAnalysis;
  claims: ResearchClaim[];
  brief: PreSampleDecisionBrief;
  firstPrinciples?: FirstPrinciplesBundle;
  demandField?: DemandFieldArtifact | null;
  consumerPsychology?: ConsumerDecisionChainArtifact | null;
  now?: Date;
};

const firstAvailableRef = (claims: ResearchClaim[]): MarketingEvidenceRef => ({
  objectType: "claim",
  id: claims[0]?.id ?? "UNRESOLVED-EVIDENCE",
});
const phrase = (value: string): string => demandFieldTextZh(value).replace(/[。！？.!?]+$/u, "");
const scenarioContext = (value: string): string => phrase(value).replace(/^在/u, "");
const decisionPhrase = (value: string): string => phrase(value)
  .replace(/^可观察到的一类理想状态是[:：]?/u, "")
  .replace(/^拟议产品最容易被理解的改变不是[^，,]+[，,]而是/u, "")
  .replace(/^部分用户真正想避免的不是[^，,]+[，,]而是/u, "");

const psychologyStatusRank = {
  prohibited: 0,
  hypothesis: 1,
  directional: 2,
  supported: 3,
} as const;

const weakestPsychologyStatus = (stages: ConsumerDecisionStage[]) =>
  stages.reduce<ConsumerDecisionStage["evidence_status"]>(
    (weakest, stage) => psychologyStatusRank[stage.evidence_status] < psychologyStatusRank[weakest]
      ? stage.evidence_status
      : weakest,
    "supported",
  );

const activeMarketingStatus = (
  status: ConsumerDecisionStage["evidence_status"],
): "supported" | "directional" | "hypothesis" => {
  if (status === "prohibited") {
    throw new Error("A prohibited consumer-psychology stage cannot generate marketing copy");
  }
  return status;
};

const psychologyRefs = (stages: ConsumerDecisionStage[]): MarketingEvidenceRef[] =>
  stages.map((stage) => ({ objectType: "consumer_psychology_stage" as const, id: stage.id }));

const psychologyStagesByMarketingRole: Record<MarketingDecisionRole, Set<ConsumerDecisionStage["stage"]>> = {
  hook: new Set(["situational_trigger", "tension_activation"]),
  promise: new Set(["identity_projection", "outcome_imagination"]),
  proof: new Set(["belief_formation"]),
  offer: new Set(["risk_reduction"]),
  cta: new Set(["risk_reduction"]),
};

const requiredMarketingMapping = (
  chain: MarketingDecisionChain,
  role: MarketingDecisionRole,
) => {
  const mapping = chain.mappings.find((item) => item.role === role);
  if (!mapping) throw new Error(`Marketing decision-chain mapping ${role} is required`);
  return mapping;
};

const buildPsychologyMarketingBridge = (
  artifact: ConsumerDecisionChainArtifact,
): MarketingDecisionChain => {
  const byStage = new Map(artifact.stages.map((stage) => [stage.stage, stage]));
  const requireStages = (...stageNames: ConsumerDecisionStage["stage"][]) => stageNames.map((stageName) => {
    const stage = byStage.get(stageName);
    if (!stage) throw new Error(`Consumer psychology stage ${stageName} is required for marketing translation`);
    return stage;
  });
  const mapping = (
    role: MarketingDecisionRole,
    stages: ConsumerDecisionStage[],
    expression: string,
  ) => ({
    role,
    expression,
    sourceStageIds: stages.map((stage) => stage.id),
    evidenceStatus: activeMarketingStatus(weakestPsychologyStatus(stages)),
    evidenceRefs: psychologyRefs(stages),
    validationNeeded: [...new Set(stages.flatMap((stage) => stage.validation_needed))],
  });
  const hookStages = requireStages("situational_trigger", "tension_activation");
  const promiseStages = requireStages("identity_projection", "outcome_imagination");
  const proofStages = requireStages("belief_formation");
  const offerStages = requireStages("risk_reduction");
  return {
    sourceArtifact: "consumer_psychology_decision_chain",
    sourceGeneratedAt: artifact.generated_at,
    mappings: [
      mapping("hook", hookStages, `触发场景：${decisionPhrase(hookStages[0].conclusion)}。核心张力：${decisionPhrase(hookStages[1].conclusion)}。`),
      mapping("promise", promiseStages, `理想呈现：${decisionPhrase(promiseStages[0].conclusion)}。可感知结果：${decisionPhrase(promiseStages[1].conclusion)}。`),
      mapping("proof", proofStages, `可信证明：${decisionPhrase(proofStages[0].conclusion)}。`),
      mapping("offer", offerStages, `风险逆转：${decisionPhrase(offerStages[0].conclusion)}。`),
      mapping("cta", offerStages, "先查看证明与试错边界，再决定是否参与验证或试穿。"),
    ],
    boundary: `${artifact.overall_boundary} 营销表达不得比其来源心理节点拥有更高的证据等级。`,
  };
};

export const buildProductMarketingTranslation = ({
  analysis,
  claims,
  brief,
  firstPrinciples,
  demandField,
  consumerPsychology,
  now = new Date(),
}: ProductTranslationInput): MarketingTranslation => {
  const ready = analysis.actionBoundary.listingAllowed && analysis.actionBoundary.adTestAllowed;
  const status = ready ? "ready_for_use" as const : "draft_for_validation" as const;
  const demandAtoms = firstPrinciples?.demand_atoms.slice(0, 4) ?? [];
  const fallbackRef = firstAvailableRef(claims);
  const decisionChain = consumerPsychology
    ? buildPsychologyMarketingBridge(consumerPsychology)
    : undefined;
  const pillarCount = Math.max(2, Math.min(4, demandAtoms.length || brief.mustHave.length));
  const legacyMessagePillars = Array.from({ length: pillarCount }, (_, index) => {
    const atom = demandAtoms[index];
    const claimIds = atom?.supporting_claim_ids.filter((id) => claims.some((claim) => claim.id === id)) ?? [];
    const refs = uniqueRefs([
      ...(atom ? [{ objectType: "demand_atom" as const, id: atom.id }] : []),
      ...claimIds.map((id) => ({ objectType: "claim" as const, id })),
      ...(demandField?.need_atoms[index]
        ? [{ objectType: "demand_field_need" as const, id: demandField.need_atoms[index].id }]
        : []),
    ]);
    const productSellingPoint = phrase(brief.mustHave[index % brief.mustHave.length] ?? brief.recommendation.productConcept);
    const useScenario = phrase(brief.whyContinue.scenarios[index % Math.max(brief.whyContinue.scenarios.length, 1)]
      ?? atom?.scenario
      ?? brief.recommendation.targetScenario);
    const pain = phrase(brief.whyContinue.painPoints[index % Math.max(brief.whyContinue.painPoints.length, 1)]
      ?? atom?.pain_or_job
      ?? "目标用户仍存在未解决的使用顾虑");
    const evidenceStatus = ready && atom?.evidence_status === "supported"
      ? "supported" as const
      : atom?.evidence_status === "hypothesis"
        ? "hypothesis" as const
        : "directional" as const;
    return {
      id: `MSG-${String(index + 1).padStart(2, "0")}`,
      productSellingPoint,
      customerBenefit: atom ? phrase(atom.desired_outcome) : `降低“${pain}”带来的购买和使用顾虑`,
      useScenario,
      emotionalValue: `减少“${pain}”带来的不确定感，让用户在该场景中更安心。`,
      marketingCopy: `${productSellingPoint}，帮助目标用户在${scenarioContext(useScenario)}获得更安心、可控的体验。`,
      evidenceStatus,
      evidenceRefs: refs.length > 0 ? refs : [fallbackRef],
      supportingClaimIds: claimIds,
      validationNeeded: [
        "用目标样品验证该卖点，而不是沿用竞品表述。",
        ready ? "持续监控用户反馈与退货原因。" : analysis.actionBoundary.reason,
      ],
    };
  });
  const psychologyPillarRoles = ["promise", "proof", "offer"] as const;
  const psychologyMessagePillars = decisionChain && consumerPsychology
    ? psychologyPillarRoles.map((role, index) => {
      const mapping = requiredMarketingMapping(decisionChain, role);
      const sourceStages = consumerPsychology.stages.filter((stage) => mapping.sourceStageIds.includes(stage.id));
      const claimIds = [...new Set(sourceStages.flatMap((stage) => stage.supporting_claim_ids))]
        .filter((id) => claims.some((claim) => claim.id === id));
      const atomIds = [...new Set(sourceStages.flatMap((stage) => stage.supporting_demand_atom_ids))];
      const refs = uniqueRefs([
        ...mapping.evidenceRefs,
        ...claimIds.map((id) => ({ objectType: "claim" as const, id })),
        ...atomIds.map((id) => ({ objectType: "demand_atom" as const, id })),
      ]);
      const productSellingPoint = phrase(
        brief.mustHave[index % Math.max(brief.mustHave.length, 1)]
          ?? brief.recommendation.productConcept,
      );
      return {
        id: `MSG-${String(index + 1).padStart(2, "0")}`,
        productSellingPoint,
        customerBenefit: mapping.expression,
        useScenario: phrase(consumerPsychology.stages[0]?.conclusion ?? brief.recommendation.targetScenario),
        emotionalValue: phrase(consumerPsychology.stages[2]?.conclusion ?? brief.recommendation.coreValue),
        marketingCopy: mapping.expression,
        evidenceStatus: ready && mapping.evidenceStatus === "supported"
          ? "supported" as const
          : mapping.evidenceStatus === "supported"
            ? "directional" as const
            : mapping.evidenceStatus,
        evidenceRefs: refs.length > 0 ? refs : [fallbackRef],
        supportingClaimIds: claimIds,
        validationNeeded: [...new Set([
          ...mapping.validationNeeded,
          "用目标样品验证产品表达，不把心理解释当作目标 SKU 性能。",
          ready ? "持续监控用户反馈与退货原因。" : analysis.actionBoundary.reason,
        ])],
        decisionRole: role,
      };
    })
    : null;
  const messagePillars = psychologyMessagePillars ?? legacyMessagePillars;
  const primaryRefs = messagePillars[0]?.evidenceRefs ?? [fallbackRef];
  const draft = (
    text: string,
    evidenceStatus: "supported" | "directional" | "hypothesis" = "directional",
    evidenceRefs = primaryRefs,
    decisionRole?: MarketingDecisionRole,
  ) => ({
    status,
    text,
    evidenceStatus: ready ? evidenceStatus : evidenceStatus === "supported" ? "directional" as const : evidenceStatus,
    evidenceRefs,
    ...(decisionRole ? { decisionRole } : {}),
  });
  const psychologyMapping = (role: MarketingDecisionRole) =>
    decisionChain?.mappings.find((item) => item.role === role);
  const expression = psychologyMapping("promise")?.expression ?? brief.recommendation.coreValue;
  const channelPillars = Array.from({ length: Math.max(3, messagePillars.length) }, (_, index) =>
    messagePillars[index % messagePillars.length]);
  const channelRoleMappings = decisionChain
    ? (["hook", "promise", "proof"] as const).map((role) => requiredMarketingMapping(decisionChain, role))
    : null;
  const prohibitedClaims = [
    ...standardProhibitedClaims(),
    ...brief.mustNotHave.marketingClaims.slice(0, 4).map((claim) => ({
      claim,
      reason: "当前目标 SKU 与 Claim 证据尚未完成验证。",
      category: "target_sku_unverified" as const,
      evidenceStatus: "prohibited" as const,
    })),
  ];
  const experiments = [
    {
      id: "MKT-EXP-01",
      type: "landing_page_concept_test" as const,
      name: "落地页概念测试",
      keyHypothesis: "目标用户能理解并偏好当前价值主张。",
      marketingExpression: expression,
      targetAudience: brief.recommendation.targetCustomer,
      metric: "概念选择率与有效留资率",
      passThreshold: "目标概念选择率达到 35%，且有效留资率达到 8%。",
      failThreshold: "目标概念选择率低于 20%，或反馈无法复述核心价值。",
      stopCondition: "样本不足 30 人，或流量明显偏离目标人群时停止解释结果。",
      nextIfPass: "进入样品和 Claim 验证，不开放正式上架。",
      nextIfFail: "重写价值主张或放弃该消息方向。",
    },
    {
      id: "MKT-EXP-02",
      type: "ad_angle_test" as const,
      name: "广告角度测试",
      keyHypothesis: "至少一个消息支柱能稳定获得目标人群关注。",
      marketingExpression: messagePillars.map((item) => item.marketingCopy).join(" / "),
      targetAudience: brief.recommendation.targetCustomer,
      metric: "同受众下的点击率与落地页停留",
      passThreshold: "优胜角度点击率至少高于基准 20%，且停留不下降。",
      failThreshold: "所有角度均未达到基准，或点击后快速退出明显增加。",
      stopCondition: "单角度达到预设小额预算上限且无方向性信号时停止。",
      nextIfPass: "保留优胜角度并进入 Claim 审核。",
      nextIfFail: "回到用户问题与场景，不扩大投放。",
    },
    {
      id: "MKT-EXP-03",
      type: "price_value_test" as const,
      name: "价格与价值主张测试",
      keyHypothesis: "价值主张足以支撑建议价格带，而非仅靠低价。",
      marketingExpression: `${expression} / ${analysis.positioning.recommendedPriceRange}`,
      targetAudience: brief.recommendation.targetCustomer,
      metric: "不同价格锚点下的选择率与购买意愿",
      passThreshold: "中位价格锚点的购买意愿不低于低价锚点的 80%。",
      failThreshold: "购买意愿只在最低价出现，且价值理由无法被复述。",
      stopCondition: "正式落地成本未知时，不把结果解释为盈利成立。",
      nextIfPass: "待单位经济完成后再校准正式价格。",
      nextIfFail: "降低成本假设或增强可感知差异，不直接降价上线。",
    },
    {
      id: "MKT-EXP-04",
      type: "user_interview" as const,
      name: "目标用户访谈",
      keyHypothesis: "产品结构、利益和情绪价值符合真实任务语言。",
      marketingExpression: messagePillars.map((item) => item.marketingCopy).join(" / "),
      targetAudience: brief.recommendation.targetCustomer,
      metric: "问题复现率、概念理解率和反对理由",
      passThreshold: "至少 5/8 名合格受访者复现核心问题，且 4/8 愿意进一步测试。",
      failThreshold: "少于 3/8 复现问题，或多数认为产品结构无必要。",
      stopCondition: "受访者不属于目标场景时停止累计样本。",
      nextIfPass: "把用户原话转为下一版概念，但仍保留证据标签。",
      nextIfFail: "修正目标细分人群或终止概念。",
    },
    {
      id: "MKT-EXP-05",
      type: "content_engagement_test" as const,
      name: "内容点击或保存率测试",
      keyHypothesis: "场景化内容钩子比泛品类内容更能引发保存或点击。",
      marketingExpression: messagePillars.map((item) => item.useScenario).join(" / "),
      targetAudience: brief.recommendation.targetCustomer,
      metric: "保存率、点击率和完整观看率",
      passThreshold: "至少一个钩子的保存率或点击率高于账号基准 20%。",
      failThreshold: "所有钩子连续两轮低于账号基准。",
      stopCondition: "平台分发不足以形成最低样本量时停止归因。",
      nextIfPass: "保留场景钩子，等待产品性能验证。",
      nextIfFail: "回到场景和痛点，而不是增加夸大承诺。",
    },
    {
      id: "MKT-EXP-06",
      type: "sample_performance_test" as const,
      name: "样品性能验证",
      keyHypothesis: "目标样品能够兑现消息支柱中的产品性能表达。",
      marketingExpression: messagePillars.map((item) => item.productSellingPoint).join(" / "),
      targetAudience: brief.recommendation.targetCustomer,
      metric: "目标样品按预注册测试的通过项数",
      passThreshold: "所有 P0 性能项通过，且无严重安全、舒适或耐久失败。",
      failThreshold: "任一 P0 项失败，或结果不能重复。",
      stopCondition: "样品身份、规格或测试条件不明确时停止。",
      nextIfPass: "将对应支柱从方向性证据升级，并保留测试记录。",
      nextIfFail: "删除对应话术或更换样品，不用文案掩盖失败。",
    },
    {
      id: "MKT-EXP-07",
      type: "claim_compliance_review" as const,
      name: "Claim 合规审核",
      keyHypothesis: "拟用营销表达可被现有证据充分支持且不误导。",
      marketingExpression: [expression, ...messagePillars.map((item) => item.marketingCopy)].join(" / "),
      targetAudience: brief.recommendation.targetCustomer,
      metric: "逐条 Claim 的证据映射与审核结论",
      passThreshold: "所有公开 Claim 均有目标 SKU 证据并通过适用市场审核。",
      failThreshold: "任一核心 Claim 缺乏证据、越过竞品边界或属于禁用类别。",
      stopCondition: "证据对象、目标市场或最终文案版本不确定时停止审核。",
      nextIfPass: "在 Listing/广告权限开放后标记为可使用。",
      nextIfFail: "删除、降级或重写 Claim，并继续保持草案状态。",
    },
  ];
  const experimentPsychologyRoles: Record<(typeof experiments)[number]["type"], MarketingDecisionRole[]> = {
    landing_page_concept_test: ["promise"],
    ad_angle_test: ["hook"],
    price_value_test: ["promise"],
    user_interview: ["hook", "promise"],
    content_engagement_test: ["hook"],
    sample_performance_test: ["promise"],
    claim_compliance_review: ["proof", "promise"],
  };
  const validationExperiments = decisionChain
    ? experiments.map((experiment) => ({
      ...experiment,
      psychologyStageIds: [...new Set(
        experimentPsychologyRoles[experiment.type]
          .flatMap((role) => psychologyMapping(role)?.sourceStageIds ?? []),
      )],
    }))
    : experiments;

  const psychologyContentRoles = ["hook", "proof", "offer"] as const;
  const promiseMapping = decisionChain ? requiredMarketingMapping(decisionChain, "promise") : null;
  const proofMapping = decisionChain ? requiredMarketingMapping(decisionChain, "proof") : null;
  const offerMapping = decisionChain ? requiredMarketingMapping(decisionChain, "offer") : null;

  return marketingTranslationSchema.parse({
    schemaVersion: "1.0",
    status,
    valueProposition: expression,
    ...(decisionChain ? { decisionChain } : {}),
    messagePillars,
    channelDrafts: {
      listingTitle: promiseMapping
        ? draft(
          `${brief.recommendation.title}｜${promiseMapping.expression}`,
          activeMarketingStatus(promiseMapping.evidenceStatus),
          promiseMapping.evidenceRefs,
          "promise",
        )
        : draft(`${brief.recommendation.title}｜${messagePillars.slice(0, 2).map((item) => item.customerBenefit).join("｜")}`),
      hero: {
        status,
        headline: expression,
        subheadline: proofMapping && offerMapping
          ? `${proofMapping.expression} ${offerMapping.expression}`
          : ready
            ? phrase(brief.recommendation.productConcept)
            : `概念测试草案：${phrase(brief.recommendation.productConcept)}。正式上线前仍需完成目标样品与 Claim 验证。`,
        evidenceStatus: promiseMapping
          ? activeMarketingStatus(promiseMapping.evidenceStatus) === "supported" && !ready
            ? "directional"
            : activeMarketingStatus(promiseMapping.evidenceStatus)
          : ready ? "supported" : "directional",
        evidenceRefs: promiseMapping ? promiseMapping.evidenceRefs : primaryRefs,
        ...(promiseMapping ? { decisionRole: "promise" as const } : {}),
      },
      adAngles: channelRoleMappings
        ? channelRoleMappings.map((mapping) => draft(
          mapping.expression,
          activeMarketingStatus(mapping.evidenceStatus),
          mapping.evidenceRefs,
          mapping.role,
        ))
        : channelPillars.slice(0, 5).map((item) => draft(
          `${item.useScenario}：${item.marketingCopy}`,
          activeMarketingStatus(item.evidenceStatus),
        )),
      contentHooks: decisionChain
        ? psychologyContentRoles.map((role) => {
          const mapping = requiredMarketingMapping(decisionChain, role);
          return draft(mapping.expression, "hypothesis", mapping.evidenceRefs, role);
        })
        : channelPillars.slice(0, 5).map((item) => draft(`你是否也在${scenarioContext(item.useScenario)}遇到同样的问题？先看${item.productSellingPoint}如何被验证。`, "hypothesis")),
    },
    objections: (brief.whyContinue.majorUnknowns.length > 0
      ? brief.whyContinue.majorUnknowns
      : ["目标 SKU 的性能、供应和单位经济仍待验证"]).slice(0, 5).map((unknown) => ({
      objection: unknown,
      responseDirection: "如实标记为未知，并用目标样品、供应商文件或单位经济数据回答。",
      evidenceStatus: "hypothesis",
      evidenceRefs: primaryRefs,
    })),
    nonGoals: ([...brief.mustNotHave.productScope, ...brief.recommendation.alternativesDeferred].length > 0
      ? [...brief.mustNotHave.productScope, ...brief.recommendation.alternativesDeferred]
      : ["不面向需要医疗或永久效果承诺的用户"]).slice(0, 8),
    prohibitedClaims,
    usageBoundaries: [
      brief.scopeNotice,
      brief.decisionBoundaries.listing,
      brief.decisionBoundaries.adTest,
      analysis.actionBoundary.reason,
    ],
    validationExperiments,
    generatedAt: now.toISOString(),
  });
};

export const validateMarketingEvidenceMappings = ({
  translation,
  analysis,
  claims,
  firstPrinciples,
  demandField,
  consumerPsychology,
}: {
  translation: MarketingTranslation;
  analysis: LiveResearchAnalysis;
  claims: ResearchClaim[];
  firstPrinciples?: FirstPrinciplesBundle;
  demandField?: DemandFieldArtifact | null;
  consumerPsychology?: ConsumerDecisionChainArtifact | null;
}): string[] => {
  const allowed = {
    claim: new Set(claims.map((item) => item.id)),
    voc_cluster: new Set(demandField?.audience_clusters.map((item) => item.id) ?? []),
    voc_observation: new Set(demandField?.need_atoms.flatMap((item) => [
      ...item.supporting_observation_ids,
      ...item.counterevidence_observation_ids,
    ]) ?? []),
    demand_atom: new Set(firstPrinciples?.demand_atoms.map((item) => item.id) ?? []),
    demand_field_need: new Set(demandField?.need_atoms.map((item) => item.id) ?? []),
    consumer_psychology_stage: new Set(consumerPsychology?.stages.map((item) => item.id) ?? []),
    sample_test: new Set<string>(),
    compliance_review: new Set<string>(),
  };
  const refs = [
    ...translation.messagePillars.flatMap((item) => item.evidenceRefs),
    translation.channelDrafts.listingTitle.evidenceRefs,
    translation.channelDrafts.hero.evidenceRefs,
    ...translation.channelDrafts.adAngles.map((item) => item.evidenceRefs),
    ...translation.channelDrafts.contentHooks.map((item) => item.evidenceRefs),
    ...translation.objections.map((item) => item.evidenceRefs),
    ...(translation.decisionChain?.mappings.map((item) => item.evidenceRefs) ?? []),
  ].flat();
  const errors = refs
    .filter((ref) => !allowed[ref.objectType].has(ref.id))
    .map((ref) => `${ref.objectType}:${ref.id} is not mapped to the current Research Run`);

  if ((!analysis.actionBoundary.listingAllowed || !analysis.actionBoundary.adTestAllowed)
    && translation.status === "ready_for_use") {
    errors.push("Marketing translation cannot be ready_for_use while Listing or Ad Test is blocked");
  }
  if (translation.decisionChain) {
    if (!consumerPsychology) {
      errors.push("Marketing decision chain requires a validated current-run consumer psychology artifact");
    } else {
      const stagesById = new Map(consumerPsychology.stages.map((stage) => [stage.id, stage]));
      for (const mapping of translation.decisionChain.mappings) {
        const stages = mapping.sourceStageIds.flatMap((id) => {
          const stage = stagesById.get(id);
          if (!stage) {
            errors.push(`${mapping.role} references unknown consumer psychology stage ${id}`);
            return [];
          }
          if (!psychologyStagesByMarketingRole[mapping.role].has(stage.stage)) {
            errors.push(`${mapping.role} cannot be derived from psychology stage ${stage.stage}`);
          }
          if (!mapping.evidenceRefs.some((ref) => ref.objectType === "consumer_psychology_stage" && ref.id === id)) {
            errors.push(`${mapping.role} must retain consumer psychology evidence ref ${id}`);
          }
          return [stage];
        });
        if (stages.length > 0) {
          const weakest = weakestPsychologyStatus(stages);
          if (psychologyStatusRank[mapping.evidenceStatus] > psychologyStatusRank[weakest]) {
            errors.push(`${mapping.role} marketing evidence cannot be stronger than source psychology stages`);
          }
        }
      }

      const roleBoundItems = [
        ...translation.messagePillars,
        translation.channelDrafts.listingTitle,
        translation.channelDrafts.hero,
        ...translation.channelDrafts.adAngles,
        ...translation.channelDrafts.contentHooks,
      ].filter((item) => item.decisionRole);
      for (const item of roleBoundItems) {
        const mapping = translation.decisionChain.mappings.find((candidate) => candidate.role === item.decisionRole);
        const psychologyRefIds = item.evidenceRefs
          .filter((ref) => ref.objectType === "consumer_psychology_stage")
          .map((ref) => ref.id);
        if (!mapping || !mapping.sourceStageIds.some((id) => psychologyRefIds.includes(id))) {
          errors.push(`${item.decisionRole} channel copy must reference its mapped psychology stage`);
        }
      }
    }
  }
  for (const pillar of translation.messagePillars) {
    if (pillar.evidenceStatus !== "supported") continue;
    const competitorClaim = pillar.supportingClaimIds
      .map((id) => claims.find((claim) => claim.id === id))
      .find((claim) => claim?.targetScope === "competitor");
    if (competitorClaim) {
      errors.push(`${pillar.id} cannot use competitor-only ${competitorClaim.id} as supported target-SKU evidence`);
    }
  }
  return [...new Set(errors)];
};

const readDemandFieldOptional = async (runId: string): Promise<DemandFieldArtifact | null> => {
  try {
    return demandFieldArtifactSchema.parse(JSON.parse(await readFile(demandFieldPaths(runId).artifact, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

export const writeMarketingTranslationForRun = async (runId: string, now = new Date()) => {
  const packagePath = path.join(process.cwd(), "output", "research", runId);
  const [artifacts, evidencePackage, brief, firstPrinciples, demandField, consumerPsychology] = await Promise.all([
    readLiveResearchArtifacts(packagePath),
    readEvidencePackage(packagePath),
    buildPreSampleDecisionBrief(runId),
    readFirstPrinciplesBundle(runId).catch(() => undefined),
    readDemandFieldOptional(runId),
    readConsumerDecisionChain(runId),
  ]);
  const marketingTranslation = buildProductMarketingTranslation({
    analysis: artifacts.analysis,
    claims: artifacts.claims,
    brief,
    firstPrinciples,
    demandField,
    consumerPsychology,
    now,
  });
  const mappingErrors = validateMarketingEvidenceMappings({
    translation: marketingTranslation,
    analysis: artifacts.analysis,
    claims: artifacts.claims,
    firstPrinciples,
    demandField,
    consumerPsychology,
  });
  if (mappingErrors.length > 0) {
    throw new Error(`Marketing evidence mapping failed: ${mappingErrors.join("; ")}`);
  }
  const analysis = liveAnalysisSchema.parse({ ...artifacts.analysis, marketingTranslation });
  await writeFile(liveResearchPaths(packagePath).analysis, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  await generateLiveResearchReports(packagePath, evidencePackage, artifacts.claims, analysis, firstPrinciples);
  await writePreSampleDecisionBrief(runId);
  return {
    status: marketingTranslation.status,
    runId,
    pillarCount: marketingTranslation.messagePillars.length,
    experimentCount: marketingTranslation.validationExperiments.length,
    prohibitedClaimCount: marketingTranslation.prohibitedClaims.length,
    mappingErrors,
  };
};
