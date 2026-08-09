import type { RiskModuleRecord } from "./types";

export type ModuleValidationResult = {
  moduleCount: number;
  moduleCodesComplete: boolean;
  baselineCount: number;
  conditionalCount: number;
  relevanceCountTotal: number;
  executionCountTotal: number;
  evidenceCountTotal: number;
  decisionCountTotal: number;
  irrelevantExecutionValid: boolean;
  duplicatePrimaryRiskModules: string[];
  valid: boolean;
};

const expectedCodes = Array.from({ length: 15 }, (_, index) => `M${String(index + 1).padStart(2, "0")}`);

const countBy = (modules: RiskModuleRecord[], selector: (module: RiskModuleRecord) => string): number =>
  Object.values(
    modules.reduce<Record<string, number>>((accumulator, module) => {
      const key = selector(module);
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {}),
  ).reduce((total, count) => total + count, 0);

export const validateRiskModules = (modules: RiskModuleRecord[]): ModuleValidationResult => {
  const actualCodes = modules.map((module) => module.moduleCode).sort();
  const moduleCodesComplete = expectedCodes.every((code, index) => actualCodes[index] === code);
  const baselineCount = modules.filter((module) => module.moduleType === "baseline").length;
  const conditionalCount = modules.filter((module) => module.moduleType === "conditional").length;
  const irrelevantExecutionValid = modules
    .filter((module) => module.relevance === "不相关")
    .every((module) => module.executionStatus === "不适用");
  const primaryByRisk = modules
    .filter((module) => module.ownerRole === "主责")
    .reduce<Record<string, string[]>>((accumulator, module) => {
      accumulator[module.notes] = [...(accumulator[module.notes] ?? []), module.moduleCode];
      return accumulator;
    }, {});
  const duplicatePrimaryRiskModules = Object.values(primaryByRisk)
    .filter((codes) => codes.length > 1)
    .flat();

  const result = {
    moduleCount: modules.length,
    moduleCodesComplete,
    baselineCount,
    conditionalCount,
    relevanceCountTotal: countBy(modules, (module) => module.relevance),
    executionCountTotal: countBy(modules, (module) => module.executionStatus),
    evidenceCountTotal: countBy(modules, (module) => module.evidenceSufficiency),
    decisionCountTotal: countBy(modules, (module) => module.decisionUsability),
    irrelevantExecutionValid,
    duplicatePrimaryRiskModules,
  };

  return {
    ...result,
    valid:
      result.moduleCount === 15 &&
      result.moduleCodesComplete &&
      result.baselineCount === 6 &&
      result.conditionalCount === 9 &&
      result.relevanceCountTotal === 15 &&
      result.executionCountTotal === 15 &&
      result.evidenceCountTotal === 15 &&
      result.decisionCountTotal === 15 &&
      result.irrelevantExecutionValid &&
      result.duplicatePrimaryRiskModules.length === 0,
  };
};
