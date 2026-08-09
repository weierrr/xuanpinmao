import type { RunReport } from "../report/types";
import {
  discoveryRunRegistrySchema,
  type DiscoveryRunRegistry,
  type DiscoveryRunRegistryEntry,
} from "./run-registry-types";
import { validateDiscoveryRunRegistry } from "./run-registry-validation";

const normalizeProductKey = (product: string, market: string): string => `${market}:${product}`
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[\s\p{P}\p{S}]+/gu, "-")
  .replace(/^-|-$/g, "");

export const buildDiscoveryRunRegistryFromReports = (
  reports: RunReport[],
  excluded: Array<{ runId: string; reason: string }> = [],
): DiscoveryRunRegistry => {
  const grouped = new Map<string, RunReport[]>();
  for (const report of reports) {
    const productKey = normalizeProductKey(report.product, report.market);
    const group = grouped.get(productKey) ?? [];
    group.push(report);
    grouped.set(productKey, group);
  }

  const entries: DiscoveryRunRegistryEntry[] = [];
  for (const [productKey, group] of grouped) {
    const sorted = [...group].sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt) || b.runId.localeCompare(a.runId));
    const current = sorted[0];
    for (const report of sorted) {
      const active = report.runId === current.runId;
      entries.push({
        runId: report.runId,
        status: active ? "active" : "superseded",
        product: report.product,
        productKey,
        market: report.market,
        reportGeneratedAt: report.generatedAt,
        supersededByRunId: active ? null : current.runId,
        exclusionReason: null,
      });
    }
  }

  for (const item of excluded) {
    entries.push({
      runId: item.runId,
      status: "excluded",
      product: null,
      productKey: null,
      market: null,
      reportGeneratedAt: null,
      supersededByRunId: null,
      exclusionReason: item.reason,
    });
  }

  entries.sort((a, b) => a.runId.localeCompare(b.runId));
  const reportDates = reports.map((report) => Date.parse(report.generatedAt)).filter(Number.isFinite);
  const registry = discoveryRunRegistrySchema.parse({
    schemaVersion: "1.0",
    generatedAt: new Date(reportDates.length > 0 ? Math.max(...reportDates) : 0).toISOString(),
    entries,
    metrics: {
      discoveredRunCount: entries.length,
      activeRunCount: entries.filter((entry) => entry.status === "active").length,
      supersededRunCount: entries.filter((entry) => entry.status === "superseded").length,
      excludedRunCount: entries.filter((entry) => entry.status === "excluded").length,
    },
    boundaries: [
      "当前阶段只注册产品团队明确指定的基准 Research Run，不自动扫描或优化其他报告目录。",
      "同一产品和市场存在多个报告版本时，只使用 generatedAt 最新的版本，旧版保留覆盖关系但不重复累计。",
      "自动入网只更新发现索引，不改变任何 Research Run 的正式决策、采购、上架或投放权限。",
    ],
  });
  const validation = validateDiscoveryRunRegistry(registry);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  return registry;
};
