import type { UnifiedActionQueue } from "../action-priority/types";
import type { ConclusionGovernanceArtifact, ConclusionTopic } from "../conclusion-governance/types";
import type { PreSampleValidationStep, ValidationTestType } from "../pre-sample/types";
import {
  validationExecutionLedgerSchema,
  type ValidationExecutionLedger,
  type ValidationExecutionRecord,
} from "./types";
import { validateValidationExecutionLedger } from "./validation";

const requiredEvidenceByType: Record<string, string[]> = {
  concept_test: ["参与者筛选与招募记录", "逐条概念选择和拒绝理由", "去标识化汇总结果"],
  supplier_validation: ["供应商书面能力回复", "材料、结构、MOQ 与交期说明", "候选样品或规格文件"],
  sample_test: ["测试样品身份与规格记录", "逐位测试者检查表和实拍", "洗后、强光、舒适与缝线结果"],
  pricing_test: ["参与者价格选择原始记录", "不同价格档考虑率汇总", "价格判断所依赖的证明条件"],
  unit_economics_check: ["正式供应商报价", "物流与履约成本文件", "完整单位经济计算底表"],
};

const reviewTopicsByValidationType: Record<ValidationTestType, ConclusionTopic[]> = {
  concept_test: [
    "product_direction",
    "core_value",
    "target_customer",
    "target_scenario",
    "marketing_value_proposition",
    "recommendation_rationale",
  ],
  supplier_validation: ["product_concept", "evidence_strength", "decision_boundary"],
  sample_test: [
    "product_direction",
    "core_value",
    "product_concept",
    "evidence_strength",
    "marketing_value_proposition",
    "decision_boundary",
  ],
  pricing_test: ["core_value", "marketing_value_proposition", "recommendation_rationale", "decision_boundary"],
  unit_economics_check: ["evidence_strength", "recommendation_rationale", "decision_boundary"],
};

export const buildInitialValidationExecutionLedger = ({
  runId,
  generatedAt,
  actionQueue,
  validationSteps,
  conclusionGovernance,
}: {
  runId: string;
  generatedAt: string;
  actionQueue: UnifiedActionQueue;
  validationSteps: PreSampleValidationStep[];
  conclusionGovernance: ConclusionGovernanceArtifact | null;
}): ValidationExecutionLedger => {
  if (actionQueue.mainline.length !== validationSteps.length) {
    throw new Error("Validation execution ledger requires one plan step per mainline action");
  }

  const records: ValidationExecutionRecord[] = actionQueue.mainline.map((action, index) => {
    const step = validationSteps[index];
    const reviewTopics = new Set(reviewTopicsByValidationType[step.internalType]);
    const conclusionReviewTargets = (conclusionGovernance?.conclusions ?? [])
      .filter((conclusion) => conclusion.status === "current" && reviewTopics.has(conclusion.topic))
      .map((conclusion) => ({
        id: conclusion.id,
        topic: conclusion.topic,
        statement: conclusion.statement,
        evidenceStatus: conclusion.evidence_status,
        chapterIds: conclusion.chapter_ids,
        claimBoundary: conclusion.claim_boundary,
      }));
    return {
      id: `execution:${runId}:${index + 1}`,
      runId,
      sourceActionId: action.id,
      dependencyActionIds: action.dependencyIds,
      order: index + 1,
      title: action.title,
      typeLabel: action.typeLabel,
      validationType: step.internalType,
      currentStatus: index === 0 ? "READY" : "BLOCKED",
      currentStatusLabel: index === 0 ? "可以开始 · 尚未执行" : "等待前置步骤 · 尚未执行",
      planned: {
        method: step.method,
        scope: step.scope,
        durationDays: step.durationDays,
        budgetLabel: step.budgetCap,
        metric: step.metric,
        pass: step.pass,
        fail: step.fail,
        stop: step.stop,
      },
      requiredEvidence: requiredEvidenceByType[step.internalType] ?? ["原始执行记录", "结果汇总与判断依据"],
      conclusionReviewTargets,
      attempts: [],
      decisionImpact: null,
    } satisfies ValidationExecutionRecord;
  });

  const ledger = validationExecutionLedgerSchema.parse({
    schemaVersion: "1.0",
    runId,
    generatedAt,
    title: "验证执行记录与证据回填",
    globalFirstRecordId: records[0].id,
    records,
    events: [],
    metrics: {
      total: records.length,
      ready: 1,
      blocked: Math.max(records.length - 1, 0),
      inProgress: 0,
      passed: 0,
      failed: 0,
      evidenceCount: 0,
    },
    boundary: "当前页面只展示验证计划和执行状态；没有真实执行记录、原始证据和结果时，任何任务都不能标记通过。",
    boundaries: [
      "规划样本、预算和周期不是实际执行数据；实际值必须在执行后独立记录。",
      "失败尝试必须追加保留，后续重试不能覆盖或删除既有失败证据。",
      "验证通过只更新证据与结论建议，不会自动开放 Listing、广告测试或正式供货。",
    ],
  });
  const validation = validateValidationExecutionLedger(ledger);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  return ledger;
};
