import { render, screen } from "@testing-library/react";
import type { PrismaClient } from "@prisma/client";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FirstPrinciplesView } from "./first-principles-view";
import { firstPrinciplesSummaryMarkdown, persistFirstPrinciplesStage, resolveCurrentResearchRunCandidate } from "./service";
import type { FirstPrinciplesBundle } from "./types";
import { validateFirstPrinciplesBundle, type FirstPrinciplesValidationContext } from "./validation";
import { generateLiveResearchReports } from "../research/live-report";
import type { EvidencePackage } from "../research/types";
import type { LiveResearchAnalysis } from "../research/live-types";

const runId = "research-run-test-current-us";

describe("current Research Run selection", () => {
  it("recovers from a valid but stale pointer by selecting the newest evidence package", () => {
    const selected = resolveCurrentResearchRunCandidate([
      { researchRunId: "research-run-old-us", packagePath: "/tmp/old", createdAt: "2026-08-10T07:11:52.889Z" },
      { researchRunId: "research-run-lt700p-us", packagePath: "/tmp/lt700p", createdAt: "2026-08-10T14:20:29.193Z" },
    ]);

    expect(selected?.researchRunId).toBe("research-run-lt700p-us");
  });
});
const score = (value = 60) => ({
  score: value,
  status: "scored" as const,
  rationale: "Bounded test score",
  claim_ids: ["CLM-TARGET"],
});

const makeBundle = (): FirstPrinciplesBundle => ({
  schema_version: "1.0",
  run_id: runId,
  product: "Test leggings",
  market: "US",
  generated_at: "2026-07-24T08:30:00.000Z",
  methodology: "SACL",
  resources: {
    budget: "$500",
    available_time: "14 days",
    team_size: 1,
    current_supplier_resources: [],
    current_channel_assets: [],
    current_content_assets: [],
    acceptable_moq: null,
    target_margin: null,
    unacceptable_risks: ["Unsubstantiated claims"],
    preferred_business_model: "DTC",
    validation_goal: "Decide whether to order samples",
  },
  problem_reframe: {
    surface_product: "Test leggings",
    conventional_question: "Should we sell leggings?",
    reframed_problem: "How can a buyer get reliable opacity and fit without unsupported claims?",
    target_user: "US activewear buyers",
    triggering_scenario: "Deep squat training",
    desired_outcome: "Reliable fit and opacity",
    willingness_to_pay_reason: "Reduced garment failure risk",
    supporting_claim_ids: ["CLM-MARKET"],
    assumptions: ["Proof may improve confidence"],
  },
  fact_hypothesis_unknown: {
    facts: [{
      id: "FACT-1",
      statement: "Target products require compliant labels.",
      classification: "fact",
      scope: "target_product",
      supporting_claim_ids: ["CLM-TARGET"],
      confidence: "high",
      rationale: "Applicable regulatory evidence",
      validation_required: true,
    }],
    hypotheses: [{
      id: "HYP-1",
      statement: "Proof-led positioning may improve purchase confidence.",
      classification: "hypothesis",
      scope: "market",
      supporting_claim_ids: ["CLM-MARKET"],
      confidence: "medium",
      rationale: "Directionally supported",
      validation_required: true,
    }],
    unknowns: [{
      id: "UNK-1",
      statement: "Formal target SKU economics remain unknown.",
      classification: "unknown",
      scope: "target_product",
      supporting_claim_ids: [],
      confidence: "low",
      rationale: "No supplier quote exists",
      validation_required: true,
    }],
  },
  demand_atoms: [{
    id: "DEM-1",
    user_segment: "US activewear buyers",
    scenario: "Deep squat training",
    trigger: "Opacity uncertainty",
    pain_or_job: "Avoid garment exposure",
    desired_outcome: "Verified squat opacity",
    current_alternative: "Generic leggings",
    current_alternative_gap: "No exact SKU proof",
    importance: "high",
    evidence_status: "directional",
    supporting_claim_ids: ["CLM-MARKET"],
    confidence: "medium",
  }],
  supply_atoms: [{
    id: "SUP-1",
    category: "material",
    name: "Fabric sample",
    description: "Candidate stretch fabric for testing",
    independently_sourceable: true,
    cost_visibility: "unknown",
    customization_level: "light_customization",
    supplier_or_source_signal_claim_ids: ["CLM-MARKET"],
    target_sku_verified: false,
    confidence: "low",
  }],
  constraints: {
    hard: [{
      id: "CON-H1",
      type: "hard",
      statement: "No unsupported health claims",
      impact: "Blocks risky advertising",
      design_response: "Use apparel performance claims only",
      supporting_claim_ids: ["CLM-TARGET"],
      confidence: "high",
    }],
    soft: [],
    pseudo: [{
      id: "CON-P1",
      type: "pseudo",
      statement: "A visible scrunch is not mandatory",
      impact: "Keeps construction options open",
      design_response: "Test subtle alternatives",
      supporting_claim_ids: ["CLM-MARKET"],
      confidence: "medium",
    }],
  },
  opportunity_hypotheses: ["OPP-1", "OPP-2"].map((id, index) => ({
    id,
    title: index === 0 ? "Proof-first fit" : "Utility fit",
    target_demand_atom_ids: ["DEM-1"],
    supply_atom_ids: ["SUP-1"],
    product_or_offer_concept: "A bounded sample concept",
    target_customer: "US activewear buyers",
    target_scenario: "Gym and daily use",
    core_value_proposition: index === 0 ? "Verified fit and opacity" : "Practical daily utility",
    differentiation: ["Evidence-led proof"],
    explicit_non_goals: ["No health claims"],
    required_claim_ids: ["CLM-TARGET"],
    unsupported_assumptions: ["Willingness to pay remains unknown"],
    primary_risks: ["Physical performance is unverified"],
    feasibility: "medium",
    desirability: "medium",
    evidence_strength: "medium",
    estimated_test_cost_level: "low",
    scores: {
      demand_fit: score(),
      evidence_strength: score(),
      differentiation: score(),
      supply_feasibility: score(),
      constraint_fit: score(),
      validation_cost: score(),
      monetization_potential: score(),
      risk_exposure: score(),
    },
    score: index === 0 ? 62 : 54,
    score_rationale: "Suitable for bounded validation",
  })),
  recommended_opportunity_id: "OPP-1",
  recommendation_rationale: "Validate the strongest bounded opportunity first.",
  alternatives_not_recommended: [{ opportunity_id: "OPP-2", reason: "Lower differentiation" }],
  validation_plan: [7, 10, 14].map((duration, index) => ({
    id: `EXP-${index + 1}`,
    opportunity_id: "OPP-1",
    critical_assumption: `Critical assumption ${index + 1}`,
    test_type: index === 0 ? "concept_test" : index === 1 ? "sample_test" : "unit_economics_check",
    target_participant_or_source: "Qualified buyers or sample",
    method: "Run a bounded documented test",
    sample_size_or_scope: "One defined cohort",
    budget_cap: "$200",
    duration_days: duration,
    metric: "Defined test outcome",
    pass_threshold: "At least 60 percent",
    fail_threshold: "Below 40 percent",
    stop_condition: "Safety or evidence boundary breach",
    next_action_if_pass: "Continue controlled validation",
    next_action_if_fail: "Stop or revise the opportunity",
  })),
  decision_summary: {
    first_principles_recommendation: "Validate OPP-1",
    product_selection_decision: "PROCEED_TO_SAMPLE",
    formal_sku_decision: "HOLD_SUPPLY",
    listing_allowed: false,
    ad_test_allowed: false,
    evidence_strength: "medium",
    entry_conditions: ["Verify target SKU"],
    boundary_rationale: "Formal supplier and product evidence are missing.",
  },
});

const makeContext = (): FirstPrinciplesValidationContext => ({
  researchRunId: runId,
  product: "Test leggings",
  market: "US",
  dataOrigin: "research_package",
  resourceInputComplete: true,
  claims: [
    { id: "CLM-TARGET", sourceId: "SRC-1", statement: "Labels are required", evidence: "Applicable rule", confidence: "High", category: "regulation", targetScope: "target_product" },
    { id: "CLM-MARKET", sourceId: "SRC-2", statement: "Buyers discuss opacity", evidence: "Market discussion", confidence: "Medium", category: "market", targetScope: "market" },
  ],
});

const codes = (bundle: FirstPrinciplesBundle, context = makeContext()) =>
  validateFirstPrinciplesBundle(bundle, context).errors.map((item) => item.code);

describe("First-Principles schema and evidence integrity", () => {
  it("accepts a valid evidence-bounded bundle", () => {
    expect(validateFirstPrinciplesBundle(makeBundle(), makeContext()).valid).toBe(true);
  });

  it("rejects a mismatched Research Run", () => {
    const bundle = makeBundle();
    bundle.run_id = "research-run-other-us";
    expect(codes(bundle)).toContain("RUN_ID_MISMATCH");
  });

  it("rejects a mismatched product", () => {
    const bundle = makeBundle();
    bundle.product = "Other product";
    expect(codes(bundle)).toContain("PRODUCT_MISMATCH");
  });

  it("rejects a mismatched market", () => {
    const bundle = makeBundle();
    bundle.market = "UK";
    expect(codes(bundle)).toContain("MARKET_MISMATCH");
  });

  it("rejects fixture evidence as a live opportunity run", () => {
    expect(codes(makeBundle(), { ...makeContext(), dataOrigin: "fixture" })).toContain("FIXTURE_CLAIM_FOR_LIVE_RUN");
  });

  it("rejects a Claim outside the current Run", () => {
    const bundle = makeBundle();
    bundle.demand_atoms[0].supporting_claim_ids = ["CLM-OTHER"];
    expect(codes(bundle)).toContain("CLAIM_NOT_IN_CURRENT_RUN");
  });

  it("rejects a Demand Atom missing its scenario", () => {
    const bundle = structuredClone(makeBundle()) as unknown as Record<string, unknown>;
    ((bundle.demand_atoms as Array<Record<string, unknown>>)[0]).scenario = "";
    expect(validateFirstPrinciplesBundle(bundle, makeContext()).errors.map((item) => item.code)).toContain("SCHEMA_VALIDATION_FAILED");
  });

  it("requires evidence for facts", () => {
    const bundle = makeBundle();
    bundle.fact_hypothesis_unknown.facts[0].supporting_claim_ids = [];
    expect(codes(bundle)).toContain("SCHEMA_VALIDATION_FAILED");
  });

  it("prevents high-confidence hypotheses", () => {
    const bundle = makeBundle();
    bundle.fact_hypothesis_unknown.hypotheses[0].confidence = "high";
    expect(codes(bundle)).toContain("SCHEMA_VALIDATION_FAILED");
  });

  it("requires unknowns to remain marked for validation", () => {
    const bundle = makeBundle();
    bundle.fact_hypothesis_unknown.unknowns[0].validation_required = false;
    expect(codes(bundle)).toContain("SCHEMA_VALIDATION_FAILED");
  });

  it("rejects unknown values replaced by zero defaults", () => {
    const bundle = makeBundle();
    bundle.fact_hypothesis_unknown.unknowns[0].statement = "Landed cost = 0";
    expect(codes(bundle)).toContain("UNKNOWN_DEFAULTED");
  });

  it("blocks competitor or market evidence migration into a target fact", () => {
    const bundle = makeBundle();
    bundle.fact_hypothesis_unknown.facts[0].supporting_claim_ids = ["CLM-MARKET"];
    expect(codes(bundle)).toContain("COMPETITOR_EVIDENCE_MIGRATION");
  });

  it("blocks supplier candidates from becoming a verified target SKU", () => {
    const bundle = makeBundle();
    bundle.supply_atoms[0].target_sku_verified = true;
    expect(codes(bundle)).toContain("SUPPLY_CANDIDATE_MIGRATED_TO_TARGET_SKU");
  });

  it("enforces hard, soft, and pseudo constraint enums", () => {
    const bundle = structuredClone(makeBundle()) as unknown as Record<string, unknown>;
    (((bundle.constraints as Record<string, unknown>).hard as Array<Record<string, unknown>>)[0]).type = "optional";
    expect(validateFirstPrinciplesBundle(bundle, makeContext()).errors.map((item) => item.code)).toContain("SCHEMA_VALIDATION_FAILED");
  });

  it("rejects missing Demand Atom references", () => {
    const bundle = makeBundle();
    bundle.opportunity_hypotheses[0].target_demand_atom_ids = ["DEM-MISSING"];
    expect(codes(bundle)).toContain("DEMAND_ATOM_NOT_FOUND");
  });

  it("rejects missing Supply Atom references", () => {
    const bundle = makeBundle();
    bundle.opportunity_hypotheses[0].supply_atom_ids = ["SUP-MISSING"];
    expect(codes(bundle)).toContain("SUPPLY_ATOM_NOT_FOUND");
  });

  it("rejects a missing recommended opportunity", () => {
    const bundle = makeBundle();
    bundle.recommended_opportunity_id = "OPP-MISSING";
    expect(codes(bundle)).toContain("RECOMMENDED_OPPORTUNITY_NOT_FOUND");
  });

  it("requires at least three experiments for the recommendation", () => {
    const bundle = makeBundle();
    bundle.validation_plan = bundle.validation_plan.slice(0, 2);
    expect(codes(bundle)).toContain("INSUFFICIENT_RECOMMENDED_EXPERIMENTS");
  });

  it("requires pass, fail, and stop criteria", () => {
    const bundle = structuredClone(makeBundle()) as unknown as Record<string, unknown>;
    const experiment = (bundle.validation_plan as Array<Record<string, unknown>>)[0];
    experiment.pass_threshold = "";
    experiment.fail_threshold = "";
    experiment.stop_condition = "";
    expect(validateFirstPrinciplesBundle(bundle, makeContext()).errors.map((item) => item.code)).toContain("SCHEMA_VALIDATION_FAILED");
  });

  it("requires a 7-14 day validation window", () => {
    const bundle = makeBundle();
    bundle.validation_plan.forEach((item) => { item.duration_days = 5; });
    expect(codes(bundle)).toContain("VALIDATION_DURATION_OUT_OF_RANGE");
  });

  it("does not permit Formal gates to unlock without formal evidence", () => {
    const bundle = makeBundle();
    bundle.decision_summary.formal_sku_decision = "GO";
    bundle.decision_summary.listing_allowed = true;
    bundle.decision_summary.ad_test_allowed = true;
    expect(codes(bundle)).toContain("FORMAL_GATE_UNLOCK_WITHOUT_EVIDENCE");
  });

  it("accepts a Product Selection recommendation without unlocking Formal SKU", () => {
    const bundle = makeBundle();
    const result = validateFirstPrinciplesBundle(bundle, makeContext());
    expect(bundle.decision_summary.product_selection_decision).toBe("PROCEED_TO_SAMPLE");
    expect(bundle.decision_summary.formal_sku_decision).toBe("HOLD_SUPPLY");
    expect(result.valid).toBe(true);
  });

  it("rejects opportunity scores outside 0-100", () => {
    const bundle = structuredClone(makeBundle()) as unknown as Record<string, unknown>;
    const opportunities = bundle.opportunity_hypotheses as Array<Record<string, unknown>>;
    ((opportunities[0].scores as Record<string, Record<string, unknown>>).demand_fit).score = 101;
    expect(validateFirstPrinciplesBundle(bundle, makeContext()).errors.map((item) => item.code)).toContain("SCHEMA_VALIDATION_FAILED");
  });

  it("does not override an existing formal decision", () => {
    const context = { ...makeContext(), formalDecision: { formalStatus: "REJECT", listingAllowed: false, adTestAllowed: false } };
    expect(codes(makeBundle(), context)).toContain("FORMAL_GATE_OVERRIDE");
  });

  it("warns when opportunity demand-supply signatures are duplicated", () => {
    const result = validateFirstPrinciplesBundle(makeBundle(), makeContext());
    expect(result.warnings.map((item) => item.code)).toContain("OPPORTUNITIES_TOO_SIMILAR");
  });
});

describe("First-Principles persistence and presentation", () => {
  it("uses an idempotent stage key for repeated persistence", async () => {
    const records = new Map<string, { id: string }>();
    const persistence = {
      workflowStageRun: {
        upsert: async (args: { where: { researchRunId_stageCode_attempt: { researchRunId: string; stageCode: string; attempt: number } }; create: { id: string } }) => {
          const key = JSON.stringify(args.where.researchRunId_stageCode_attempt);
          const value = records.get(key) ?? { id: args.create.id };
          records.set(key, value);
          return value;
        },
      },
    };
    const first = await persistFirstPrinciplesStage(persistence as unknown as PrismaClient, runId, makeBundle(), "task.json", "bundle.json");
    const second = await persistFirstPrinciplesStage(persistence as unknown as PrismaClient, runId, makeBundle(), "task.json", "bundle.json");
    expect(second.id).toBe(first.id);
    expect(records.size).toBe(1);
  });

  it("renders all major workbench sections without collapsing the decision boundary", () => {
    render(<FirstPrinciplesView bundle={makeBundle()} />);
    expect(screen.getByRole("heading", { name: "问题重构" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "机会组合" })).toBeInTheDocument();
    expect(screen.getByText("暂缓正式供货")).toBeInTheDocument();
  });

  it("includes the recommendation and formal boundary in Markdown output", () => {
    const markdown = firstPrinciplesSummaryMarkdown(makeBundle());
    expect(markdown).toContain("# 第一性原理机会重构");
    expect(markdown).toContain("PROCEED_TO_SAMPLE");
    expect(markdown).toContain("HOLD_SUPPLY");
  });

  it("writes the First-Principles section to both Markdown and HTML reports", async () => {
    const packagePath = await mkdtemp(path.join(os.tmpdir(), "first-principles-report-"));
    const evidencePackage = {
      researchInput: { productName: "Test leggings", targetMarket: "US" },
      sources: [{ id: "SRC-1", sourceType: "regulatory", title: "Source", evidenceStatus: "verified", url: "https://example.com" }],
    } as unknown as EvidencePackage;
    const analysis = {
      researchRunId: runId,
      generatedAt: "2026-07-24T08:30:00.000Z",
      marketOpportunity: {
        demand: { score: 60, rationale: "Demand signal", sourceIds: ["SRC-1"] },
        competition: { score: 50, rationale: "Competition signal", sourceIds: ["SRC-1"] },
        trend: { score: 50, rationale: "Trend signal", sourceIds: ["SRC-1"] },
        monetization: { score: 50, rationale: "Monetization signal", sourceIds: ["SRC-1"] },
        overall: 53,
        verdict: "Proceed with bounded validation.",
      },
      competitorInsight: {
        whyItSells: ["Clear proposition"],
        brandPositioning: "Test",
        targetAudience: "Test buyers",
        pricePositioning: "Unknown",
        bundleStrategy: "Unknown",
        discountStrategy: "Unknown",
        homepageMessaging: "Test",
        cta: "Test",
        socialProof: "Unknown",
        reviews: "Unknown",
        ugc: "Unknown",
      },
      customerInsight: { painPoints: ["Opacity"], functionalMotives: ["Fit"], emotionalMotives: ["Confidence"], socialMotives: ["Versatility"] },
      positioning: { targetCustomer: "Test buyers", recommendedPriceRange: "Unknown", coreSellingPoint: "Proof", differentiation: ["Evidence"] },
      productDecision: { status: "PROCEED_TO_SAMPLE", rationale: ["Bounded sample"], sourceIds: ["SRC-1"] },
      actionBoundary: { listingAllowed: false, adTestAllowed: false, reason: "Formal evidence missing." },
      unknowns: ["Target SKU"],
    } as unknown as LiveResearchAnalysis;
    const reports = await generateLiveResearchReports(packagePath, evidencePackage, [], analysis, makeBundle());
    expect(await readFile(reports.markdownPath, "utf8")).toContain("## 第一性原理机会重构");
    expect(await readFile(reports.htmlPath, "utf8")).toContain("<h2>第一性原理机会重构</h2>");
  });
});
