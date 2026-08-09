import { readFile } from "node:fs/promises";
import path from "node:path";
import { evidenceBatchFromResearchSources, evidenceBatchFromVocCorpus, summaryEvidenceBatch } from "../src/evidence-updates/adapters";
import { writeEvidenceRegistryPrototypeData } from "../src/evidence-updates/prototype-export";
import { readEvidenceAnalysisBundle, recomputeEvidenceAnalysis } from "../src/evidence-updates/recompute";
import { readEvidenceUpdateRegistry, registerEvidenceBatch } from "../src/evidence-updates/service";
import { evidenceBatchInputSchema, type EvidenceBatchInput } from "../src/evidence-updates/types";
import { readEvidencePackage } from "../src/research/evidence-package";
import { vocCorpusSchema } from "../src/voc/types";

const option = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const flag = (name: string): boolean => process.argv.includes(`--${name}`);
const required = (name: string): string => {
  const value = option(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
};

const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(path.resolve(file), "utf8")) as unknown;

const appendUnlessRegistered = async (input: EvidenceBatchInput) => {
  const registry = await readEvidenceUpdateRegistry(input.runId);
  if (registry.batches.some((batch) => batch.batchId === input.batchId)) return { batchId: input.batchId, status: "already_registered" };
  const result = await registerEvidenceBatch({ input });
  return {
    batchId: input.batchId,
    status: "registered",
    counts: result.batch.counts,
    impactedChapterIds: result.batch.impactedChapterIds,
    versionId: result.version.versionId,
  };
};

const bootstrapYoga = async (): Promise<void> => {
  const runId = option("run") ?? "research-run-3d-yoga-pants-28f8bff32ab5-us";
  const historicalRunId = option("historical-run") ?? "research-run-3d-yoga-pants-dccf676c3167-us";
  const currentPackagePath = path.join(process.cwd(), "output", "research", runId);
  const currentCorpusPath = path.join(process.cwd(), "output", "codex-native", runId, "voc-corpus.json");
  const historicalCorpusPath = path.join(process.cwd(), "output", "codex-native", historicalRunId, "voc-corpus.json");
  const [evidencePackage, currentCorpus, historicalCorpus] = await Promise.all([
    readEvidencePackage(currentPackagePath),
    readJson(currentCorpusPath).then((payload) => vocCorpusSchema.parse(payload)),
    readJson(historicalCorpusPath).then((payload) => vocCorpusSchema.parse(payload)),
  ]);
  const batches = [
    evidenceBatchFromResearchSources({
      targetRunId: runId,
      evidencePackage,
      batchId: "BATCH-LIVE-WEB-20260801",
      completedAt: "2026-08-01T12:59:32.000Z",
    }),
    evidenceBatchFromVocCorpus({
      targetRunId: runId,
      corpus: currentCorpus,
      batchId: "BATCH-VOC-CURRENT-20260801",
      rawPayloadRef: path.relative(process.cwd(), currentCorpusPath),
      providerId: "provider.voc.current-run",
      providerLabel: "Current-run Reddit VoC",
      confidence: "LOW",
    }),
    evidenceBatchFromVocCorpus({
      targetRunId: runId,
      corpus: historicalCorpus,
      batchId: "BATCH-VOC-HISTORICAL-20260728",
      rawPayloadRef: path.relative(process.cwd(), historicalCorpusPath),
      providerId: "provider.voc.historical-run",
      providerLabel: "Historical multi-platform VoC",
      confidence: "HIGH",
    }),
    summaryEvidenceBatch({
      runId,
      batchId: "BATCH-PRICE-HISTORICAL-V1",
      providerId: "provider.price.historical-report",
      providerLabel: "Historical public price sample",
      channel: "public-price-observation",
      acceptedCount: 7,
      completedAt: "2026-08-04T00:00:00.000Z",
      sourceRunIds: [historicalRunId],
      boundary: "7 个价格点来自历史公开资料，范围为 $27.99–$78、中位数 $42；不含销量权重，当前仅有汇总级追溯能力。",
    }),
  ];
  const results = [];
  for (const batch of batches) results.push(await appendUnlessRegistered(batch));
  const registry = await readEvidenceUpdateRegistry(runId);
  const analysis = await recomputeEvidenceAnalysis({ runId });
  const prototypeData = await writeEvidenceRegistryPrototypeData(registry, undefined, analysis);
  console.log(JSON.stringify({
    status: "ready",
    runId,
    results,
    registry: {
      version: registry.version,
      updatedAt: registry.updatedAt,
      totals: registry.totals,
      batches: registry.batches,
    },
    analysis: {
      registryVersion: analysis.snapshot.registryVersion,
      customerRecords: analysis.snapshot.coverage.customerRecords,
      confidence: analysis.snapshot.confidence,
      latestMeaningfulDiff: analysis.latestMeaningfulDiff?.batchId ?? null,
    },
    prototypeData,
  }, null, 2));
};

const appendBatch = async (write: boolean): Promise<void> => {
  const input = evidenceBatchInputSchema.parse(await readJson(required("batch")));
  const result = await registerEvidenceBatch({ input, write });
  const analysis = write ? await recomputeEvidenceAnalysis({ runId: input.runId }) : null;
  if (write && flag("export-prototype")) await writeEvidenceRegistryPrototypeData(result.registry, undefined, analysis);
  console.log(JSON.stringify({
    status: write ? "registered" : "preview",
    batch: result.batch,
    version: result.version,
    analysis: analysis ? { snapshot: analysis.snapshot, latestDiff: analysis.latestDiff } : null,
    duplicateEvidence: result.duplicateEvidence,
  }, null, 2));
};

const appendVoc = async (write: boolean): Promise<void> => {
  const runId = required("run");
  const corpusFile = required("corpus");
  const corpus = vocCorpusSchema.parse(await readJson(corpusFile));
  const input = evidenceBatchFromVocCorpus({
    targetRunId: runId,
    corpus,
    batchId: required("batch-id"),
    rawPayloadRef: path.relative(process.cwd(), path.resolve(corpusFile)),
    providerId: option("provider-id") ?? `provider.voc.${corpus.run_id}`,
    providerLabel: option("provider-label") ?? "Imported VoC corpus",
    confidence: (option("confidence") ?? "LOW") as "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT",
  });
  const result = await registerEvidenceBatch({ input, write });
  const analysis = write ? await recomputeEvidenceAnalysis({ runId }) : null;
  if (write && flag("export-prototype")) await writeEvidenceRegistryPrototypeData(result.registry, undefined, analysis);
  console.log(JSON.stringify({ status: write ? "registered" : "preview", batch: result.batch, version: result.version, analysis }, null, 2));
};

const inspect = async (): Promise<void> => {
  const registry = await readEvidenceUpdateRegistry(required("run"));
  console.log(JSON.stringify(registry, null, 2));
};

const exportPrototype = async (): Promise<void> => {
  const registry = await readEvidenceUpdateRegistry(required("run"));
  const analysis = await readEvidenceAnalysisBundle(registry.runId);
  console.log(JSON.stringify({ status: "exported", file: await writeEvidenceRegistryPrototypeData(registry, undefined, analysis) }, null, 2));
};

const recompute = async (): Promise<void> => {
  const runId = required("run");
  const analysis = await recomputeEvidenceAnalysis({ runId });
  console.log(JSON.stringify({ status: "recomputed", runId, analysis }, null, 2));
};

const main = async (): Promise<void> => {
  const command = process.argv[2];
  if (command === "bootstrap-yoga") return bootstrapYoga();
  if (command === "append") return appendBatch(true);
  if (command === "preview") return appendBatch(false);
  if (command === "append-voc") return appendVoc(true);
  if (command === "preview-voc") return appendVoc(false);
  if (command === "inspect") return inspect();
  if (command === "recompute") return recompute();
  if (command === "export-prototype") return exportPrototype();
  throw new Error("Usage: tsx scripts/evidence_update_cli.ts <bootstrap-yoga|append|preview|append-voc|preview-voc|inspect|recompute|export-prototype> [options]");
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
