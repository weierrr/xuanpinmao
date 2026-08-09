import type { EvidencePackage, ResearchSource } from "../research/types";
import type { VocCorpus } from "../voc/types";
import { evidenceBatchInputSchema, type EvidenceBatchInput, type EvidenceUpdateRecord } from "./types";

const sourceEvidenceType = (source: ResearchSource): EvidenceUpdateRecord["evidenceType"] => {
  if (source.sourceType === "competitor") return "competitor_observation";
  if (source.sourceType === "supplier") return "supplier_observation";
  if (source.sourceType === "regulation") return "regulation_observation";
  if (source.sourceType === "market") return "market_metric";
  return "source_observation";
};

export const evidenceBatchFromResearchSources = ({
  targetRunId,
  evidencePackage,
  batchId,
  providerId = "provider.live-web-research",
  providerLabel = "Live Web Research",
  completedAt,
}: {
  targetRunId: string;
  evidencePackage: EvidencePackage;
  batchId: string;
  providerId?: string;
  providerLabel?: string;
  completedAt?: string;
}): EvidenceBatchInput => {
  const records = evidencePackage.sources.map((source): EvidenceUpdateRecord => ({
    evidenceType: sourceEvidenceType(source),
    externalId: `${evidencePackage.researchInput.researchRunId}:${source.id}`,
    sourceRecordId: source.id,
    sourceUrl: source.url,
    entityRefs: [{ kind: "product", key: evidencePackage.researchInput.productName, label: evidencePackage.researchInput.productName }],
    market: evidencePackage.researchInput.targetMarket,
    collectedAt: source.retrievedAt,
    rawPayloadRef: source.snapshotPath ?? "sources.json",
    contentExcerpt: [source.title, source.notes].filter(Boolean).join(" — "),
    contentHash: source.contentHash,
    provenanceClass: "public_observation",
    themes: [source.sourceType, source.targetEntity],
    quality: {
      access: source.accessStatus,
      freshness: "unknown",
      coverage: "single_record",
      confidence: source.evidenceStatus === "verified" ? "MEDIUM" : source.evidenceStatus === "invalid" ? "INSUFFICIENT" : "LOW",
    },
    claimBoundary: {
      supports: `证明该来源中可直接观察到的 ${source.sourceType} 信息。`,
      cannotProve: "不能单独证明市场规模、目标商品表现、供应履约能力或真实转化。",
    },
    intendedChapterIds: [],
    status: source.evidenceStatus === "invalid" ? "invalid" : "active",
  }));
  const completed = completedAt ?? records.map((record) => record.collectedAt).sort().at(-1) ?? evidencePackage.researchInput.createdAt;
  return evidenceBatchInputSchema.parse({
    schemaVersion: "1.0",
    batchId,
    runId: targetRunId,
    sourceRunIds: [evidencePackage.researchInput.researchRunId],
    provider: { id: providerId, label: providerLabel, channel: "public-web" },
    acquisitionMethod: "web-search",
    fidelity: "source_level",
    querySpec: { packagePath: evidencePackage.packagePath },
    requestedAt: evidencePackage.researchInput.createdAt,
    completedAt: completed,
    outcome: records.length > 0 ? "success" : "empty",
    rawCount: records.length,
    excludedCount: 0,
    records,
    boundary: "来源级批次记录网页入口、访问状态和快照；它不等同于评论级、销量级或正式供应数据。",
  });
};

export const evidenceBatchFromVocCorpus = ({
  targetRunId,
  corpus,
  batchId,
  rawPayloadRef,
  providerId,
  providerLabel,
  confidence,
}: {
  targetRunId: string;
  corpus: VocCorpus;
  batchId: string;
  rawPayloadRef: string;
  providerId: string;
  providerLabel: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
}): EvidenceBatchInput => evidenceBatchInputSchema.parse({
  schemaVersion: "1.0",
  batchId,
  runId: targetRunId,
  sourceRunIds: [corpus.run_id],
  provider: { id: providerId, label: providerLabel, channel: "voice-of-customer" },
  acquisitionMethod: "file-import",
  fidelity: "record_level",
  querySpec: { product: corpus.product, market: corpus.market, methodology: corpus.methodology },
  requestedAt: corpus.generated_at,
  completedAt: corpus.generated_at,
  outcome: corpus.observations.length > 0 ? "success" : "empty",
  rawCount: corpus.observations.length,
  excludedCount: 0,
  records: corpus.observations.map((observation) => ({
    evidenceType: "customer_observation",
    externalId: `${corpus.run_id}:${observation.observation_id}`,
    sourceRecordId: observation.source_id,
    sourceUrl: observation.page_url,
    entityRefs: [
      { kind: "product", key: corpus.product, label: corpus.product },
      { kind: "platform", key: observation.platform.toLowerCase(), label: observation.platform },
      { kind: "other", key: `source-family:${observation.source_family}`, label: observation.source_family },
    ],
    market: corpus.market,
    publishedAt: observation.published_at ?? null,
    collectedAt: observation.captured_at,
    rawPayloadRef: `${rawPayloadRef}#${observation.observation_id}`,
    contentExcerpt: observation.paraphrase,
    provenanceClass: "public_observation",
    themes: [observation.theme, observation.observation_type, observation.sentiment, observation.product_scope],
    quality: {
      access: "accessible",
      freshness: observation.published_at ? "dated" : "unknown",
      coverage: "bounded_sample",
      confidence,
    },
    claimBoundary: {
      supports: `支持当前有界语料中的“${observation.theme}”用户观察。`,
      cannotProve: "不能代表市场总体发生率，也不能证明尚未实测的目标 SKU 具备同样表现。",
    },
    intendedChapterIds: ["customers"],
    status: "active",
  })),
  boundary: corpus.denominator_definition,
});

export const summaryEvidenceBatch = ({
  runId,
  batchId,
  providerId,
  providerLabel,
  channel,
  acceptedCount,
  completedAt,
  boundary,
  sourceRunIds = [],
}: {
  runId: string;
  batchId: string;
  providerId: string;
  providerLabel: string;
  channel: string;
  acceptedCount: number;
  completedAt: string;
  boundary: string;
  sourceRunIds?: string[];
}): EvidenceBatchInput => evidenceBatchInputSchema.parse({
  schemaVersion: "1.0",
  batchId,
  runId,
  sourceRunIds,
  provider: { id: providerId, label: providerLabel, channel },
  acquisitionMethod: "manual-registration",
  fidelity: "summary_only",
  querySpec: {},
  requestedAt: completedAt,
  completedAt,
  outcome: acceptedCount > 0 ? "partial" : "empty",
  rawCount: acceptedCount,
  excludedCount: 0,
  summaryAcceptedCount: acceptedCount,
  records: [],
  boundary,
});
