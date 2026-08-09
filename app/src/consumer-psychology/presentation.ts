import type { ConsumerDecisionStage } from "./types";

export const consumerDecisionStagePresentation: Record<
  ConsumerDecisionStage["stage"],
  { label: string; question: string; shortLabel: string }
> = {
  situational_trigger: {
    label: "场景触发",
    shortLabel: "被什么触发",
    question: "用户在什么时刻会注意到问题？",
  },
  tension_activation: {
    label: "心理张力",
    shortLabel: "担心什么",
    question: "她担心自己或别人看到什么结果？",
  },
  identity_projection: {
    label: "理想自我投射",
    shortLabel: "想成为什么样",
    question: "她希望自己呈现怎样的状态？",
  },
  outcome_imagination: {
    label: "结果想象",
    shortLabel: "想象什么改变",
    question: "她能否立即理解产品可能带来的改变？",
  },
  belief_formation: {
    label: "信任形成",
    shortLabel: "为什么相信",
    question: "什么证据让她相信这不是文案或拍摄制造？",
  },
  risk_reduction: {
    label: "风险消除",
    shortLabel: "为什么敢尝试",
    question: "什么信息或机制能降低试错成本？",
  },
};

export const consumerPsychologyMechanismLabel: Record<ConsumerDecisionStage["mechanism"], string> = {
  situational_trigger: "场景触发",
  self_discrepancy: "自我差距",
  loss_aversion: "损失规避",
  identity_projection: "身份投射",
  cognitive_fluency: "认知流畅",
  belief_formation: "信念形成",
  uncertainty_reduction: "不确定性降低",
  risk_reversal: "风险逆转",
};

export const consumerPsychologyEvidenceStatusLabel: Record<ConsumerDecisionStage["evidence_status"], string> = {
  supported: "用户原话支持",
  directional: "方向性证据",
  hypothesis: "待验证假设",
  prohibited: "禁止使用",
};

export const consumerPsychologyScopeLabel: Record<ConsumerDecisionStage["scope"], string> = {
  category_user: "品类用户",
  competitor_journey: "竞品决策路径",
  proposed_offer: "拟议产品方案",
  target_product: "目标商品",
};

