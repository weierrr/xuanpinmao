import type { ReportDemandField } from "../report/types";
import {
  opportunityValidationRoadmapSchema,
  type OpportunityValidationCandidate,
  type OpportunityValidationRoadmap,
} from "./types";
import { validateOpportunityValidationRoadmap } from "./validation";

const priorityLabels = {
  E1_RESEARCH_NEXT: "探索 1 · 优先补充研究",
  E2_RESEARCH_LATER: "探索 2 · 后续补证",
  E3_OBSERVE: "探索 3 · 暂时观察",
  DO_NOT_CONTINUE: "不建议继续",
} as const;

const priorityOrder = {
  E1_RESEARCH_NEXT: 0,
  E2_RESEARCH_LATER: 1,
  E3_OBSERVE: 2,
  DO_NOT_CONTINUE: 3,
} as const;

const candidatePriority = (
  opportunity: ReportDemandField["opportunities"][number],
): keyof typeof priorityLabels => {
  if (opportunity.status === "NOT_PRIORITIZED") return "E3_OBSERVE";
  if (opportunity.directProductEvidence && opportunity.evidenceStatus !== "hypothesis") {
    return "E1_RESEARCH_NEXT";
  }
  return "E2_RESEARCH_LATER";
};

const whyThisPriority = (
  opportunity: ReportDemandField["opportunities"][number],
  priority: keyof typeof priorityLabels,
): string => {
  if (priority === "E1_RESEARCH_NEXT") {
    return `已有直接商品级线索，且当前支持观察 ${opportunity.supportCount} 条、反向证据 ${opportunity.counterevidenceCount} 条；适合优先确认它是稳定互补需求，还是瑜伽裤表现不佳时的临时补救。`;
  }
  if (priority === "E2_RESEARCH_LATER") {
    return `当前只有任务或问题层面的关联，尚无直接商品需求；必须先确认这是独立、重复出现的需求，再讨论具体商品方案。`;
  }
  if (priority === "E3_OBSERVE") {
    return "当前方向主要来自任务链推断，也可能只是对瑜伽裤质量问题的补救；在出现新的直接商品证据前不占用主要验证资源。";
  }
  return "现有证据不足以支持继续投入。";
};

const researchThresholds = (priority: keyof typeof priorityLabels) => {
  if (priority === "E1_RESEARCH_NEXT") {
    return {
      pass: "至少两类独立来源持续出现同一商品级需求，并出现明确的购买、替代方案或付费意愿信号。",
      fail: "需求主要由低质量瑜伽裤造成，或新增研究无法找到重复商品需求与付费意愿。",
      nextIfPass: "创建独立商品 Research Run，继续验证市场、竞品、供应与单位经济。",
      nextIfFail: "停止相邻商品方向，把问题重新收回瑜伽裤产品规格与证明体系。",
    };
  }
  if (priority === "E2_RESEARCH_LATER") {
    return {
      pass: "证明该问题在不同来源中重复出现，且用户会寻找独立解决方案，而不只是抱怨当前服装质量。",
      fail: "新增证据仍只描述瑜伽裤缺陷，没有出现独立商品、主动搜索或付费信号。",
      nextIfPass: "升级为探索优先 1，并为该候选建立独立 Research Run。",
      nextIfFail: "降级为观察项，不进入供应商、样品或商业测算阶段。",
    };
  }
  return {
    pass: "出现新的直接商品级证据，并证明该需求不是偶发问题或现有产品缺陷的替代描述。",
    fail: "持续只有任务链推断，或用户更倾向换一条瑜伽裤、换衣服等现有替代方案。",
    nextIfPass: "升级为探索优先 2，补做需求稳定性与付费意愿研究。",
    nextIfFail: "继续保持观察或停止，不占用当前瑜伽裤验证预算。",
  };
};

export const buildOpportunityValidationRoadmap = ({
  runId,
  generatedAt,
  demandField,
}: {
  runId: string;
  generatedAt: string;
  demandField: ReportDemandField | null;
}): OpportunityValidationRoadmap | null => {
  if (!demandField || demandField.opportunities.length === 0) return null;

  const candidates = demandField.opportunities
    .map((opportunity) => {
      const priority = candidatePriority(opportunity);
      const thresholds = researchThresholds(priority);
      return {
        id: `validation:${runId}:${opportunity.id}`,
        runId,
        opportunityId: opportunity.id,
        title: opportunity.title,
        category: opportunity.category,
        priority,
        priorityLabel: priorityLabels[priority],
        order: 0,
        whyThisPriority: whyThisPriority(opportunity, priority),
        relationships: opportunity.relationships,
        evidence: {
          status: opportunity.evidenceStatus,
          statusLabel: opportunity.evidenceStatusLabel,
          directProductEvidence: opportunity.directProductEvidence,
          supportCount: opportunity.supportCount,
          counterevidenceCount: opportunity.counterevidenceCount,
          balanceLabel: opportunity.supportCount > opportunity.counterevidenceCount ? "支持信号多于反向证据" : "支持与反向证据接近",
          boundary: opportunity.whyNotApproved,
        },
        researchPlan: {
          objective: opportunity.validationQuestions[0],
          questions: opportunity.validationQuestions,
          queries: opportunity.nextResearchQueries,
          pass: thresholds.pass,
          fail: thresholds.fail,
          stop: "在独立 Research Run 完成前，不联系供应商、不购买样品、不创建 Listing，也不投放广告。",
          budgetLabel: "待独立调研后估算 · 当前无真实预算数据",
          durationLabel: "未排期",
          nextIfPass: thresholds.nextIfPass,
          nextIfFail: thresholds.nextIfFail,
        },
      } satisfies OpportunityValidationCandidate;
    })
    .sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      if (a.evidence.directProductEvidence !== b.evidence.directProductEvidence) {
        return a.evidence.directProductEvidence ? -1 : 1;
      }
      return (b.evidence.supportCount - b.evidence.counterevidenceCount)
        - (a.evidence.supportCount - a.evidence.counterevidenceCount);
    })
    .map((candidate, index) => ({ ...candidate, order: index + 1 }));

  const roadmap = opportunityValidationRoadmapSchema.parse({
    schemaVersion: "1.0",
    runId,
    generatedAt,
    title: "机会验证优先级与行动路线图",
    recommendedCandidateId: candidates.find((item) => item.priority === "E1_RESEARCH_NEXT")?.id ?? null,
    candidates,
    metrics: {
      total: candidates.length,
      exploreFirst: candidates.filter((item) => item.priority === "E1_RESEARCH_NEXT").length,
      researchLater: candidates.filter((item) => item.priority === "E2_RESEARCH_LATER").length,
      observe: candidates.filter((item) => item.priority === "E3_OBSERVE").length,
      doNotContinue: candidates.filter((item) => item.priority === "DO_NOT_CONTINUE").length,
    },
    orderingRule: "先看是否存在直接商品证据，再看当前研究状态；没有直接证据的方向不得进入探索优先 1。",
    boundaries: [
      "优先级用于安排下一轮研究，不代表商品获批、市场规模成立或目标 SKU 已验证。",
      "当前不展示预算金额和完成天数，因为相邻机会尚未建立独立 Research Run 和真实执行计划。",
      "任何候选在进入供应商、样品、Listing、广告或单位经济阶段前，都必须完成独立研究与正式门禁。",
    ],
  });
  const validation = validateOpportunityValidationRoadmap(roadmap);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  return roadmap;
};
