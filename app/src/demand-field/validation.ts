import type { FirstPrinciplesBundle } from "../first-principles/types";
import type { VocCorpus } from "../voc/types";
import {
  demandFieldArtifactSchema,
  type DemandFieldArtifact,
  type DemandFieldValidationIssue,
  type DemandFieldValidationResult,
} from "./types";

type DemandFieldFirstPrinciplesContext = Pick<
  FirstPrinciplesBundle,
  "run_id" | "product" | "market" | "demand_atoms"
>;

const duplicateValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

export const validateDemandFieldArtifact = (
  payload: unknown,
  corpus: VocCorpus,
  firstPrinciples: DemandFieldFirstPrinciplesContext,
): DemandFieldValidationResult => {
  const errors: DemandFieldValidationIssue[] = [];
  const warnings: DemandFieldValidationIssue[] = [];
  const parsed = demandFieldArtifactSchema.safeParse(payload);
  const emptySummary = {
    audience_count: 0,
    scenario_count: 0,
    need_count: 0,
    task_step_count: 0,
    adjacent_opportunity_count: 0,
    direct_opportunity_count: 0,
    referenced_observation_count: 0,
    source_family_count: 0,
    platform_count: 0,
    mapping_error_count: 0,
  };
  if (!parsed.success) {
    const schemaErrors = parsed.error.issues.map((issue) => ({
      code: "INVALID_DEMAND_FIELD_SCHEMA",
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

  const artifact: DemandFieldArtifact = parsed.data;
  const reject = (issue: DemandFieldValidationIssue): void => {
    errors.push(issue);
  };
  if (artifact.run_id !== corpus.run_id || artifact.run_id !== firstPrinciples.run_id) {
    reject({ code: "DEMAND_FIELD_RUN_MISMATCH", message: "Demand Field must use the current VOC and First-Principles Run", path: "run_id" });
  }
  if (artifact.product !== corpus.product || artifact.product !== firstPrinciples.product) {
    reject({ code: "DEMAND_FIELD_PRODUCT_MISMATCH", message: "Demand Field product must match its source artifacts", path: "product" });
  }
  if (artifact.market.toUpperCase() !== corpus.market.toUpperCase() || artifact.market.toUpperCase() !== firstPrinciples.market.toUpperCase()) {
    reject({ code: "DEMAND_FIELD_MARKET_MISMATCH", message: "Demand Field market must match its source artifacts", path: "market" });
  }

  const observations = new Map(corpus.observations.map((item) => [item.observation_id, item]));
  const demandAtomIds = new Set(firstPrinciples.demand_atoms.map((item) => item.id));
  const audiences = new Set(artifact.audience_clusters.map((item) => item.id));
  const scenarios = new Set(artifact.scenarios.map((item) => item.id));
  const needs = new Set(artifact.need_atoms.map((item) => item.id));
  const taskSteps = new Set(artifact.task_chain.map((item) => item.id));
  const allNodeIds = [
    ...artifact.audience_clusters.map((item) => item.id),
    ...artifact.scenarios.map((item) => item.id),
    ...artifact.need_atoms.map((item) => item.id),
    ...artifact.task_chain.map((item) => item.id),
    ...artifact.adjacent_opportunities.map((item) => item.id),
  ];
  for (const id of duplicateValues(allNodeIds)) {
    reject({ code: "DUPLICATE_DEMAND_FIELD_NODE_ID", message: "Demand Field node IDs must be globally unique", nodeId: id });
  }

  const referencedObservations = new Set<string>();
  const validateObservationIds = (nodeId: string, supporting: string[], counter: string[]): void => {
    for (const duplicate of duplicateValues([...supporting, ...counter])) {
      reject({ code: "DUPLICATE_NODE_EVIDENCE_REFERENCE", message: "A node cannot repeat or reuse the same observation as support and counterevidence", nodeId, observationId: duplicate });
    }
    for (const observationId of [...supporting, ...counter]) {
      referencedObservations.add(observationId);
      if (!observations.has(observationId)) {
        reject({ code: "OBSERVATION_NOT_IN_CURRENT_RUN", message: "Demand Field evidence must reference a current-run VOC Observation", nodeId, observationId });
      }
    }
  };
  const validateDemandIds = (nodeId: string, ids: string[]): void => {
    for (const id of ids) {
      if (!demandAtomIds.has(id)) reject({ code: "DEMAND_ATOM_NOT_IN_CURRENT_RUN", message: "Demand Field references an unknown current-run Demand Atom", nodeId, observationId: id });
    }
  };

  for (const audience of artifact.audience_clusters) {
    validateObservationIds(audience.id, audience.supporting_observation_ids, []);
    validateDemandIds(audience.id, audience.supporting_demand_atom_ids);
  }
  for (const scenario of artifact.scenarios) {
    validateObservationIds(scenario.id, scenario.supporting_observation_ids, []);
    validateDemandIds(scenario.id, scenario.supporting_demand_atom_ids);
    for (const id of scenario.audience_cluster_ids) {
      if (!audiences.has(id)) reject({ code: "AUDIENCE_REFERENCE_MISSING", message: "Scenario references an unknown audience cluster", nodeId: scenario.id });
    }
  }
  for (const need of artifact.need_atoms) {
    validateObservationIds(need.id, need.supporting_observation_ids, need.counterevidence_observation_ids);
    validateDemandIds(need.id, need.supporting_demand_atom_ids);
  }
  for (const step of artifact.task_chain) {
    for (const id of step.scenario_ids) {
      if (!scenarios.has(id)) reject({ code: "SCENARIO_REFERENCE_MISSING", message: "Task step references an unknown scenario", nodeId: step.id });
    }
    for (const id of step.need_atom_ids) {
      if (!needs.has(id)) reject({ code: "NEED_REFERENCE_MISSING", message: "Task step references an unknown need", nodeId: step.id });
    }
  }

  const sequenceDuplicates = duplicateValues(artifact.task_chain.map((item) => String(item.sequence)));
  for (const sequence of sequenceDuplicates) {
    reject({ code: "DUPLICATE_TASK_SEQUENCE", message: `Task-chain sequence ${sequence} is duplicated`, path: "task_chain" });
  }

  for (const opportunity of artifact.adjacent_opportunities) {
    validateObservationIds(opportunity.id, opportunity.supporting_observation_ids, opportunity.counterevidence_observation_ids);
    for (const id of opportunity.audience_cluster_ids) {
      if (!audiences.has(id)) reject({ code: "AUDIENCE_REFERENCE_MISSING", message: "Opportunity references an unknown audience cluster", nodeId: opportunity.id });
    }
    for (const id of opportunity.scenario_ids) {
      if (!scenarios.has(id)) reject({ code: "SCENARIO_REFERENCE_MISSING", message: "Opportunity references an unknown scenario", nodeId: opportunity.id });
    }
    for (const id of opportunity.need_atom_ids) {
      if (!needs.has(id)) reject({ code: "NEED_REFERENCE_MISSING", message: "Opportunity references an unknown need", nodeId: opportunity.id });
    }
    for (const id of opportunity.task_step_ids) {
      if (!taskSteps.has(id)) reject({ code: "TASK_STEP_REFERENCE_MISSING", message: "Opportunity references an unknown task step", nodeId: opportunity.id });
    }
    if (opportunity.counterevidence_observation_ids.length === 0) {
      warnings.push({ code: "ADJACENT_OPPORTUNITY_COUNTEREVIDENCE_MISSING", message: "Opportunity has no explicit counterevidence and must remain research-only", nodeId: opportunity.id });
    }
    const opportunityObservations = opportunity.supporting_observation_ids
      .map((id) => observations.get(id))
      .filter((item): item is VocCorpus["observations"][number] => item !== undefined);
    const families = new Set(opportunityObservations.map((item) => item.source_family));
    if (families.size < 2) {
      warnings.push({ code: "ADJACENT_OPPORTUNITY_SINGLE_SOURCE_FAMILY", message: "Opportunity support does not yet span two source families", nodeId: opportunity.id });
    }
  }

  if (artifact.adjacent_opportunities.every((item) => !item.direct_product_evidence)) {
    warnings.push({ code: "DIRECT_ADJACENT_PRODUCT_EVIDENCE_MISSING", message: "No adjacent opportunity has direct product-level evidence" });
  }

  const referenced = [...referencedObservations]
    .map((id) => observations.get(id))
    .filter((item): item is VocCorpus["observations"][number] => item !== undefined);
  const sourceFamilies = new Set(referenced.map((item) => item.source_family));
  const platforms = new Set(referenced.map((item) => item.platform));
  return {
    valid: errors.length === 0,
    run_id: artifact.run_id,
    errors,
    warnings,
    summary: {
      audience_count: artifact.audience_clusters.length,
      scenario_count: artifact.scenarios.length,
      need_count: artifact.need_atoms.length,
      task_step_count: artifact.task_chain.length,
      adjacent_opportunity_count: artifact.adjacent_opportunities.length,
      direct_opportunity_count: artifact.adjacent_opportunities.filter((item) => item.direct_product_evidence).length,
      referenced_observation_count: referencedObservations.size,
      source_family_count: sourceFamilies.size,
      platform_count: platforms.size,
      mapping_error_count: errors.length,
    },
  };
};
