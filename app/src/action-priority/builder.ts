import type { PreSampleValidationStep } from "../pre-sample/types";
import type { VisualShapingOpportunity } from "../report/visual-shaping-opportunity";
import type { OpportunityValidationRoadmap } from "../opportunity-validation/types";
import {
  unifiedActionQueueSchema,
  type UnifiedActionItem,
  type UnifiedActionQueue,
} from "./types";
import { validateUnifiedActionQueue } from "./validation";

const validationTypeLabels: Record<string, string> = {
  concept_test: "概念验证",
  supplier_validation: "供应商验证",
  sample_test: "样品验证",
  pricing_test: "价格验证",
  unit_economics_check: "单位经济验证",
};

export const buildUnifiedActionQueue = ({
  runId,
  generatedAt,
  validationSteps,
  opportunityRoadmap,
  visualShapingOpportunity,
}: {
  runId: string;
  generatedAt: string;
  validationSteps: PreSampleValidationStep[];
  opportunityRoadmap: OpportunityValidationRoadmap | null;
  visualShapingOpportunity: VisualShapingOpportunity | null;
}): UnifiedActionQueue => {
  if (validationSteps.length === 0) throw new Error("Unified action queue requires current-product validation steps");

  const mainline: UnifiedActionItem[] = validationSteps.map((step, index) => {
    const id = `mainline:${runId}:${index + 1}`;
    const previousId = index > 0 ? `mainline:${runId}:${index}` : null;
    const isSampleStep = step.internalType === "sample_test";
    return {
      id,
      runId,
      lane: "current_product",
      role: index === 0 ? "GLOBAL_FIRST" : "MAINLINE_NEXT",
      status: index === 0 ? "READY" : "BLOCKED",
      order: index + 1,
      title: step.name,
      typeLabel: validationTypeLabels[step.internalType] ?? step.name,
      description: step.method,
      dependencyIds: previousId ? [previousId] : [],
      sourceAnchor: "#chapter-validation",
      successCondition: step.pass,
      failureAction: step.nextIfFail,
      boundary: step.stop,
      embeddedChecks: isSampleStep && visualShapingOpportunity ? [{
        label: visualShapingOpportunity.validation.title,
        method: visualShapingOpportunity.validation.method,
        pass: visualShapingOpportunity.validation.pass,
        fail: visualShapingOpportunity.validation.fail,
      }] : [],
    } satisfies UnifiedActionItem;
  });

  const exploration: UnifiedActionItem[] = (opportunityRoadmap?.candidates ?? []).map((candidate, index) => ({
    id: `exploration:${runId}:${candidate.opportunityId}`,
    runId,
    lane: "adjacent_exploration",
    role: candidate.priority === "E3_OBSERVE" ? "OBSERVE" : "EXPLORE_NEXT",
    status: candidate.priority === "E3_OBSERVE" ? "OBSERVE" : "PARALLEL_RESEARCH",
    order: index + 1,
    title: candidate.title,
    typeLabel: candidate.priorityLabel,
    description: candidate.whyThisPriority,
    dependencyIds: [],
    sourceAnchor: "#opportunity-validation-roadmap-title",
    successCondition: candidate.researchPlan.pass,
    failureAction: candidate.researchPlan.nextIfFail,
    boundary: candidate.researchPlan.stop,
    embeddedChecks: [],
  }));

  const allActions = [...mainline, ...exploration];
  const queue = unifiedActionQueueSchema.parse({
    schemaVersion: "1.0",
    runId,
    generatedAt,
    title: "统一行动优先级",
    globalFirstActionId: mainline[0].id,
    mainline,
    exploration,
    metrics: {
      mainlineCount: mainline.length,
      explorationCount: exploration.length,
      readyNowCount: allActions.filter((action) => action.status === "READY").length,
      blockedCount: allActions.filter((action) => action.status === "BLOCKED").length,
      observeCount: allActions.filter((action) => action.status === "OBSERVE").length,
    },
    crossLanePolicy: "当前瑜伽裤验证是唯一主线；相邻机会只能做低成本公开研究，不能替代主线，也不能占用供应商、样品或广告预算。",
    boundaries: [
      "全报告只能有一个全局第一步，且必须来自当前瑜伽裤验证主线。",
      "相邻机会的排序只表示探索支线内部先后，不表示商品获批、可采购或可投放。",
      "视觉盲测依赖候选样裤，因此并入样品验证阶段，不再被描述为当前第一步。",
    ],
  });
  const validation = validateUnifiedActionQueue(queue);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  return queue;
};
