import { describe, expect, it } from "vitest";
import type { FirstPrinciplesBundle } from "../first-principles/types";
import { vocCorpusSchema } from "../voc/types";
import { demandFieldSummaryMarkdown } from "./service";
import { demandFieldArtifactSchema } from "./types";
import { validateDemandFieldArtifact } from "./validation";

const runId = "research-run-demand-field-test-us";
const observations = [
  {
    observation_id: "VOC-001",
    research_run_id: runId,
    source_id: "SRC-001",
    snapshot_path: "source_snapshots/SRC-001.md",
    platform: "Reddit",
    source_family: "community" as const,
    page_url: "https://example.com/thread",
    page_title: "Public discussion",
    captured_at: "2026-07-29T00:00:00.000Z",
    observation_type: "pain" as const,
    sentiment: "negative" as const,
    theme: "wet floor",
    paraphrase: "Owners report residual water reaching the floor after cleaning.",
    quote_excerpt: null,
    product_scope: "category" as const,
    variant_match: "not_applicable" as const,
    firsthand_status: "explicit" as const,
    rating: null,
    privacy_reviewed: true as const,
    copyright_reviewed: true as const,
  },
  {
    observation_id: "VOC-002",
    research_run_id: runId,
    source_id: "SRC-002",
    snapshot_path: "source_snapshots/SRC-002.md",
    platform: "Retail",
    source_family: "marketplace" as const,
    page_url: "https://example.org/reviews",
    page_title: "Retail reviews",
    captured_at: "2026-07-29T00:00:00.000Z",
    observation_type: "alternative" as const,
    sentiment: "mixed" as const,
    theme: "towel workaround",
    paraphrase: "A towel is used after washing but adds handling and laundry.",
    quote_excerpt: null,
    product_scope: "competitor_product" as const,
    variant_match: "not_applicable" as const,
    firsthand_status: "explicit" as const,
    rating: null,
    privacy_reviewed: true as const,
    copyright_reviewed: true as const,
  },
];

const corpus = vocCorpusSchema.parse({
  schema_version: "1.0",
  run_id: runId,
  product: "Test Cleaner",
  market: "US",
  generated_at: "2026-07-29T00:00:00.000Z",
  methodology: "VOICE_OF_CUSTOMER_RESEARCH_STANDARD_V1",
  denominator_definition: "All bounded observations in this test corpus.",
  source_pages: [
    {
      source_id: "SRC-001",
      url: "https://example.com/thread",
      title: "Public discussion",
      platform: "Reddit",
      source_family: "community",
      captured_at: "2026-07-29T00:00:00.000Z",
      access_status: "accessible",
      snapshot_path: "source_snapshots/SRC-001.md",
      product_scope: "category",
      access_notes: "Public discussion captured for test.",
    },
    {
      source_id: "SRC-002",
      url: "https://example.org/reviews",
      title: "Retail reviews",
      platform: "Retail",
      source_family: "marketplace",
      captured_at: "2026-07-29T00:00:00.000Z",
      access_status: "accessible",
      snapshot_path: "source_snapshots/SRC-002.md",
      product_scope: "competitor_product",
      access_notes: "Public reviews captured for test.",
    },
  ],
  observations,
  amazon_comment_level_evidence: false,
  limitations: ["Bounded test corpus."],
});

const firstPrinciples = {
  run_id: runId,
  product: "Test Cleaner",
  market: "US",
  demand_atoms: [{
    id: "DEM-001",
    user_segment: "Owners returning from wet walks",
    scenario: "Home entry",
    trigger: "Wet paws",
    pain_or_job: "Avoid wet floors",
    desired_outcome: "Dry entry",
    current_alternative: "Towel",
    current_alternative_gap: "Extra handling",
    importance: "high",
    evidence_status: "directional",
    supporting_claim_ids: [],
    confidence: "medium",
  }],
} satisfies Pick<FirstPrinciplesBundle, "run_id" | "product" | "market" | "demand_atoms">;

const artifact = demandFieldArtifactSchema.parse({
  schema_version: "1.0",
  run_id: runId,
  product: "Test Cleaner",
  market: "US",
  generated_at: "2026-07-29T00:00:00.000Z",
  methodology: "FIRST_PRINCIPLES_DEMAND_FIELD_V1",
  source_artifacts: {
    voc_corpus: "output/codex-native/run/voc-corpus.json",
    first_principles_bundle: "output/codex-native/run/first-principles-bundle.json",
  },
  audience_clusters: [{
    id: "AUD-001",
    label: "Wet-weather pet owners",
    definition: "Owners trying to keep the entry area clean after wet walks.",
    behavioral_scope: "aggregated",
    supporting_observation_ids: ["VOC-001", "VOC-002"],
    supporting_demand_atom_ids: ["DEM-001"],
    excluded_demographic_inferences: ["No age, income, or identity inference"],
  }],
  scenarios: [{
    id: "SCN-001",
    label: "Post-walk entry",
    trigger: "Returning home with wet paws",
    job: "Finish cleaning before water reaches the floor",
    desired_outcome: "Dry paws and a clean entry",
    audience_cluster_ids: ["AUD-001"],
    supporting_observation_ids: ["VOC-001", "VOC-002"],
    supporting_demand_atom_ids: ["DEM-001"],
  }],
  need_atoms: [{
    id: "NEED-001",
    type: "alternative_gap",
    label: "Post-clean drying",
    statement: "Residual water requires a separate drying step.",
    current_alternative: "Household towel",
    alternative_gap: "Adds handling and laundry",
    evidence_status: "directional",
    supporting_observation_ids: ["VOC-001", "VOC-002"],
    counterevidence_observation_ids: [],
    supporting_demand_atom_ids: ["DEM-001"],
  }],
  task_chain: [{
    id: "TASK-001",
    sequence: 1,
    label: "Dry after cleaning",
    job: "Remove residual water before entering the home",
    relative_to_current_product: "post_use",
    scenario_ids: ["SCN-001"],
    need_atom_ids: ["NEED-001"],
  }],
  adjacent_opportunities: [{
    id: "ADJ-001",
    title: "Dedicated quick-dry pet towel",
    candidate_category: "Pet drying towel",
    relationship_types: ["POST_USE", "COMPLEMENTARY"],
    audience_cluster_ids: ["AUD-001"],
    scenario_ids: ["SCN-001"],
    need_atom_ids: ["NEED-001"],
    task_step_ids: ["TASK-001"],
    evidence_status: "supported",
    relationship_strength: "moderate",
    direct_product_evidence: true,
    supporting_observation_ids: ["VOC-001", "VOC-002"],
    counterevidence_observation_ids: [],
    rationale: "A separate towel is directly present in the same post-cleaning task.",
    why_not_approved: "Demand size, product differentiation, supply, and economics are not validated.",
    status: "RESEARCH_MORE",
    next_research_queries: ["pet paw drying towel complaints", "wet dog entry cleanup alternatives"],
    validation_questions: ["Is a dedicated towel materially better than an old household towel?"],
  }],
  limitations: ["This is a bounded test artifact, not a market prevalence estimate."],
  decision_boundary: {
    current_product_decision_unchanged: true,
    adjacent_opportunities_not_approved: true,
    new_research_run_required: true,
  },
});

describe("Demand Field Artifact", () => {
  it("validates current-run evidence mappings and preserves the decision boundary", () => {
    const result = validateDemandFieldArtifact(artifact, corpus, firstPrinciples);
    expect(result.valid).toBe(true);
    expect(result.summary.mapping_error_count).toBe(0);
    expect(result.summary.source_family_count).toBe(2);
    expect(result.summary.direct_opportunity_count).toBe(1);
  });

  it("rejects inferred products presented as supported", () => {
    const invalid = {
      ...artifact,
      adjacent_opportunities: [{
        ...artifact.adjacent_opportunities[0],
        direct_product_evidence: false,
        supporting_observation_ids: ["VOC-OTHER-RUN"],
      }],
    };
    const result = validateDemandFieldArtifact(invalid, corpus, firstPrinciples);
    expect(result.valid).toBe(false);
    expect(result.errors.map((item) => item.code)).toContain("INVALID_DEMAND_FIELD_SCHEMA");
  });

  it("rejects Observation IDs outside the current Research Run", () => {
    const invalid = {
      ...artifact,
      adjacent_opportunities: [{
        ...artifact.adjacent_opportunities[0],
        supporting_observation_ids: ["VOC-OTHER-RUN"],
      }],
    };
    const result = validateDemandFieldArtifact(invalid, corpus, firstPrinciples);
    expect(result.valid).toBe(false);
    expect(result.errors.map((item) => item.code)).toContain("OBSERVATION_NOT_IN_CURRENT_RUN");
  });

  it("renders a seller-readable research-only opportunity summary", () => {
    const markdown = demandFieldSummaryMarkdown(artifact);
    expect(markdown).toContain("连续选品机会地图");
    expect(markdown).toContain("Dedicated quick-dry pet towel");
    expect(markdown).toContain("相邻机会已获批准：否");
    expect(markdown).toContain("概念级营销表达");
    expect(markdown).toContain("概念测试草案");
    expect(markdown).toContain("核心价值主张");
  });
});
