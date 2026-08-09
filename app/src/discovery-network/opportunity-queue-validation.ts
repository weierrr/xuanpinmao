import type { DiscoveryThemeIndex } from "./theme-index-types";
import type {
  DiscoveryOpportunityQueue,
  DiscoveryOpportunityQueueValidationIssue,
  DiscoveryOpportunityQueueValidationResult,
} from "./opportunity-queue-types";

export const validateDiscoveryOpportunityQueue = (
  queue: DiscoveryOpportunityQueue,
  index: DiscoveryThemeIndex,
): DiscoveryOpportunityQueueValidationResult => {
  const errors: DiscoveryOpportunityQueueValidationIssue[] = [];
  const warnings: DiscoveryOpportunityQueueValidationIssue[] = [];
  const candidateIds = new Set<string>();
  const clustersById = new Map(index.clusters.map((cluster) => [cluster.id, cluster]));

  for (const candidate of queue.candidates) {
    if (candidateIds.has(candidate.id)) {
      errors.push({ code: "DUPLICATE_CANDIDATE", message: "同一机会候选在队列中出现多次。", candidateId: candidate.id });
    }
    candidateIds.add(candidate.id);
    const cluster = clustersById.get(candidate.clusterId);
    if (!cluster || !cluster.crossRunCandidate) {
      errors.push({ code: "INVALID_SOURCE_CLUSTER", message: "机会候选必须来自跨 Run 待复核主题。", candidateId: candidate.id });
      continue;
    }
    const candidateRunIds = [...candidate.sourceRunIds].sort();
    const clusterRunIds = [...cluster.runIds].sort();
    if (candidateRunIds.join("|") !== clusterRunIds.join("|")) {
      errors.push({ code: "CANDIDATE_RUN_SCOPE_MISMATCH", message: "候选的来源 Run 与主题聚合不一致。", candidateId: candidate.id });
    }
    const candidateNodeIds = [...candidate.sourceNodeIds].sort();
    const clusterNodeIds = cluster.members.map((member) => member.nodeId).sort();
    if (candidateNodeIds.join("|") !== clusterNodeIds.join("|")) {
      errors.push({ code: "CANDIDATE_NODE_SCOPE_MISMATCH", message: "候选的来源节点与主题聚合不一致。", candidateId: candidate.id });
    }
    if (candidate.canCreateResearchRun) {
      errors.push({ code: "UNREVIEWED_CANDIDATE_READY", message: "未经人工复核的候选不能创建新 Research Run。", candidateId: candidate.id });
    }
  }

  const expectedCandidates = index.clusters.filter((cluster) => cluster.crossRunCandidate).length;
  if (queue.candidates.length !== expectedCandidates) {
    errors.push({ code: "QUEUE_COVERAGE_MISMATCH", message: "候选队列没有完整覆盖跨 Run 待复核主题。" });
  }
  if (queue.metrics.candidateCount !== queue.candidates.length || queue.metrics.pendingReviewCount !== queue.candidates.length) {
    errors.push({ code: "QUEUE_METRIC_MISMATCH", message: "候选队列指标与实际条目不一致。" });
  }
  if (queue.candidates.length === 0) {
    warnings.push({ code: "EMPTY_OPPORTUNITY_QUEUE", message: "当前没有满足受控归一化规则的跨 Run 机会候选。" });
  }

  return { valid: errors.length === 0, errors, warnings };
};
