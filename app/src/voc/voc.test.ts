import path from "node:path";
import { describe, expect, it } from "vitest";
import type { EvidencePackage } from "../research/types";
import { summarizeVocCorpus } from "./service";
import { vocCorpusSchema, vocObservationSchema } from "./types";
import { validateVocCorpus } from "./validation";

const runId = "research-run-voc-test-us";
const packagePath = "/tmp/voc-test-package";
const source = {
  id: "SRC-VOC-001",
  url: "https://example.com/reviews",
  title: "Public product reviews",
  sourceType: "market" as const,
  retrievedAt: "2026-07-28T00:00:00.000Z",
  targetEntity: "Example competitor",
  targetMarket: "US",
  accessMethod: "web-fetch" as const,
  accessStatus: "accessible" as const,
  evidenceStatus: "verified" as const,
  snapshotPath: "source_snapshots/SRC-VOC-001.md",
  contentHash: "abc",
};

const evidencePackage = {
  packagePath,
  manifest: {
    packageVersion: "1.1",
    researchRunId: runId,
    createdAt: "2026-07-28T00:00:00.000Z",
    productName: "Test Product",
    targetMarket: "US",
    expectedFiles: [],
  },
  researchInput: {
    packageVersion: "1.1",
    researchRunId: runId,
    inputHash: "a".repeat(64),
    productName: "Test Product",
    targetMarket: "US",
    imagePaths: [],
    competitors: [],
    currentSupplierResources: [],
    currentChannelAssets: [],
    currentContentAssets: [],
    unacceptableRisks: [],
    createdAt: "2026-07-28T00:00:00.000Z",
  },
  researchPlan: {
    researchRunId: runId,
    inputHash: "a".repeat(64),
    productName: "Test Product",
    targetMarket: "US",
    competitorQueries: [],
    supplierQueries: [],
    regulationQueries: [],
    createdAt: "2026-07-28T00:00:00.000Z",
  },
  sources: [source],
  unresolvedItems: [],
} satisfies EvidencePackage;

const observation = {
  observation_id: "VOC-001",
  research_run_id: runId,
  source_id: source.id,
  snapshot_path: source.snapshotPath,
  platform: "Example",
  source_family: "marketplace" as const,
  page_url: source.url,
  page_title: source.title,
  captured_at: "2026-07-28T00:00:00.000Z",
  observation_type: "pain" as const,
  sentiment: "negative" as const,
  theme: "fit inconsistency",
  paraphrase: "The reviewer reports inconsistent fit between two purchases.",
  quote_excerpt: "the second pair fit very differently",
  product_scope: "competitor_product" as const,
  variant_match: "not_applicable" as const,
  firsthand_status: "explicit" as const,
  rating: { value: 2, scale_max: 5, platform: "Example" },
  privacy_reviewed: true as const,
  copyright_reviewed: true as const,
};

const corpus = {
  schema_version: "1.0" as const,
  run_id: runId,
  product: "Test Product",
  market: "US",
  generated_at: "2026-07-28T00:00:00.000Z",
  methodology: "VOICE_OF_CUSTOMER_RESEARCH_STANDARD_V1" as const,
  denominator_definition: "All valid comment-level observations in this bounded corpus.",
  source_pages: [{
    source_id: source.id,
    url: source.url,
    title: source.title,
    platform: "Example",
    source_family: "marketplace" as const,
    captured_at: "2026-07-28T00:00:00.000Z",
    access_status: "accessible" as const,
    snapshot_path: source.snapshotPath,
    product_scope: "competitor_product" as const,
    access_notes: "Public page body read.",
  }],
  observations: [observation],
  amazon_comment_level_evidence: false,
  limitations: ["Bounded convenience sample."],
};

const snapshotExists = (candidate: string): boolean =>
  candidate === path.join(packagePath, source.snapshotPath);

describe("VOC evidence validation", () => {
  it("accepts a traceable current-run observation and warns about missing counterevidence", () => {
    const result = validateVocCorpus(corpus, evidencePackage, snapshotExists);
    expect(result.valid).toBe(true);
    expect(result.summary.valid_observation_count).toBe(1);
    expect(result.warnings.map((item) => item.code)).toContain("VOC_COUNTEREVIDENCE_MISSING");
  });

  it("rejects run contamination and unknown Sources", () => {
    const result = validateVocCorpus({
      ...corpus,
      run_id: "research-run-other-product",
      observations: [{ ...observation, research_run_id: "research-run-other-product", source_id: "SRC-OTHER" }],
    }, evidencePackage, snapshotExists);
    expect(result.valid).toBe(false);
    expect(result.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      "VOC_RUN_MISMATCH",
      "VOC_OBSERVATION_SOURCE_MISSING",
    ]));
  });

  it("rejects duplicate excerpts, parent-listing target variants, and mismatched rating provenance", () => {
    const duplicate = {
      ...observation,
      observation_id: "VOC-002",
      product_scope: "parent_listing" as const,
      variant_match: "target_variant" as const,
      rating: { value: 2, scale_max: 5, platform: "Other" },
    };
    const result = validateVocCorpus({ ...corpus, observations: [observation, duplicate] }, evidencePackage, snapshotExists);
    expect(result.valid).toBe(false);
    expect(result.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      "DUPLICATE_VOC_EXCERPT",
      "VOC_PARENT_REVIEW_TARGET_VARIANT",
      "VOC_RATING_PROVENANCE_MISMATCH",
    ]));
  });

  it("computes MEDIUM confidence without a simplistic high comment-count gate", () => {
    const observations = Array.from({ length: 12 }, (_, index) => ({
      ...observation,
      observation_id: `VOC-${String(index + 1).padStart(3, "0")}`,
      source_family: index % 2 === 0 ? "marketplace" as const : "community" as const,
      observation_type: index === 11 ? "counterevidence" as const : "pain" as const,
      sentiment: index === 11 ? "positive" as const : "negative" as const,
      quote_excerpt: `short excerpt ${index + 1}`,
    }));
    const summary = summarizeVocCorpus(vocCorpusSchema.parse({
      ...corpus,
      source_pages: [
        corpus.source_pages[0],
        { ...corpus.source_pages[0], source_id: "SRC-VOC-002", url: "https://example.org/thread", source_family: "community" },
      ],
      observations,
    }));
    expect(summary.confidence).toBe("MEDIUM");
    expect(summary.coverage.valid_observations).toBe(12);
    expect(summary.coverage.source_family_count).toBe(2);
  });
});

describe("publication date", () => {
  const base = {
    observation_id: "VOC-001",
    research_run_id: "research-run-example-0000000000-us",
    source_id: "SRC-001",
    snapshot_path: "source_snapshots/SRC-001.md",
    platform: "Reddit",
    source_family: "community" as const,
    page_url: "https://example.com/thread",
    page_title: "A thread",
    captured_at: "2026-08-01T09:00:00.000Z",
    observation_type: "pain" as const,
    sentiment: "negative" as const,
    theme: "fit and sizing",
    paraphrase: "A wearer reported the waistband rolled down.",
    quote_excerpt: null,
    product_scope: "competitor_product" as const,
    variant_match: "unknown" as const,
    firsthand_status: "explicit" as const,
    rating: null,
    privacy_reviewed: true as const,
    copyright_reviewed: true as const,
  };

  it("keeps published_at through parsing so the write path cannot drop it", () => {
    // importVoc and the Amazon collector both parse-then-write; an unknown key
    // would be stripped silently and the date would never reach disk.
    const parsed = vocObservationSchema.parse({ ...base, published_at: "2024-11-03T10:00:00.000Z" });
    expect(parsed.published_at).toBe("2024-11-03T10:00:00.000Z");
  });

  it("accepts observations without a date, so existing corpora stay valid", () => {
    expect(vocObservationSchema.parse(base).published_at).toBeUndefined();
    expect(vocObservationSchema.parse({ ...base, published_at: null }).published_at).toBeNull();
  });

  it("rejects a value no date parser can read", () => {
    expect(() => vocObservationSchema.parse({ ...base, published_at: "sometime last year" })).toThrow();
  });

  it("accepts month precision, which is enough to tell evergreen from a spike", () => {
    // The project-wide isoDateTimeSchema validates via Date.parse, so a coarse
    // date from a surface that only shows "2024-11" is kept rather than dropped.
    expect(vocObservationSchema.parse({ ...base, published_at: "2024-11" }).published_at).toBe("2024-11");
  });
});
