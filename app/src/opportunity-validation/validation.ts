import type {
  OpportunityValidationIssue,
  OpportunityValidationResult,
  OpportunityValidationRoadmap,
} from "./types";

export const validateOpportunityValidationRoadmap = (
  roadmap: OpportunityValidationRoadmap,
): OpportunityValidationResult => {
  const errors: OpportunityValidationIssue[] = [];
  const warnings: OpportunityValidationIssue[] = [];
  const ids = new Set<string>();
  const opportunityIds = new Set<string>();

  for (const candidate of roadmap.candidates) {
    if (ids.has(candidate.id)) {
      errors.push({ code: "DUPLICATE_CANDIDATE", message: "机会验证候选 ID 重复。", candidateId: candidate.id });
    }
    ids.add(candidate.id);
    if (opportunityIds.has(candidate.opportunityId)) {
      errors.push({ code: "DUPLICATE_OPPORTUNITY", message: "同一相邻机会不能重复进入路线图。", candidateId: candidate.id });
    }
    opportunityIds.add(candidate.opportunityId);
    if (candidate.runId !== roadmap.runId) {
      errors.push({ code: "RUN_MISMATCH", message: "候选必须属于当前报告 Run。", candidateId: candidate.id });
    }
    if (candidate.priority === "E1_RESEARCH_NEXT" && candidate.evidence.status === "hypothesis") {
      errors.push({ code: "E1_EVIDENCE_TOO_WEAK", message: "探索优先 1 必须至少具有方向性商品证据。", candidateId: candidate.id });
    }
    if (/USD|\$|人民币|CNY|RMB|¥/i.exec(candidate.researchPlan.budgetLabel)) {
      warnings.push({ code: "UNVERIFIED_BUDGET_VALUE", message: "相邻机会不应在独立调研前展示未经验证的预算金额。", candidateId: candidate.id });
    }
  }

  const expectedOrder = [...roadmap.candidates].sort((a, b) => a.order - b.order).map((item) => item.id);
  if (roadmap.candidates.map((item) => item.id).join("|") !== expectedOrder.join("|")) {
    errors.push({ code: "INVALID_ORDER", message: "候选必须按行动优先级顺序输出。" });
  }

  const recommended = roadmap.recommendedCandidateId
    ? roadmap.candidates.find((candidate) => candidate.id === roadmap.recommendedCandidateId)
    : null;
  if (roadmap.recommendedCandidateId && !recommended) {
    errors.push({ code: "MISSING_RECOMMENDED_CANDIDATE", message: "推荐候选不存在于当前路线图。" });
  }
  if (recommended && recommended.priority !== "E1_RESEARCH_NEXT") {
    errors.push({ code: "INVALID_RECOMMENDATION", message: "只有探索优先 1 可以成为相邻机会内部首选。", candidateId: recommended.id });
  }

  const counts = {
    total: roadmap.candidates.length,
    exploreFirst: roadmap.candidates.filter((item) => item.priority === "E1_RESEARCH_NEXT").length,
    researchLater: roadmap.candidates.filter((item) => item.priority === "E2_RESEARCH_LATER").length,
    observe: roadmap.candidates.filter((item) => item.priority === "E3_OBSERVE").length,
    doNotContinue: roadmap.candidates.filter((item) => item.priority === "DO_NOT_CONTINUE").length,
  };
  if (JSON.stringify(counts) !== JSON.stringify(roadmap.metrics)) {
    errors.push({ code: "METRICS_MISMATCH", message: "路线图汇总数字与候选明细不一致。" });
  }

  return { valid: errors.length === 0, errors, warnings };
};
