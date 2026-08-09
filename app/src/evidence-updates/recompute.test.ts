import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recomputeEvidenceAnalysis } from "./recompute";
import { registerEvidenceBatch } from "./service";
import { evidenceBatchInputSchema, type EvidenceBatchInput } from "./types";

const runId = "research-run-recompute-yoga-test-us";

const customerBatch = (batchId: string, theme: string, count: number, platform: string): EvidenceBatchInput => evidenceBatchInputSchema.parse({
  schemaVersion: "1.0",
  batchId,
  runId,
  sourceRunIds: [runId],
  provider: { id: `provider.${platform.toLowerCase()}`, label: platform, channel: "voice-of-customer" },
  acquisitionMethod: "file-import",
  fidelity: "record_level",
  querySpec: {},
  requestedAt: "2026-08-08T01:00:00.000Z",
  completedAt: "2026-08-08T01:10:00.000Z",
  outcome: "success",
  rawCount: count,
  excludedCount: 0,
  records: Array.from({ length: count }, (_, index) => ({
    evidenceType: "customer_observation",
    externalId: `${batchId}-${index}`,
    sourceRecordId: `${platform}-${index}`,
    sourceUrl: `https://example.com/${platform}/${index}`,
    entityRefs: [
      { kind: "product", key: "yoga-pants", label: "Yoga pants" },
      { kind: "platform", key: platform.toLowerCase(), label: platform },
      { kind: "other", key: `source-family:${platform.toLowerCase()}`, label: platform },
    ],
    market: "US",
    collectedAt: "2026-08-08T01:10:00.000Z",
    rawPayloadRef: `${batchId}.json#${index}`,
    contentExcerpt: `A bounded observation about ${theme} number ${index}.`,
    provenanceClass: "public_observation",
    themes: [theme, "pain", "negative", "competitor_product"],
    quality: { access: "accessible", freshness: "unknown", coverage: "bounded_sample", confidence: "LOW" },
    claimBoundary: {
      supports: `Supports a bounded observation about ${theme}.`,
      cannotProve: "Cannot prove target SKU performance or market prevalence.",
    },
    intendedChapterIds: ["customers"],
    status: "active",
  })),
  boundary: "A bounded test corpus used only to verify deterministic report recomputation.",
});

describe("evidence analysis recomputation", () => {
  let root = "";

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "evidence-recompute-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("recomputes customer themes and records before/after conclusion changes", async () => {
    await registerEvidenceBatch({ input: customerBatch("BATCH-REDDIT-0001", "scrunch discomfort", 2, "Reddit"), root });
    await registerEvidenceBatch({ input: customerBatch("BATCH-AMAZON-0002", "fit and sizing", 3, "Amazon"), root });

    const analysis = await recomputeEvidenceAnalysis({ runId, root, now: "2026-08-08T02:00:00.000Z" });

    expect(analysis.snapshot.registryVersion).toBe(2);
    expect(analysis.snapshot.coverage).toMatchObject({ customerRecords: 5, platforms: 2, sourceFamilies: 2 });
    expect(analysis.snapshot.topThemes[0]).toMatchObject({ theme: "fit and sizing", label: "版型与尺码", count: 3 });
    expect(analysis.snapshot.conclusions.product).toContain("尺码、裤长和版型可预测性");
    expect(analysis.latestDiff).toMatchObject({ batchId: "BATCH-AMAZON-0002", fromVersion: 1, toVersion: 2, changed: true });
    expect(analysis.latestDiff?.conclusions.find((item) => item.chapterId === "customers")?.status).toBe("changed");
    expect(analysis.latestDiff?.topThemeChanges).toEqual(expect.arrayContaining([
      { theme: "fit and sizing", label: "版型与尺码", beforeCount: 0, afterCount: 3, delta: 3 },
    ]));
    await expect(access(path.join(root, "output", "codex-native", runId, "evidence-updates", "analysis", "latest.json"))).resolves.toBeUndefined();
  });
});
