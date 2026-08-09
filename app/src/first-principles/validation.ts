import { z } from "zod";
import type { ResearchClaim } from "../research/live-types";
import {
  firstPrinciplesBundleSchema,
  type FirstPrinciplesBundle,
  type FirstPrinciplesValidationIssue,
  type FirstPrinciplesValidationResult,
} from "./types";

export type FirstPrinciplesValidationContext = {
  researchRunId: string;
  product: string;
  market: string;
  claims: ResearchClaim[];
  dataOrigin: string;
  resourceInputComplete: boolean;
  formalDecision?: {
    formalStatus: string;
    listingAllowed: boolean;
    adTestAllowed: boolean;
  };
};

const issue = (code: string, message: string, path?: string): FirstPrinciplesValidationIssue => ({ code, message, path });

const allClaimReferences = (bundle: FirstPrinciplesBundle): Array<{ id: string; path: string }> => {
  const references: Array<{ id: string; path: string }> = [];
  const add = (ids: string[], path: string): void => ids.forEach((id) => references.push({ id, path }));
  add(bundle.problem_reframe.supporting_claim_ids, "problem_reframe.supporting_claim_ids");
  for (const [group, items] of Object.entries(bundle.fact_hypothesis_unknown)) {
    items.forEach((item, index) => add(item.supporting_claim_ids, `fact_hypothesis_unknown.${group}.${index}.supporting_claim_ids`));
  }
  bundle.demand_atoms.forEach((item, index) => add(item.supporting_claim_ids, `demand_atoms.${index}.supporting_claim_ids`));
  bundle.supply_atoms.forEach((item, index) => add(item.supplier_or_source_signal_claim_ids, `supply_atoms.${index}.supplier_or_source_signal_claim_ids`));
  for (const [group, items] of Object.entries(bundle.constraints)) {
    items.forEach((item, index) => add(item.supporting_claim_ids, `constraints.${group}.${index}.supporting_claim_ids`));
  }
  bundle.opportunity_hypotheses.forEach((item, index) => {
    add(item.required_claim_ids, `opportunity_hypotheses.${index}.required_claim_ids`);
    for (const [dimension, score] of Object.entries(item.scores)) {
      add(score.claim_ids, `opportunity_hypotheses.${index}.scores.${dimension}.claim_ids`);
    }
  });
  return references;
};

const emptySummary = (): FirstPrinciplesValidationResult["summary"] => ({
  facts: 0,
  hypotheses: 0,
  unknowns: 0,
  demand_atoms: 0,
  supply_atoms: 0,
  opportunities: 0,
  experiments: 0,
  validation_duration_days: null,
});

export const validateFirstPrinciplesBundle = (
  input: unknown,
  context: FirstPrinciplesValidationContext,
): FirstPrinciplesValidationResult => {
  const errors: FirstPrinciplesValidationIssue[] = [];
  const warnings: FirstPrinciplesValidationIssue[] = [];
  const parsed = firstPrinciplesBundleSchema.safeParse(input);
  if (!parsed.success) {
    for (const item of parsed.error.issues) {
      errors.push(issue("SCHEMA_VALIDATION_FAILED", item.message, item.path.join(".")));
    }
    return { valid: false, errors, warnings, summary: emptySummary() };
  }

  const bundle = parsed.data;
  if (bundle.run_id !== context.researchRunId) {
    errors.push(issue("RUN_ID_MISMATCH", `Bundle run ${bundle.run_id} does not match current run ${context.researchRunId}`, "run_id"));
  }
  if (bundle.product !== context.product) {
    errors.push(issue("PRODUCT_MISMATCH", `Bundle product ${bundle.product} does not match current product ${context.product}`, "product"));
  }
  if (bundle.market.toUpperCase() !== context.market.toUpperCase()) {
    errors.push(issue("MARKET_MISMATCH", `Bundle market ${bundle.market} does not match current market ${context.market}`, "market"));
  }
  if (context.dataOrigin === "fixture") {
    errors.push(issue("FIXTURE_CLAIM_FOR_LIVE_RUN", "A fixture run cannot be imported as live First-Principles evidence"));
  }

  const claimById = new Map(context.claims.map((claim) => [claim.id, claim]));
  for (const reference of allClaimReferences(bundle)) {
    if (!claimById.has(reference.id)) {
      errors.push(issue("CLAIM_NOT_IN_CURRENT_RUN", `Claim ${reference.id} does not belong to the current run`, reference.path));
    }
  }

  const groups = bundle.fact_hypothesis_unknown;
  (["facts", "hypotheses", "unknowns"] as const).forEach((group) => {
    const expected = group === "facts" ? "fact" : group === "hypotheses" ? "hypothesis" : "unknown";
    groups[group].forEach((item, index) => {
      if (item.classification !== expected) {
        errors.push(issue("CLASSIFICATION_GROUP_MISMATCH", `${item.id} must be classified as ${expected}`, `fact_hypothesis_unknown.${group}.${index}`));
      }
      if (item.classification === "unknown" && /(?:\$|USD\s*)?0(?:\.0+)?\b|=\s*(?:false|none|null)\b/i.test(item.statement)) {
        errors.push(issue("UNKNOWN_DEFAULTED", `${item.id} appears to replace an unknown with a default value`, `fact_hypothesis_unknown.${group}.${index}.statement`));
      }
      if (item.classification === "fact" && item.scope === "target_product") {
        const supportingClaims = item.supporting_claim_ids.map((id) => claimById.get(id)).filter(Boolean);
        if (supportingClaims.length > 0 && supportingClaims.every((claim) => claim?.targetScope !== "target_product")) {
          errors.push(issue("COMPETITOR_EVIDENCE_MIGRATION", `${item.id} maps non-target evidence as a target-product fact`, `fact_hypothesis_unknown.${group}.${index}`));
        }
      }
    });
  });

  const demandIds = new Set(bundle.demand_atoms.map((item) => item.id));
  const supplyIds = new Set(bundle.supply_atoms.map((item) => item.id));
  const opportunityIds = new Set(bundle.opportunity_hypotheses.map((item) => item.id));
  if (bundle.recommended_opportunity_id && !opportunityIds.has(bundle.recommended_opportunity_id)) {
    errors.push(issue("RECOMMENDED_OPPORTUNITY_NOT_FOUND", `Recommended opportunity ${bundle.recommended_opportunity_id} does not exist`, "recommended_opportunity_id"));
  }

  bundle.supply_atoms.forEach((atom, index) => {
    if (atom.target_sku_verified) {
      const claims = atom.supplier_or_source_signal_claim_ids.map((id) => claimById.get(id)).filter(Boolean);
      if (claims.length === 0 || claims.some((claim) => claim?.targetScope !== "target_product")) {
        errors.push(issue("SUPPLY_CANDIDATE_MIGRATED_TO_TARGET_SKU", `${atom.id} is marked verified without target-SKU evidence`, `supply_atoms.${index}.target_sku_verified`));
      }
    } else if (atom.category === "supplier_capability" && atom.supplier_or_source_signal_claim_ids.length > 0) {
      warnings.push(issue("SUPPLIER_CANDIDATE_ONLY", `${atom.id} is a public candidate signal, not a formal quote`, `supply_atoms.${index}`));
    }
  });

  bundle.opportunity_hypotheses.forEach((opportunity, index) => {
    opportunity.target_demand_atom_ids.forEach((id) => {
      if (!demandIds.has(id)) errors.push(issue("DEMAND_ATOM_NOT_FOUND", `${opportunity.id} references missing demand atom ${id}`, `opportunity_hypotheses.${index}.target_demand_atom_ids`));
    });
    opportunity.supply_atom_ids.forEach((id) => {
      if (!supplyIds.has(id)) errors.push(issue("SUPPLY_ATOM_NOT_FOUND", `${opportunity.id} references missing supply atom ${id}`, `opportunity_hypotheses.${index}.supply_atom_ids`));
    });
    if (opportunity.evidence_strength === "low") {
      warnings.push(issue("LOW_EVIDENCE_STRENGTH", `${opportunity.id} has low evidence strength`, `opportunity_hypotheses.${index}.evidence_strength`));
    }
    if (opportunity.unsupported_assumptions.length >= 3) {
      warnings.push(issue("HYPOTHESIS_HEAVY_OPPORTUNITY", `${opportunity.id} relies on ${opportunity.unsupported_assumptions.length} unsupported assumptions`, `opportunity_hypotheses.${index}.unsupported_assumptions`));
    }
    if (opportunity.scores.supply_feasibility.status === "not_scored") {
      warnings.push(issue("OPPORTUNITY_COST_UNKNOWN", `${opportunity.id} has no scorable supply cost or feasibility`, `opportunity_hypotheses.${index}.scores.supply_feasibility`));
    }
  });

  const recommendedExperiments = bundle.validation_plan.filter((item) => item.opportunity_id === bundle.recommended_opportunity_id);
  if (bundle.recommended_opportunity_id && recommendedExperiments.length < 3) {
    errors.push(issue("INSUFFICIENT_RECOMMENDED_EXPERIMENTS", "Recommended opportunity requires at least 3 experiments", "validation_plan"));
  }
  bundle.validation_plan.forEach((experiment, index) => {
    if (!opportunityIds.has(experiment.opportunity_id)) {
      errors.push(issue("EXPERIMENT_OPPORTUNITY_NOT_FOUND", `${experiment.id} references missing opportunity ${experiment.opportunity_id}`, `validation_plan.${index}.opportunity_id`));
    }
  });
  const duration = bundle.validation_plan.length > 0 ? Math.max(...bundle.validation_plan.map((item) => item.duration_days)) : null;
  if (duration === null || duration < 7 || duration > 14) {
    errors.push(issue("VALIDATION_DURATION_OUT_OF_RANGE", "Validation plan must provide an executable 7-14 day window", "validation_plan"));
  }

  if (!context.resourceInputComplete) {
    warnings.push(issue("RESOURCE_INPUT_INCOMPLETE", "User resource and constraint inputs are incomplete; unknowns must remain explicit", "resources"));
  }
  if (bundle.decision_summary.formal_sku_decision === "GO" && (!bundle.decision_summary.listing_allowed || !bundle.decision_summary.ad_test_allowed)) {
    errors.push(issue("FORMAL_DECISION_INCONSISTENT", "Formal GO cannot coexist with blocked Listing or Ad Test", "decision_summary"));
  }
  if (context.formalDecision) {
    if (
      bundle.decision_summary.formal_sku_decision !== context.formalDecision.formalStatus ||
      bundle.decision_summary.listing_allowed !== context.formalDecision.listingAllowed ||
      bundle.decision_summary.ad_test_allowed !== context.formalDecision.adTestAllowed
    ) {
      errors.push(issue("FORMAL_GATE_OVERRIDE", "First-Principles output cannot override the existing formal decision gates", "decision_summary"));
    }
  } else if (bundle.decision_summary.formal_sku_decision !== "HOLD_SUPPLY" || bundle.decision_summary.listing_allowed || bundle.decision_summary.ad_test_allowed) {
    errors.push(issue("FORMAL_GATE_UNLOCK_WITHOUT_EVIDENCE", "Missing formal SKU evidence requires HOLD_SUPPLY with Listing and Ad Test blocked", "decision_summary"));
  }

  const signatures = bundle.opportunity_hypotheses.map((item) =>
    JSON.stringify({ demand: [...item.target_demand_atom_ids].sort(), supply: [...item.supply_atom_ids].sort() }),
  );
  if (new Set(signatures).size < signatures.length) {
    warnings.push(issue("OPPORTUNITIES_TOO_SIMILAR", "Multiple opportunities use the same demand-supply combination", "opportunity_hypotheses"));
  }

  return {
    valid: errors.length === 0,
    run_id: bundle.run_id,
    errors,
    warnings,
    summary: {
      facts: groups.facts.length,
      hypotheses: groups.hypotheses.length,
      unknowns: groups.unknowns.length,
      demand_atoms: bundle.demand_atoms.length,
      supply_atoms: bundle.supply_atoms.length,
      opportunities: bundle.opportunity_hypotheses.length,
      experiments: bundle.validation_plan.length,
      validation_duration_days: duration,
    },
  };
};

export const parseFirstPrinciplesBundle = (input: unknown): FirstPrinciplesBundle => firstPrinciplesBundleSchema.parse(input);

export const formatZodError = (error: z.ZodError): string =>
  error.issues.map((item) => `${item.path.join(".") || "root"}: ${item.message}`).join("; ");
