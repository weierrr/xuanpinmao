import {
  conclusionGovernanceArtifactSchema,
  type ConclusionGovernanceArtifact,
  type ConclusionGovernanceIssue,
  type ConclusionGovernanceValidationResult,
  type GovernedConclusion,
} from "./types";

const duplicateValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

const conclusionKey = (conclusion: GovernedConclusion): string => [
  conclusion.topic,
  conclusion.subject.kind,
  conclusion.subject.key,
  conclusion.funnel_stage,
].join("::");

const emptySummary = {
  conclusion_count: 0,
  current_count: 0,
  superseded_count: 0,
  historical_count: 0,
  topic_count: 0,
  bound_chapter_count: 0,
  explicit_override_count: 0,
  conflict_count: 0,
  unbound_current_count: 0,
};

export const validateConclusionGovernance = (
  payload: unknown,
  expected: { reportRunId: string; product: string; market: string },
): ConclusionGovernanceValidationResult => {
  const errors: ConclusionGovernanceIssue[] = [];
  const warnings: ConclusionGovernanceIssue[] = [];
  const parsed = conclusionGovernanceArtifactSchema.safeParse(payload);
  if (!parsed.success) {
    const schemaErrors = parsed.error.issues.map((issue) => ({
      code: "INVALID_CONCLUSION_GOVERNANCE_SCHEMA",
      message: issue.message,
      path: issue.path.join("."),
    }));
    return {
      valid: false,
      report_run_id: expected.reportRunId,
      errors: schemaErrors,
      warnings,
      summary: { ...emptySummary, conflict_count: schemaErrors.length },
    };
  }

  const artifact: ConclusionGovernanceArtifact = parsed.data;
  const reject = (issue: ConclusionGovernanceIssue): void => { errors.push(issue); };

  if (artifact.report_run_id !== expected.reportRunId) {
    reject({ code: "CONCLUSION_REPORT_RUN_MISMATCH", message: "Conclusion governance must match the composed report Run", path: "report_run_id" });
  }
  if (artifact.product !== expected.product) {
    reject({ code: "CONCLUSION_PRODUCT_MISMATCH", message: "Conclusion governance product must match the report", path: "product" });
  }
  if (artifact.market.toUpperCase() !== expected.market.toUpperCase()) {
    reject({ code: "CONCLUSION_MARKET_MISMATCH", message: "Conclusion governance market must match the report", path: "market" });
  }

  for (const duplicate of duplicateValues(artifact.conclusions.map((item) => item.id))) {
    reject({ code: "DUPLICATE_CONCLUSION_ID", message: "Conclusion IDs must be unique", conclusionId: duplicate });
  }

  const byId = new Map(artifact.conclusions.map((item) => [item.id, item]));
  const currentByKey = new Map<string, GovernedConclusion[]>();
  for (const conclusion of artifact.conclusions) {
    if (conclusion.previous_conclusion_ids.includes(conclusion.id)) {
      reject({ code: "CONCLUSION_SELF_REFERENCE", message: "A conclusion cannot reference itself", conclusionId: conclusion.id });
    }
    for (const previousId of duplicateValues(conclusion.previous_conclusion_ids)) {
      reject({ code: "DUPLICATE_PREVIOUS_CONCLUSION", message: "A previous conclusion can only be referenced once", conclusionId: conclusion.id, relatedId: previousId });
    }
    for (const previousId of conclusion.previous_conclusion_ids) {
      const previous = byId.get(previousId);
      if (!previous) {
        reject({ code: "PREVIOUS_CONCLUSION_NOT_FOUND", message: "Override relationships must reference a conclusion in the same registry", conclusionId: conclusion.id, relatedId: previousId });
        continue;
      }
      if (new Date(previous.effective_at).getTime() >= new Date(conclusion.effective_at).getTime()) {
        reject({ code: "CONCLUSION_TIME_ORDER_INVALID", message: "A replacement must be effective after the conclusion it changes", conclusionId: conclusion.id, relatedId: previousId });
      }
      if (["supersedes", "refines", "reaffirms"].includes(conclusion.relation) && conclusionKey(previous) !== conclusionKey(conclusion)) {
        reject({ code: "CONCLUSION_SCOPE_OR_STAGE_MISMATCH", message: "An override can only replace the same topic, subject scope and funnel stage", conclusionId: conclusion.id, relatedId: previousId });
      }
    }
    if (conclusion.status === "current") {
      const key = conclusionKey(conclusion);
      currentByKey.set(key, [...(currentByKey.get(key) ?? []), conclusion]);
    }
    if (
      conclusion.subject.kind === "target_product"
      && conclusion.evidence_status === "supported"
      && conclusion.source_type !== "decision_artifact"
    ) {
      reject({
        code: "TARGET_PRODUCT_CONCLUSION_WITHOUT_TARGET_EVIDENCE",
        message: "Target-product conclusions cannot be marked supported by category, competitor or psychology synthesis alone",
        conclusionId: conclusion.id,
      });
    }
  }

  for (const conclusions of currentByKey.values()) {
    if (conclusions.length > 1) {
      for (const conclusion of conclusions) {
        reject({ code: "MULTIPLE_CURRENT_CONCLUSIONS", message: "The same topic and scope can only have one current conclusion", conclusionId: conclusion.id });
      }
    }
  }

  const supersededIds = new Set(
    artifact.conclusions.flatMap((item) => item.relation === "supersedes" || item.relation === "refines"
      ? item.previous_conclusion_ids
      : []),
  );
  for (const conclusion of artifact.conclusions) {
    if (conclusion.status === "superseded" && !supersededIds.has(conclusion.id)) {
      reject({ code: "SUPERSEDED_CONCLUSION_WITHOUT_REPLACEMENT", message: "A superseded conclusion must be explicitly replaced or refined", conclusionId: conclusion.id });
    }
  }

  const visit = (id: string, visiting: Set<string>, visited: Set<string>): void => {
    if (visiting.has(id)) {
      reject({ code: "CONCLUSION_OVERRIDE_CYCLE", message: "Conclusion override relationships cannot form a cycle", conclusionId: id });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const previousId of byId.get(id)?.previous_conclusion_ids ?? []) visit(previousId, visiting, visited);
    visiting.delete(id);
    visited.add(id);
  };
  const visited = new Set<string>();
  for (const id of byId.keys()) visit(id, new Set(), visited);

  const boundCurrentIds = new Set<string>();
  const bindingKeys: string[] = [];
  for (const binding of artifact.chapter_bindings) {
    bindingKeys.push(`${binding.chapter_id}::${binding.topic}`);
    for (const conclusionId of binding.conclusion_ids) {
      const conclusion = byId.get(conclusionId);
      if (!conclusion) {
        reject({ code: "BOUND_CONCLUSION_NOT_FOUND", message: "Chapter bindings must reference a registered conclusion", relatedId: conclusionId, path: binding.chapter_id });
        continue;
      }
      if (conclusion.status !== "current") {
        reject({ code: "SUPERSEDED_CONCLUSION_BOUND_TO_CHAPTER", message: "Only current conclusions may drive a report chapter", conclusionId, path: binding.chapter_id });
      }
      if (conclusion.topic !== binding.topic || !conclusion.chapter_ids.includes(binding.chapter_id)) {
        reject({ code: "CONCLUSION_CHAPTER_BINDING_MISMATCH", message: "The binding must match the conclusion topic and declared chapter coverage", conclusionId, path: binding.chapter_id });
      }
      boundCurrentIds.add(conclusionId);
    }
  }
  for (const duplicate of duplicateValues(bindingKeys)) {
    reject({ code: "DUPLICATE_CHAPTER_TOPIC_BINDING", message: "A chapter/topic pair can only be bound once", path: duplicate });
  }

  const unboundCurrent = artifact.conclusions.filter((item) => item.status === "current" && !boundCurrentIds.has(item.id));
  for (const conclusion of unboundCurrent) {
    warnings.push({ code: "CURRENT_CONCLUSION_NOT_BOUND", message: "A current conclusion is not displayed in any report chapter", conclusionId: conclusion.id });
  }

  const current = artifact.conclusions.filter((item) => item.status === "current");
  return {
    valid: errors.length === 0,
    report_run_id: artifact.report_run_id,
    errors,
    warnings,
    summary: {
      conclusion_count: artifact.conclusions.length,
      current_count: current.length,
      superseded_count: artifact.conclusions.filter((item) => item.status === "superseded").length,
      historical_count: artifact.conclusions.filter((item) => item.status === "historical").length,
      topic_count: new Set(current.map((item) => item.topic)).size,
      bound_chapter_count: new Set(artifact.chapter_bindings.map((item) => item.chapter_id)).size,
      explicit_override_count: artifact.conclusions.filter((item) => ["supersedes", "refines"].includes(item.relation)).length,
      conflict_count: errors.length,
      unbound_current_count: unboundCurrent.length,
    },
  };
};
