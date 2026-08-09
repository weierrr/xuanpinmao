import { describe, expect, it } from "vitest";
import type { ConsumerDecisionChainArtifact, ConsumerDecisionStage } from "../consumer-psychology/types";
import type { PreSampleDecisionBrief } from "../pre-sample/types";
import type { LiveResearchAnalysis, ResearchClaim } from "../research/live-types";
import { buildProductMarketingTranslation, validateMarketingEvidenceMappings } from "./service";
import { marketingTranslationSchema } from "./types";

const analysis = {
  schemaVersion: "1.0",
  researchRunId: "research-run-marketing-test-us",
  generatedAt: "2026-07-30T00:00:00.000Z",
  marketOpportunity: {
    demand: { score: 60, rationale: "Directional.", sourceIds: ["SRC-001"] },
    competition: { score: 50, rationale: "Directional.", sourceIds: ["SRC-001"] },
    trend: { score: 55, rationale: "Directional.", sourceIds: ["SRC-001"] },
    monetization: { score: 50, rationale: "Directional.", sourceIds: ["SRC-001"] },
    overall: 54,
    verdict: "Validate with a sample.",
  },
  competitorInsight: {
    brandPositioning: "Proof-led",
    targetAudience: "Target users",
    pricePositioning: "$30-$50",
    skuSummary: "Candidate products",
    bundleStrategy: "None",
    discountStrategy: "None",
    sellingPoints: ["Competitor-stated benefit"],
    materials: "Unknown",
    sizeSystem: "Unknown",
    homepageMessaging: "Observed competitor copy",
    cta: "Shop",
    socialProof: "Observed",
    reviews: "Observed",
    ugc: "Observed",
    whyItSells: ["Clear category framing"],
    sourceIds: ["SRC-001"],
  },
  customerInsight: {
    painPoints: ["Users cannot verify performance before purchase"],
    functionalMotives: ["Reduce uncertainty"],
    emotionalMotives: ["Feel more confident"],
    socialMotives: ["Use in public"],
    sourceIds: ["SRC-001"],
  },
  positioning: {
    targetCustomer: "Evidence-seeking target users",
    recommendedPriceRange: "$39-$49",
    coreSellingPoint: "Proof before promise",
    differentiation: ["Target-SKU validation"],
  },
  productDecision: {
    status: "PROCEED_TO_SAMPLE",
    rationale: ["A bounded sample test is justified"],
    sourceIds: ["SRC-001"],
  },
  actionBoundary: {
    listingAllowed: false,
    adTestAllowed: false,
    reason: "Target SKU and Claim evidence are incomplete.",
  },
  unknowns: ["Supplier and sample performance"],
} satisfies LiveResearchAnalysis;

const claims: ResearchClaim[] = [{
  id: "CLM-001",
  sourceId: "SRC-001",
  statement: "Users describe a recurring problem.",
  evidence: "Observed in current-run public evidence.",
  confidence: "High",
  category: "customer",
  targetScope: "market",
}];

const brief = {
  scopeNotice: "This is a pre-sample decision only.",
  whyContinue: {
    scenarios: ["a repeated target scenario"],
    painPoints: ["uncertain performance"],
    majorUnknowns: ["Target sample performance remains unknown."],
  },
  recommendation: {
    title: "证据优先的候选方向",
    targetCustomer: "重视实证的目标用户",
    targetScenario: "购买前无法确认真实表现",
    productConcept: "先验证目标样品再扩大投入",
    coreValue: "用目标样品实测降低选择不确定性",
    alternativesDeferred: ["需要更多无证据假设的方向"],
  },
  mustHave: ["目标样品通过关键性能测试", "规格和结构可被复核"],
  mustNotHave: {
    productScope: ["未经验证的大范围扩款"],
    marketingClaims: ["未经证明的性能承诺"],
  },
  decisionBoundaries: {
    listing: "商品上架尚未开放。",
    adTest: "广告测试尚未开放。",
  },
} as PreSampleDecisionBrief;

const psychologyStage = (
  id: string,
  stage: ConsumerDecisionStage["stage"],
  conclusion: string,
  evidenceStatus: ConsumerDecisionStage["evidence_status"],
): ConsumerDecisionStage => ({
  id,
  stage,
  mechanism: stage === "situational_trigger" ? "situational_trigger"
    : stage === "tension_activation" ? "loss_aversion"
      : stage === "identity_projection" ? "identity_projection"
        : stage === "outcome_imagination" ? "cognitive_fluency"
          : stage === "belief_formation" ? "belief_formation"
            : "risk_reversal",
  scope: ["situational_trigger", "tension_activation", "identity_projection"].includes(stage)
    ? "category_user"
    : "proposed_offer",
  basis: evidenceStatus === "supported" ? "direct_user_expression" : "evidence_synthesis",
  conclusion,
  evidence_status: evidenceStatus,
  supporting_observation_ids: [],
  supporting_claim_ids: ["CLM-001"],
  supporting_demand_atom_ids: [],
  counterevidence_observation_ids: [],
  counterevidence_claim_ids: [],
  unknowns: ["仍需扩大样本验证"],
  validation_needed: ["完成对应心理阶段验证"],
  claim_boundary: "只用于当前运行的有界营销假设。",
});

const consumerPsychology = {
  schema_version: "1.0",
  run_id: analysis.researchRunId,
  product: "Test product",
  market: "US",
  generated_at: "2026-07-30T00:00:00.000Z",
  methodology: "CONSUMER_PSYCHOLOGY_DECISION_CHAIN_V1",
  source_artifacts: { voc_corpus: "voc.json", first_principles_bundle: "fp.json", claims: "claims.json" },
  stages: [
    psychologyStage("PSY-001", "situational_trigger", "用户在公开使用场景中注意到问题", "supported"),
    psychologyStage("PSY-002", "tension_activation", "用户想避免反复分心和不理想的呈现", "supported"),
    psychologyStage("PSY-003", "identity_projection", "用户希望呈现自然、利落和自信的状态", "supported"),
    psychologyStage("PSY-004", "outcome_imagination", "用户能够理解更自然且更稳定的可观察改变", "directional"),
    psychologyStage("PSY-005", "belief_formation", "同条件实测可能比抽象承诺更可信", "hypothesis"),
    psychologyStage("PSY-006", "risk_reduction", "清晰证明和退换边界可能降低试错风险", "hypothesis"),
  ],
  overall_boundary: "心理链不证明目标商品性能，也不自动开放营销权限。",
  ethical_boundary: { no_manufactured_shame: true, no_sensitive_trait_inference: true, no_unverified_health_claims: true },
  decision_boundary: {
    current_product_decision_unchanged: true,
    target_sku_performance_not_proven: true,
    marketing_remains_draft_for_validation: true,
    no_automatic_listing_or_ad_approval: true,
  },
} as ConsumerDecisionChainArtifact;

describe("marketing translation", () => {
  it("keeps every channel draft blocked and creates the full validation loop", () => {
    const translation = buildProductMarketingTranslation({
      analysis,
      claims,
      brief,
      now: new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(translation.status).toBe("draft_for_validation");
    expect(translation.channelDrafts.listingTitle.status).toBe("draft_for_validation");
    expect(translation.channelDrafts.hero.status).toBe("draft_for_validation");
    expect(translation.channelDrafts.adAngles).toHaveLength(3);
    expect(translation.channelDrafts.contentHooks).toHaveLength(3);
    expect(translation.validationExperiments).toHaveLength(7);
    expect(translation.prohibitedClaims.some((item) => /塑形|脂肪|服装外观/.test(`${item.claim}${item.reason}`))).toBe(false);
    expect(validateMarketingEvidenceMappings({ translation, analysis, claims })).toEqual([]);
  });

  it("rejects ready-to-use channel copy inside a blocked translation", () => {
    const translation = buildProductMarketingTranslation({ analysis, claims, brief });
    expect(() => marketingTranslationSchema.parse({
      ...translation,
      channelDrafts: {
        ...translation.channelDrafts,
        listingTitle: { ...translation.channelDrafts.listingTitle, status: "ready_for_use" },
      },
    })).toThrow();
  });

  it("rejects competitor-only evidence as supported target-SKU proof", () => {
    const competitorClaims: ResearchClaim[] = [{ ...claims[0], targetScope: "competitor" }];
    const translation = buildProductMarketingTranslation({ analysis, claims: competitorClaims, brief });
    const supported = {
      ...translation,
      messagePillars: translation.messagePillars.map((pillar, index) =>
        index === 0
          ? { ...pillar, evidenceStatus: "supported" as const, supportingClaimIds: ["CLM-001"] }
          : pillar),
    };
    expect(validateMarketingEvidenceMappings({
      translation: supported,
      analysis,
      claims: competitorClaims,
    }).join("\n")).toContain("competitor-only CLM-001");
  });

  it("derives Hook, Promise, Proof, Offer and CTA from the psychology chain", () => {
    const translation = buildProductMarketingTranslation({
      analysis,
      claims,
      brief,
      consumerPsychology,
      now: new Date("2026-07-30T00:00:00.000Z"),
    });

    expect(translation.decisionChain?.mappings.map((item) => item.role)).toEqual([
      "hook", "promise", "proof", "offer", "cta",
    ]);
    expect(translation.messagePillars.map((item) => item.decisionRole)).toEqual(["promise", "proof", "offer"]);
    expect(translation.channelDrafts.adAngles[0].evidenceRefs).toContainEqual({
      objectType: "consumer_psychology_stage",
      id: "PSY-001",
    });
    expect(validateMarketingEvidenceMappings({
      translation,
      analysis,
      claims,
      consumerPsychology,
    })).toEqual([]);
  });

  it("rejects marketing roles mapped to the wrong psychology stage", () => {
    const translation = buildProductMarketingTranslation({ analysis, claims, brief, consumerPsychology });
    const invalid = structuredClone(translation);
    if (!invalid.decisionChain) throw new Error("Expected a psychology-derived marketing chain");
    invalid.decisionChain.mappings[0].sourceStageIds = ["PSY-004"];
    invalid.decisionChain.mappings[0].evidenceRefs = [{
      objectType: "consumer_psychology_stage",
      id: "PSY-004",
    }];
    expect(validateMarketingEvidenceMappings({
      translation: invalid,
      analysis,
      claims,
      consumerPsychology,
    }).join("\n")).toContain("hook cannot be derived from psychology stage outcome_imagination");
  });
});
