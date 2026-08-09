import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeUrl } from "../research/source-normalizer";
import {
  evidenceBatchInputSchema,
  evidenceUpdateRegistrySchema,
  evidenceUpdateVersionSchema,
  registeredEvidenceBatchSchema,
  type EvidenceBatchInput,
  type EvidenceUpdateChapterId,
  type EvidenceUpdateRecord,
  type EvidenceUpdateRegistry,
  type EvidenceUpdateVersion,
  type RegisteredEvidenceBatch,
} from "./types";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const evidenceUpdatePaths = (runId: string, root = process.cwd()) => {
  const directory = path.join(root, "output", "codex-native", runId, "evidence-updates");
  return {
    directory,
    registry: path.join(directory, "registry.json"),
    batches: path.join(directory, "batches"),
    versions: path.join(directory, "versions"),
    analysis: path.join(directory, "analysis"),
  };
};

const atomicWriteJson = async (file: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${Date.now()}.tmp`;
  await writeFile(temporary, json(value), "utf8");
  await rename(temporary, file);
};

const emptyTotals = () => ({ batches: 0, raw: 0, parsed: 0, duplicates: 0, excluded: 0, accepted: 0 });

export const emptyEvidenceUpdateRegistry = (runId: string, now = new Date().toISOString()): EvidenceUpdateRegistry =>
  evidenceUpdateRegistrySchema.parse({
    schemaVersion: "1.0",
    runId,
    version: 0,
    updatedAt: now,
    batches: [],
    evidenceIndex: {},
    totals: emptyTotals(),
  });

export const readEvidenceUpdateRegistry = async (
  runId: string,
  root = process.cwd(),
): Promise<EvidenceUpdateRegistry> => {
  try {
    return evidenceUpdateRegistrySchema.parse(JSON.parse(await readFile(evidenceUpdatePaths(runId, root).registry, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyEvidenceUpdateRegistry(runId);
    throw error;
  }
};

const contentHash = (record: EvidenceUpdateRecord): string | undefined => {
  if (record.contentHash) return record.contentHash;
  const content = record.contentExcerpt ?? (record.metric ? JSON.stringify(record.metric) : undefined);
  return content ? createHash("sha256").update(content.trim().toLowerCase()).digest("hex") : undefined;
};

const evidenceId = (runId: string, providerId: string, record: EvidenceUpdateRecord, hash?: string): string => {
  if (record.evidenceId) return record.evidenceId;
  const identity = record.externalId ?? record.sourceRecordId ?? record.sourceUrl ?? hash ?? JSON.stringify(record.metric);
  return `EV-${createHash("sha256").update(`${runId}:${providerId}:${identity}`).digest("hex").slice(0, 20)}`;
};

const recordKeys = (providerId: string, record: EvidenceUpdateRecord): string[] => {
  const keys: string[] = [];
  if (record.externalId) keys.push(`external:${providerId}:${record.externalId.trim().toLowerCase()}`);
  if (record.sourceUrl && !record.externalId) keys.push(`url:${record.evidenceType}:${normalizeUrl(record.sourceUrl)}`);
  const hash = contentHash(record);
  if (hash && (record.evidenceType !== "customer_observation" || !record.externalId)) keys.push(`hash:${hash}`);
  return [...new Set(keys)];
};

const defaultChapterMap: Record<EvidenceUpdateRecord["evidenceType"], EvidenceUpdateChapterId[]> = {
  customer_observation: ["customers", "positioning", "marketing", "decision", "evidence", "updates"],
  market_metric: ["market", "economics", "decision", "evidence", "updates"],
  competitor_observation: ["competitors", "market", "marketing", "decision", "evidence", "updates"],
  supplier_observation: ["sourcing", "economics", "positioning", "decision", "evidence", "updates"],
  regulation_observation: ["sourcing", "marketing", "decision", "evidence", "updates"],
  experiment_result: ["validation", "positioning", "marketing", "economics", "decision", "evidence", "updates"],
  source_observation: ["evidence", "updates"],
};

const impactedChapters = (records: EvidenceUpdateRecord[], fidelity: EvidenceBatchInput["fidelity"]): EvidenceUpdateChapterId[] => {
  const chapters = new Set<EvidenceUpdateChapterId>(fidelity === "summary_only" ? ["evidence", "updates"] : []);
  for (const record of records) {
    for (const chapter of [...defaultChapterMap[record.evidenceType], ...record.intendedChapterIds]) chapters.add(chapter);
    if (record.themes.some((theme) => /fit|size|comfort|opacity|scrunch|waist|contour|appearance/iu.test(theme))) {
      chapters.add("first_principles");
    }
  }
  return [...chapters];
};

const changedMetrics = (
  before: EvidenceUpdateRegistry["totals"],
  after: EvidenceUpdateRegistry["totals"],
): EvidenceUpdateVersion["changedMetrics"] =>
  (Object.keys(after) as Array<keyof typeof after>).flatMap((field) => before[field] === after[field] ? [] : [{
    field,
    before: before[field],
    after: after[field],
    delta: after[field] - before[field],
  }]);

export type RegisterEvidenceBatchResult = {
  batch: RegisteredEvidenceBatch;
  registry: EvidenceUpdateRegistry;
  version: EvidenceUpdateVersion;
  duplicateEvidence: Array<{ evidenceId: string; matchedKey: string; priorBatchId: string }>;
  written: boolean;
};

export const registerEvidenceBatch = async ({
  input,
  root = process.cwd(),
  now = new Date().toISOString(),
  write = true,
}: {
  input: EvidenceBatchInput;
  root?: string;
  now?: string;
  write?: boolean;
}): Promise<RegisterEvidenceBatchResult> => {
  const batchInput = evidenceBatchInputSchema.parse(input);
  const current = await readEvidenceUpdateRegistry(batchInput.runId, root);
  if (current.runId !== batchInput.runId) throw new Error(`Evidence update registry belongs to ${current.runId}`);
  if (current.batches.some((batch) => batch.batchId === batchInput.batchId)) {
    throw new Error(`Evidence batch already registered: ${batchInput.batchId}`);
  }

  const nextIndex = { ...current.evidenceIndex };
  const accepted: RegisteredEvidenceBatch["records"] = [];
  const duplicateEvidence: RegisterEvidenceBatchResult["duplicateEvidence"] = [];
  for (const rawRecord of batchInput.records) {
    const hash = contentHash(rawRecord);
    const normalizedRecord = evidenceUpdateRecordSchemaWithId(batchInput.runId, batchInput.provider.id, rawRecord, hash);
    const keys = recordKeys(batchInput.provider.id, normalizedRecord);
    const matchedKey = keys.find((key) => nextIndex[key]);
    if (matchedKey) {
      duplicateEvidence.push({
        evidenceId: normalizedRecord.evidenceId,
        matchedKey,
        priorBatchId: nextIndex[matchedKey].batchId,
      });
      continue;
    }
    accepted.push(normalizedRecord);
    for (const key of keys) nextIndex[key] = { evidenceId: normalizedRecord.evidenceId, batchId: batchInput.batchId };
  }

  const acceptedCount = batchInput.fidelity === "summary_only"
    ? batchInput.summaryAcceptedCount ?? 0
    : accepted.length;
  const counts = {
    raw: batchInput.rawCount,
    parsed: batchInput.records.length,
    duplicates: duplicateEvidence.length,
    excluded: batchInput.excludedCount,
    accepted: acceptedCount,
  };
  const chapters = impactedChapters(accepted, batchInput.fidelity);
  const batch = registeredEvidenceBatchSchema.parse({
    ...batchInput,
    registeredAt: now,
    counts,
    impactedChapterIds: chapters,
    records: accepted,
  });
  const totalsAfter = {
    batches: current.totals.batches + 1,
    raw: current.totals.raw + counts.raw,
    parsed: current.totals.parsed + counts.parsed,
    duplicates: current.totals.duplicates + counts.duplicates,
    excluded: current.totals.excluded + counts.excluded,
    accepted: current.totals.accepted + counts.accepted,
  };
  const registry = evidenceUpdateRegistrySchema.parse({
    ...current,
    version: current.version + 1,
    updatedAt: now,
    evidenceIndex: nextIndex,
    totals: totalsAfter,
    batches: [...current.batches, {
      batchId: batch.batchId,
      providerId: batch.provider.id,
      providerLabel: batch.provider.label,
      channel: batch.provider.channel,
      fidelity: batch.fidelity,
      completedAt: batch.completedAt,
      counts: batch.counts,
      impactedChapterIds: batch.impactedChapterIds,
      boundary: batch.boundary,
    }],
  });
  const versionId = `VER-${String(registry.version).padStart(4, "0")}-${batch.batchId}`;
  const version = evidenceUpdateVersionSchema.parse({
    schemaVersion: "1.0",
    versionId,
    runId: batch.runId,
    batchId: batch.batchId,
    createdAt: now,
    registryVersionBefore: current.version,
    registryVersionAfter: registry.version,
    counts,
    impactedChapterIds: chapters,
    totalsBefore: current.totals,
    totalsAfter,
    changedMetrics: changedMetrics(current.totals, totalsAfter),
    boundary: "本版本只登记新增证据批次和受影响章节；结论是否改变仍需经过结论治理与人工发布门禁。",
  });

  if (write) {
    const paths = evidenceUpdatePaths(batch.runId, root);
    await Promise.all([
      atomicWriteJson(path.join(paths.batches, `${batch.batchId}.json`), batch),
      atomicWriteJson(path.join(paths.versions, `${version.versionId}.json`), version),
    ]);
    await atomicWriteJson(paths.registry, registry);
  }

  return { batch, registry, version, duplicateEvidence, written: write };
};

const evidenceUpdateRecordSchemaWithId = (
  runId: string,
  providerId: string,
  record: EvidenceUpdateRecord,
  hash?: string,
): RegisteredEvidenceBatch["records"][number] => {
  const normalized = {
    ...record,
    sourceUrl: record.sourceUrl ? normalizeUrl(record.sourceUrl) : undefined,
    contentHash: hash,
    evidenceId: evidenceId(runId, providerId, record, hash),
  };
  return registeredEvidenceBatchSchema.shape.records.element.parse(normalized);
};
