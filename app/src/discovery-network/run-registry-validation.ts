import type {
  DiscoveryRunRegistry,
  DiscoveryRunRegistryValidationIssue,
  DiscoveryRunRegistryValidationResult,
} from "./run-registry-types";

export const validateDiscoveryRunRegistry = (
  registry: DiscoveryRunRegistry,
): DiscoveryRunRegistryValidationResult => {
  const errors: DiscoveryRunRegistryValidationIssue[] = [];
  const warnings: DiscoveryRunRegistryValidationIssue[] = [];
  const runIds = new Set<string>();
  const activeProductKeys = new Set<string>();

  for (const entry of registry.entries) {
    if (runIds.has(entry.runId)) {
      errors.push({ code: "DUPLICATE_RUN_ENTRY", message: "同一 Research Run 在注册表中出现多次。", runId: entry.runId });
    }
    runIds.add(entry.runId);

    if (entry.status === "active") {
      if (!entry.productKey || !entry.product || !entry.market || !entry.reportGeneratedAt) {
        errors.push({ code: "INCOMPLETE_ACTIVE_RUN", message: "有效入网 Run 缺少产品、市场或报告版本信息。", runId: entry.runId });
      }
      if (entry.productKey && activeProductKeys.has(entry.productKey)) {
        errors.push({ code: "MULTIPLE_ACTIVE_VERSIONS", message: "同一产品和市场只能保留一个当前有效版本。", runId: entry.runId });
      }
      if (entry.productKey) activeProductKeys.add(entry.productKey);
      if (entry.supersededByRunId || entry.exclusionReason) {
        errors.push({ code: "INVALID_ACTIVE_METADATA", message: "有效Run不能同时带有覆盖或排除信息。", runId: entry.runId });
      }
    }

    if (entry.status === "superseded") {
      if (!entry.supersededByRunId || !runIds.has(entry.supersededByRunId) && !registry.entries.some((candidate) => candidate.runId === entry.supersededByRunId)) {
        errors.push({ code: "MISSING_SUPERSEDING_RUN", message: "旧版本没有指向可追溯的新版本。", runId: entry.runId });
      }
      if (entry.exclusionReason) {
        errors.push({ code: "INVALID_SUPERSEDED_METADATA", message: "已覆盖版本不应同时标成产物缺失。", runId: entry.runId });
      }
    }

    if (entry.status === "excluded") {
      if (!entry.exclusionReason) {
        errors.push({ code: "MISSING_EXCLUSION_REASON", message: "未入网 Run 必须保留排除原因。", runId: entry.runId });
      }
      if (entry.productKey || entry.reportGeneratedAt || entry.supersededByRunId) {
        errors.push({ code: "INVALID_EXCLUDED_METADATA", message: "未完成报告的Run不能参与版本覆盖。", runId: entry.runId });
      }
    }
  }

  const expectedMetrics = {
    discoveredRunCount: registry.entries.length,
    activeRunCount: registry.entries.filter((entry) => entry.status === "active").length,
    supersededRunCount: registry.entries.filter((entry) => entry.status === "superseded").length,
    excludedRunCount: registry.entries.filter((entry) => entry.status === "excluded").length,
  };
  for (const [metric, expected] of Object.entries(expectedMetrics)) {
    if (registry.metrics[metric as keyof typeof expectedMetrics] !== expected) {
      errors.push({ code: "REGISTRY_METRIC_MISMATCH", message: `Run注册表指标 ${metric} 与实际条目不一致。` });
    }
  }

  if (registry.metrics.excludedRunCount > 0) {
    warnings.push({ code: "EXCLUDED_RUNS_PRESENT", message: `有 ${registry.metrics.excludedRunCount} 个 Run 因报告产物不完整未进入发现网络。` });
  }

  return { valid: errors.length === 0, errors, warnings };
};
