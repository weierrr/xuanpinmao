import type { DiscoveryThemeIndex } from "./theme-index-types";
import {
  discoveryOpportunityQueueSchema,
  type DiscoveryOpportunityQueue,
} from "./opportunity-queue-types";
import { validateDiscoveryOpportunityQueue } from "./opportunity-queue-validation";

export const buildDiscoveryOpportunityQueue = (
  index: DiscoveryThemeIndex,
): DiscoveryOpportunityQueue => {
  const candidates = index.clusters
    .filter((cluster) => cluster.crossRunCandidate)
    .map((cluster) => ({
      id: `candidate:${cluster.id}`,
      clusterId: cluster.id,
      status: "pending_review" as const,
      kind: cluster.kind,
      canonicalLabel: cluster.canonicalLabel,
      sourceRunIds: cluster.runIds,
      sourceNodeIds: cluster.members.map((member) => member.nodeId),
      whyCandidate: `“${cluster.canonicalLabel}”通过${cluster.normalizationMethod === "exact" ? "精确文本" : "受控同义词"}归一化在 ${cluster.runIds.length} 个 Research Run 中重合。`,
      reviewQuestions: [
        "这些表达指向的是同一种对象和使用任务吗？",
        "它们发生在相同的任务阶段和使用场景吗？",
        "各 Run 的原始证据是否足以支持独立需求，而非模板化措辞？",
        "确认合并后，需要创建什么独立 Research Run 重新验证？",
      ],
      canCreateResearchRun: false as const,
      boundary: "当前仅为自动发现的待复核候选；人工确认语境一致并明确新研究问题前，不得创建新Run或进入产品结论。",
    }));

  const queue = discoveryOpportunityQueueSchema.parse({
    schemaVersion: "1.0",
    generatedAt: index.generatedAt,
    sourceThemeIndexVersion: index.schemaVersion,
    candidates,
    metrics: {
      candidateCount: candidates.length,
      pendingReviewCount: candidates.length,
      researchRunReadyCount: 0,
    },
    boundaries: [
      "候选队列只接收跨 Run 待人工复核主题，单 Run 主题不会被包装成跨品类机会。",
      "未经人工确认的候选一律不能创建新 Research Run，也不能改变任何现有报告结论。",
      "后续审核必须保留确认、分离、驳回或加入受控同义词表的明确理由和操作人记录。",
    ],
  });
  const validation = validateDiscoveryOpportunityQueue(queue, index);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  return queue;
};
