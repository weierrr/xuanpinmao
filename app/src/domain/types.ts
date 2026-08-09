export type FormalStatus =
  | "GO_TEST"
  | "HOLD_DATA"
  | "HOLD_RISK"
  | "HOLD_ECON"
  | "HOLD_SUPPLY"
  | "HOLD_CONFLICT"
  | "NO_GO_HARD_GATE"
  | "NO_GO_ECON"
  | "NO_GO_DEMAND";

export type OfferKind = "single" | "bundle_2" | "bundle_3" | "custom";

export type SourceRecord = {
  id: string;
  title: string;
  url: string;
  sourceType: string;
  evidenceCarrier: string;
  accessedAt: string;
  accessStatus: string;
  targetEntity: string;
  skuOrVariant: string | null;
  market: string | null;
  notes: string | null;
};

export type SourceLedgerRecord = SourceRecord & {
  claimIds: string[];
};

export type ClaimRecord = {
  id: string;
  atomicClaim: string;
  dataNature: string;
  sourceId: string;
  sourceType: string;
  evidenceCarrier: string;
  sourceLocation: string;
  linkSpecificity: string;
  observedAt: string;
  informationNature: string;
  verificationStatus: string;
  timeStatus: string;
  runSpecApplicability: string;
  dataCompleteness: string;
  decisionUse: string;
  confidence: string;
  inferenceBasis: string;
  missingEvidence: string;
  notes: string | null;
};

export type RiskModuleRecord = {
  moduleCode: string;
  moduleName: string;
  moduleType: "baseline" | "conditional";
  relevance: string;
  executionStatus: string;
  evidenceSufficiency: string;
  decisionUsability: string;
  nextAction: string;
  ownerRole: string;
  determiningClaimIds: string[];
  notes: string;
};

export type DecisionRecord = {
  formalStatus: FormalStatus;
  listingAllowed: boolean;
  adTestAllowed: boolean;
  applicableRunSpecId: string;
  determiningClaimIds: string[];
  secondaryRisks: string[];
  rationale: string;
};

export type ValidationFixture = {
  run_id: string;
  source_count: number;
  claim_count: number;
  module_count: number;
  formal_status: FormalStatus;
  listing_allowed: boolean;
  ad_test_allowed: boolean;
  unicode_replacement_characters: number;
  claim_source_forward_reference_valid: boolean;
  claim_source_reverse_reference_valid: boolean;
  source_claim_mapping_mismatch_count: number;
  report_required_fields_missing: string[];
  business_critical_missing: string[];
};

export type WorkflowStageCode =
  | "PROJECT_SETUP"
  | "MODE_DETECTION"
  | "RUNSPEC_BUILD"
  | "ENTITY_RESOLUTION"
  | "RESEARCH_PLANNING"
  | "PUBLIC_RESEARCH"
  | "CLAIM_EXTRACTION"
  | "EVIDENCE_VALIDATION"
  | "RISK_ROUTING"
  | "UNIT_ECONOMICS"
  | "FORMAL_DECISION"
  | "REPORT_GENERATION"
  | "FINAL_VALIDATION";

export type StageStatus = "pending" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";

export type ProviderScenario =
  | "success"
  | "schema_error"
  | "timeout"
  | "rate_limit"
  | "content_blocked"
  | "user_cancelled"
  | "retryable_error"
  | "non_retryable_error";
