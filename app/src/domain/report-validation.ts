import type { ClaimRecord, DecisionRecord, RiskModuleRecord, SourceRecord } from "./types";
import { validateClaimSourceIntegrity } from "./claim-source";
import { validateFormalDecision } from "./formal-status";
import { validateRiskModules } from "./risk-modules";

export type ReportValidationInput = {
  markdown: string;
  html: string;
  sources: SourceRecord[];
  claims: ClaimRecord[];
  riskModules: RiskModuleRecord[];
  decisions: DecisionRecord[];
  reportRequiredFields: string[];
  businessCriticalMissing: string[];
};

export type ReportValidationResult = {
  unicodeReplacementCharacters: number;
  reportRequiredFieldsMissing: string[];
  businessCriticalMissing: string[];
  markdownHtmlStatusConsistent: boolean;
  listingAdActionsConsistent: boolean;
  sourceCount: number;
  claimCount: number;
  moduleCount: number;
  claimSourceMappingMismatchCount: number;
  valid: boolean;
};

export const countUnicodeReplacementCharacters = (text: string): number =>
  [...text].filter((char) => char.charCodeAt(0) === 0xfffd).length;

export const validateReportCompleteness = (input: ReportValidationInput): ReportValidationResult => {
  const decision = input.decisions[0];
  const status = decision?.formalStatus ?? "";
  const claimIntegrity = validateClaimSourceIntegrity(input.sources, input.claims);
  const moduleValidation = validateRiskModules(input.riskModules);
  const formalValidation = validateFormalDecision(input.decisions);
  const unicodeReplacementCharacters =
    countUnicodeReplacementCharacters(input.markdown) + countUnicodeReplacementCharacters(input.html);
  const markdownHtmlStatusConsistent = input.markdown.includes(status) && input.html.includes(status);

  return {
    unicodeReplacementCharacters,
    reportRequiredFieldsMissing: input.reportRequiredFields,
    businessCriticalMissing: input.businessCriticalMissing,
    markdownHtmlStatusConsistent,
    listingAdActionsConsistent: formalValidation.actionsConsistent,
    sourceCount: input.sources.length,
    claimCount: input.claims.length,
    moduleCount: input.riskModules.length,
    claimSourceMappingMismatchCount: claimIntegrity.mappingMismatchCount,
    valid:
      unicodeReplacementCharacters === 0 &&
      input.reportRequiredFields.length === 0 &&
      markdownHtmlStatusConsistent &&
      formalValidation.valid &&
      moduleValidation.valid &&
      claimIntegrity.forwardReferenceValid &&
      claimIntegrity.mappingMismatchCount === 0,
  };
};
