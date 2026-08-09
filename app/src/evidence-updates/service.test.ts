import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readEvidenceUpdateRegistry, registerEvidenceBatch } from "./service";
import { evidenceBatchInputSchema, type EvidenceBatchInput } from "./types";

const runId = "research-run-3d-yoga-pants-test-us";

const batch = (batchId: string, externalId = "R-001"): EvidenceBatchInput => evidenceBatchInputSchema.parse({
  schemaVersion: "1.0",
  batchId,
  runId,
  sourceRunIds: [runId],
  provider: { id: "provider.amazon.reviews", label: "Amazon Reviews", channel: "Amazon US" },
  acquisitionMethod: "file-import",
  fidelity: "record_level",
  querySpec: { asin: "B08SLZPCCV" },
  requestedAt: "2026-08-08T01:00:00.000Z",
  completedAt: "2026-08-08T01:01:00.000Z",
  outcome: "success",
  rawCount: 1,
  excludedCount: 0,
  records: [{
    evidenceType: "customer_observation",
    externalId,
    sourceRecordId: "SRC-AMZ-001",
    sourceUrl: "https://www.amazon.com/dp/B08SLZPCCV?ref_=tracking",
    entityRefs: [{ kind: "product", key: "3d-yoga-pants", label: "3D yoga pants" }],
    market: "US",
    locale: "en-US",
    publishedAt: "2026-08-01T00:00:00.000Z",
    collectedAt: "2026-08-08T01:01:00.000Z",
    rawPayloadRef: "imports/amazon-b02.json#R-001",
    contentExcerpt: "The waistband stayed in place during a workout.",
    provenanceClass: "public_observation",
    themes: ["waistband stability", "positive_evidence"],
    quality: { access: "accessible", freshness: "dated", coverage: "bounded_sample", confidence: "MEDIUM" },
    claimBoundary: {
      supports: "Supports a bounded customer observation about waistband stability.",
      cannotProve: "Cannot prove category-wide incidence or target SKU performance.",
    },
    intendedChapterIds: ["customers"],
    status: "active",
  }],
  boundary: "A bounded imported customer review batch that does not represent the whole market.",
});

describe("evidence update registry", () => {
  let root = "";

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "evidence-update-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("registers an append-only batch, computes impact and writes a version diff", async () => {
    const result = await registerEvidenceBatch({
      input: batch("BATCH-AMAZON-0001"),
      root,
      now: "2026-08-08T02:00:00.000Z",
    });

    expect(result.batch.counts).toEqual({ raw: 1, parsed: 1, duplicates: 0, excluded: 0, accepted: 1 });
    expect(result.batch.impactedChapterIds).toEqual(expect.arrayContaining([
      "customers", "positioning", "marketing", "decision", "evidence", "updates", "first_principles",
    ]));
    expect(result.version.changedMetrics).toEqual(expect.arrayContaining([
      { field: "accepted", before: 0, after: 1, delta: 1 },
      { field: "batches", before: 0, after: 1, delta: 1 },
    ]));
    const registry = await readEvidenceUpdateRegistry(runId, root);
    expect(registry.version).toBe(1);
    expect(registry.totals.accepted).toBe(1);
    expect(JSON.parse(await readFile(path.join(root, "output", "codex-native", runId, "evidence-updates", "batches", "BATCH-AMAZON-0001.json"), "utf8"))).toMatchObject({ batchId: "BATCH-AMAZON-0001" });
  });

  it("deduplicates a later batch without deleting the original record", async () => {
    const first = await registerEvidenceBatch({ input: batch("BATCH-AMAZON-0001"), root, now: "2026-08-08T02:00:00.000Z" });
    const second = await registerEvidenceBatch({ input: batch("BATCH-AMAZON-0002"), root, now: "2026-08-08T03:00:00.000Z" });

    expect(first.batch.records).toHaveLength(1);
    expect(second.batch.records).toHaveLength(0);
    expect(second.batch.counts.duplicates).toBe(1);
    expect(second.duplicateEvidence[0]?.priorBatchId).toBe("BATCH-AMAZON-0001");
    expect(second.registry.totals).toMatchObject({ batches: 2, raw: 2, parsed: 2, duplicates: 1, accepted: 1 });
  });

  it("supports summary-only legacy data while keeping its weaker fidelity visible", async () => {
    const input = evidenceBatchInputSchema.parse({
      schemaVersion: "1.0",
      batchId: "BATCH-PRICE-LEGACY-001",
      runId,
      sourceRunIds: [],
      provider: { id: "provider.price.legacy", label: "Legacy price sample", channel: "public prices" },
      acquisitionMethod: "manual-registration",
      fidelity: "summary_only",
      querySpec: {},
      requestedAt: "2026-08-08T01:00:00.000Z",
      completedAt: "2026-08-08T01:00:00.000Z",
      outcome: "partial",
      rawCount: 7,
      excludedCount: 0,
      summaryAcceptedCount: 7,
      records: [],
      boundary: "Only a seven-price summary is available; record-level lineage is still missing.",
    });
    const result = await registerEvidenceBatch({ input, root, now: "2026-08-08T02:00:00.000Z" });
    expect(result.batch.counts.accepted).toBe(7);
    expect(result.batch.impactedChapterIds).toEqual(["evidence", "updates"]);
    expect(result.registry.evidenceIndex).toEqual({});
  });

  it("can preview an update without creating registry files", async () => {
    const result = await registerEvidenceBatch({ input: batch("BATCH-AMAZON-PREVIEW"), root, write: false });
    expect(result.written).toBe(false);
    await expect(access(path.join(root, "output", "codex-native", runId, "evidence-updates", "registry.json"))).rejects.toThrow();
  });
});
