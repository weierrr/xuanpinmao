import type { DiscoveryNetwork, DiscoveryNetworkNode } from "./types";
import {
  discoveryThemeIndexSchema,
  discoveryThemeKinds,
  type DiscoveryThemeCluster,
  type DiscoveryThemeIndex,
} from "./theme-index-types";
import { validateDiscoveryThemeIndex } from "./theme-index-validation";

type AliasGroup = Readonly<{
  key: string;
  label: string;
  variants: readonly string[];
}>;

const controlledAliasGroups: readonly AliasGroup[] = [
  { key: "size-fit", label: "尺码与版型适配", variants: ["版型与尺码", "尺码与版型", "尺码适配", "尺寸适配"] },
  { key: "cleaning-flow-complexity", label: "清洁流程复杂", variants: ["清洗流程复杂", "清洁流程复杂", "清洁步骤繁琐", "清洗步骤繁琐"] },
] as const;

const normalizeSurface = (value: string): string => value
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[\s\p{P}\p{S}]+/gu, "");

const aliasLookup = new Map<string, AliasGroup>();
for (const group of controlledAliasGroups) {
  for (const variant of group.variants) aliasLookup.set(normalizeSurface(variant), group);
}

const normalizeTheme = (node: DiscoveryNetworkNode) => {
  const surface = normalizeSurface(node.label);
  const alias = aliasLookup.get(surface);
  return alias
    ? { canonicalKey: `${node.kind}:alias:${alias.key}`, canonicalLabel: alias.label, normalizationMethod: "controlled_alias" as const }
    : { canonicalKey: `${node.kind}:exact:${surface}`, canonicalLabel: node.label.trim(), normalizationMethod: "exact" as const };
};

const clusterIdFor = (canonicalKey: string): string => `theme:${canonicalKey}`;

export const buildDiscoveryThemeIndex = (network: DiscoveryNetwork): DiscoveryThemeIndex => {
  const grouped = new Map<string, {
    kind: DiscoveryThemeCluster["kind"];
    canonicalKey: string;
    canonicalLabel: string;
    normalizationMethod: DiscoveryThemeCluster["normalizationMethod"];
    nodes: DiscoveryNetworkNode[];
  }>();

  for (const node of network.nodes) {
    if (!discoveryThemeKinds.includes(node.kind as (typeof discoveryThemeKinds)[number])) continue;
    const kind = node.kind as DiscoveryThemeCluster["kind"];
    const normalized = normalizeTheme(node);
    const current = grouped.get(normalized.canonicalKey);
    if (current) current.nodes.push(node);
    else grouped.set(normalized.canonicalKey, { kind, ...normalized, nodes: [node] });
  }

  const clusters: DiscoveryThemeCluster[] = [...grouped.values()]
    .map((group) => {
      const runIds = [...new Set(group.nodes.map((node) => node.runId))].sort();
      const crossRunCandidate = runIds.length > 1;
      return {
        id: clusterIdFor(group.canonicalKey),
        kind: group.kind,
        canonicalKey: group.canonicalKey,
        canonicalLabel: group.canonicalLabel,
        normalizationMethod: group.normalizationMethod,
        runIds,
        members: group.nodes.map((node) => ({
          nodeId: node.id,
          runId: node.runId,
          label: node.label,
          evidenceStatus: node.evidenceStatus,
          evidenceCount: node.evidenceCount,
          reportUrl: node.reportUrl,
        })),
        boundedEvidenceCountSum: group.nodes.reduce((sum, node) => sum + node.evidenceCount, 0),
        crossRunCandidate,
        reviewStatus: crossRunCandidate ? "human_review_required" as const : "single_run" as const,
        boundary: crossRunCandidate
          ? "该主题仅因受控文本归一化在多个 Run 中重合，仍需人工检查语境、对象和任务是否一致，不能据此推断共同购买。"
          : "该主题目前只出现在一个 Research Run 中，不能外推为跨品类共同需求。",
      };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.canonicalLabel.localeCompare(b.canonicalLabel, "zh-CN"));

  const index = discoveryThemeIndexSchema.parse({
    schemaVersion: "1.0",
    generatedAt: network.generatedAt,
    sourceNetworkVersion: network.schemaVersion,
    runIds: network.runIds,
    clusters,
    metrics: {
      clusterCount: clusters.length,
      crossRunCandidateCount: clusters.filter((cluster) => cluster.crossRunCandidate).length,
      singleRunClusterCount: clusters.filter((cluster) => !cluster.crossRunCandidate).length,
      controlledAliasClusterCount: clusters.filter((cluster) => cluster.normalizationMethod === "controlled_alias").length,
    },
    boundaries: [
      "主题归一化只使用精确文本和受控同义词表，不使用不可解释的自由语义合并。",
      "跨 Run 重合只生成待人工复核候选，不生成跨商品关系边，也不证明共同购买或共同人群。",
      "不同品类即使使用相同词语，也必须检查对象、任务阶段、使用场景和证据来源是否真正一致。",
    ],
  });
  const validation = validateDiscoveryThemeIndex(index, network);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  return index;
};
