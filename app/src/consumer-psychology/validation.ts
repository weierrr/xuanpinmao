import type { FirstPrinciplesBundle } from "../first-principles/types";
import type { ResearchClaim } from "../research/live-types";
import type { VocCorpus } from "../voc/types";
import {
  consumerDecisionChainArtifactSchema,
  consumerDecisionStages,
  type ConsumerDecisionChainArtifact,
  type ConsumerPsychologyValidationIssue,
  type ConsumerPsychologyValidationResult,
} from "./types";

type PsychologyFirstPrinciplesContext = Pick<
  FirstPrinciplesBundle,
  "run_id" | "product" | "market" | "demand_atoms"
>;

const mechanismsByStage = {
  situational_trigger: new Set(["situational_trigger"]),
  tension_activation: new Set(["self_discrepancy", "loss_aversion", "situational_trigger"]),
  identity_projection: new Set(["identity_projection", "self_discrepancy"]),
  outcome_imagination: new Set(["cognitive_fluency", "self_discrepancy", "identity_projection"]),
  belief_formation: new Set(["belief_formation", "uncertainty_reduction"]),
  risk_reduction: new Set(["uncertainty_reduction", "risk_reversal", "loss_aversion"]),
} satisfies Record<(typeof consumerDecisionStages)[number], Set<string>>;

const unsafeOfferClaim = /(?:cure|treat|eliminate cellulite|reduce inflammation|improve circulation|permanent(?:ly)? change|治愈|治疗|消除橘皮|减轻炎症|改善循环|永久改变)/iu;

const duplicateValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

const emptySummary = {
  stage_count: 0,
  supported_count: 0,
  directional_count: 0,
  hypothesis_count: 0,
  prohibited_count: 0,
  referenced_observation_count: 0,
  referenced_claim_count: 0,
  referenced_demand_atom_count: 0,
  counterevidence_count: 0,
  mapping_error_count: 0,
};

export const validateConsumerDecisionChain = (
  payload: unknown,
  corpus: VocCorpus,
  firstPrinciples: PsychologyFirstPrinciplesContext,
  claims: ResearchClaim[],
): ConsumerPsychologyValidationResult => {
  const errors: ConsumerPsychologyValidationIssue[] = [];
  const warnings: ConsumerPsychologyValidationIssue[] = [];
  const parsed = consumerDecisionChainArtifactSchema.safeParse(payload);
  if (!parsed.success) {
    const schemaErrors = parsed.error.issues.map((issue) => ({
      code: "INVALID_CONSUMER_PSYCHOLOGY_SCHEMA",
      message: issue.message,
      path: issue.path.join("."),
    }));
    return {
      valid: false,
      run_id: corpus.run_id,
      errors: schemaErrors,
      warnings,
      summary: { ...emptySummary, mapping_error_count: schemaErrors.length },
    };
  }

  const artifact: ConsumerDecisionChainArtifact = parsed.data;
  const reject = (issue: ConsumerPsychologyValidationIssue): void => {
    errors.push(issue);
  };

  if (artifact.run_id !== corpus.run_id || artifact.run_id !== firstPrinciples.run_id) {
    reject({
      code: "CONSUMER_PSYCHOLOGY_RUN_MISMATCH",
      message: "The decision chain must use VOC, Claims and First-Principles evidence from the current Run",
      path: "run_id",
    });
  }
  if (artifact.product !== corpus.product || artifact.product !== firstPrinciples.product) {
    reject({
      code: "CONSUMER_PSYCHOLOGY_PRODUCT_MISMATCH",
      message: "The decision-chain product must match its source artifacts",
      path: "product",
    });
  }
  if (
    artifact.market.toUpperCase() !== corpus.market.toUpperCase()
    || artifact.market.toUpperCase() !== firstPrinciples.market.toUpperCase()
  ) {
    reject({
      code: "CONSUMER_PSYCHOLOGY_MARKET_MISMATCH",
      message: "The decision-chain market must match its source artifacts",
      path: "market",
    });
  }

  const observations = new Map(corpus.observations.map((item) => [item.observation_id, item]));
  const claimsById = new Map(claims.map((item) => [item.id, item]));
  const demandAtoms = new Set(firstPrinciples.demand_atoms.map((item) => item.id));
  const referencedObservations = new Set<string>();
  const referencedClaims = new Set<string>();
  const referencedDemandAtoms = new Set<string>();
  const referencedCounterevidence = new Set<string>();

  for (const duplicate of duplicateValues(artifact.stages.map((item) => item.id))) {
    reject({
      code: "DUPLICATE_CONSUMER_PSYCHOLOGY_NODE_ID",
      message: "Decision-chain node IDs must be unique",
      nodeId: duplicate,
    });
  }

  artifact.stages.forEach((node, index) => {
    const expectedStage = consumerDecisionStages[index];
    if (node.stage !== expectedStage) {
      reject({
        code: "CONSUMER_PSYCHOLOGY_STAGE_ORDER_INVALID",
        message: `Stage ${index + 1} must be ${expectedStage}`,
        nodeId: node.id,
        path: `stages.${index}.stage`,
      });
    }
    if (!mechanismsByStage[node.stage].has(node.mechanism)) {
      reject({
        code: "CONSUMER_PSYCHOLOGY_MECHANISM_MISMATCH",
        message: `Mechanism ${node.mechanism} does not belong to stage ${node.stage}`,
        nodeId: node.id,
        path: `stages.${index}.mechanism`,
      });
    }

    const observationReferences = [
      ...node.supporting_observation_ids,
      ...node.counterevidence_observation_ids,
    ];
    for (const duplicate of duplicateValues(observationReferences)) {
      reject({
        code: "DUPLICATE_PSYCHOLOGY_OBSERVATION_REFERENCE",
        message: "An Observation cannot support and counter the same psychology node",
        nodeId: node.id,
        evidenceId: duplicate,
      });
    }
    for (const observationId of observationReferences) {
      referencedObservations.add(observationId);
      if (node.counterevidence_observation_ids.includes(observationId)) {
        referencedCounterevidence.add(`observation:${observationId}`);
      }
      const observation = observations.get(observationId);
      if (!observation) {
        reject({
          code: "PSYCHOLOGY_OBSERVATION_NOT_IN_CURRENT_RUN",
          message: "Psychology evidence must reference a current-run VOC Observation",
          nodeId: node.id,
          evidenceId: observationId,
        });
        continue;
      }
      if (
        node.scope === "target_product"
        && observation.product_scope !== "target_product"
      ) {
        reject({
          code: "COMPETITOR_OBSERVATION_USED_AS_TARGET_PROOF",
          message: "Competitor or category VOC cannot prove target-product psychology or performance",
          nodeId: node.id,
          evidenceId: observationId,
        });
      }
    }

    const claimReferences = [...node.supporting_claim_ids, ...node.counterevidence_claim_ids];
    for (const duplicate of duplicateValues(claimReferences)) {
      reject({
        code: "DUPLICATE_PSYCHOLOGY_CLAIM_REFERENCE",
        message: "A Claim cannot support and counter the same psychology node",
        nodeId: node.id,
        evidenceId: duplicate,
      });
    }
    for (const claimId of claimReferences) {
      referencedClaims.add(claimId);
      if (node.counterevidence_claim_ids.includes(claimId)) {
        referencedCounterevidence.add(`claim:${claimId}`);
      }
      const claim = claimsById.get(claimId);
      if (!claim) {
        reject({
          code: "PSYCHOLOGY_CLAIM_NOT_IN_CURRENT_RUN",
          message: "Psychology evidence must reference a current-run Claim",
          nodeId: node.id,
          evidenceId: claimId,
        });
        continue;
      }
      if (node.scope === "target_product" && claim.targetScope !== "target_product") {
        reject({
          code: "COMPETITOR_CLAIM_USED_AS_TARGET_PROOF",
          message: "A competitor or market Claim cannot validate the target product",
          nodeId: node.id,
          evidenceId: claimId,
        });
      }
    }

    for (const demandAtomId of node.supporting_demand_atom_ids) {
      referencedDemandAtoms.add(demandAtomId);
      if (!demandAtoms.has(demandAtomId)) {
        reject({
          code: "PSYCHOLOGY_DEMAND_ATOM_NOT_IN_CURRENT_RUN",
          message: "Psychology evidence must reference a current-run Demand Atom",
          nodeId: node.id,
          evidenceId: demandAtomId,
        });
      }
    }

    if (
      node.evidence_status === "supported"
      && ["proposed_offer", "target_product"].includes(node.scope)
      && node.supporting_observation_ids.every((id) => observations.get(id)?.product_scope !== "target_product")
    ) {
      reject({
        code: "UNTESTED_OFFER_MARKED_SUPPORTED",
        message: "A proposed offer or target product cannot be supported only by category or competitor experience",
        nodeId: node.id,
      });
    }
    if (
      ["proposed_offer", "target_product"].includes(node.scope)
      && node.evidence_status !== "prohibited"
      && unsafeOfferClaim.test(node.conclusion)
    ) {
      reject({
        code: "UNVERIFIED_HEALTH_OR_PERMANENCE_CLAIM",
        message: "The decision chain cannot turn unverified health, cellulite or permanent-change language into an offer",
        nodeId: node.id,
      });
    }
    if (node.counterevidence_observation_ids.length + node.counterevidence_claim_ids.length === 0) {
      warnings.push({
        code: "PSYCHOLOGY_COUNTEREVIDENCE_MISSING",
        message: "This stage has no explicit counterevidence and should remain bounded",
        nodeId: node.id,
      });
    }
  });

  const stageStatuses = artifact.stages.map((item) => item.evidence_status);
  return {
    valid: errors.length === 0,
    run_id: artifact.run_id,
    errors,
    warnings,
    summary: {
      stage_count: artifact.stages.length,
      supported_count: stageStatuses.filter((item) => item === "supported").length,
      directional_count: stageStatuses.filter((item) => item === "directional").length,
      hypothesis_count: stageStatuses.filter((item) => item === "hypothesis").length,
      prohibited_count: stageStatuses.filter((item) => item === "prohibited").length,
      referenced_observation_count: referencedObservations.size,
      referenced_claim_count: referencedClaims.size,
      referenced_demand_atom_count: referencedDemandAtoms.size,
      counterevidence_count: referencedCounterevidence.size,
      mapping_error_count: errors.length,
    },
  };
};
