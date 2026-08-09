import { secondCategoryValidationSchema, type SecondCategoryValidation } from "./types";

type CapabilityState = {
  summary: boolean;
  commercialViability: boolean;
  voiceOfCustomer: boolean;
  buildPlan: boolean;
  validationPlan: boolean;
  actionBoundary: boolean;
  consumerPsychology: boolean;
  priceMarketStructure: boolean;
  estimatedUnitEconomics: boolean;
  conclusionGovernance: boolean;
  marketingDecisionChain: boolean;
};

type BuildSecondCategoryValidationInput = {
  runId: string;
  generatedAt: string;
  product: string;
  listingAllowed: boolean;
  adTestAllowed: boolean;
  capabilities: CapabilityState;
  textCorpus: readonly string[];
};

const dogPawCleanerProfile = {
  baselineRunId: "research-run-3d-yoga-pants-28f8bff32ab5-us",
  candidateRunId: "research-run-manual-dog-paw-cleaner-cup-4c8ff1c9a424-us",
  candidateCategory: "宠物清洁用品",
  candidateLabel: "手动洗爪杯",
  expectedTerms: ["犬只", "脚掌", "泥", "干燥", "内胆", "遛狗"],
  forbiddenTerms: ["Ionix", "Silix", "3D 瑜伽裤", "视觉磨皮", "橘皮", "塑形紧身裤", "健身房深蹲"],
} as const;

const coreCapabilityLabels: Array<[keyof CapabilityState, string]> = [
  ["summary", "结论摘要"],
  ["commercialViability", "商业可行性门禁"],
  ["voiceOfCustomer", "用户之声"],
  ["buildPlan", "产品结构与供应拆解"],
  ["validationPlan", "买样前验证计划"],
  ["actionBoundary", "行动边界"],
];

const advancedCapabilityLabels: Array<[keyof CapabilityState, string]> = [
  ["consumerPsychology", "用户心理决策链"],
  ["priceMarketStructure", "通用价格带与市场结构"],
  ["estimatedUnitEconomics", "预估单位经济"],
  ["conclusionGovernance", "跨章节结论治理"],
  ["marketingDecisionChain", "心理链与营销转译统一"],
];

export const buildSecondCategoryValidation = ({
  runId,
  generatedAt,
  product,
  listingAllowed,
  adTestAllowed,
  capabilities,
  textCorpus,
}: BuildSecondCategoryValidationInput): SecondCategoryValidation | null => {
  if (runId !== dogPawCleanerProfile.candidateRunId) return null;

  const normalizedCorpus = textCorpus.join("\n").toLowerCase();
  const distinctiveTerms = dogPawCleanerProfile.expectedTerms.filter((term) => normalizedCorpus.includes(term.toLowerCase()));
  const contaminationTerms = dogPawCleanerProfile.forbiddenTerms.filter((term) => normalizedCorpus.includes(term.toLowerCase()));
  const availableCore = coreCapabilityLabels.filter(([key]) => capabilities[key]).map(([, label]) => label);
  const missingCore = coreCapabilityLabels.filter(([key]) => !capabilities[key]).map(([, label]) => label);
  const availableAdvanced = advancedCapabilityLabels.filter(([key]) => capabilities[key]).map(([, label]) => label);
  const missingAdvanced = advancedCapabilityLabels.filter(([key]) => !capabilities[key]).map(([, label]) => label);

  const checks: SecondCategoryValidation["checks"] = [
    {
      key: "core_pipeline",
      label: "核心报告链路",
      status: missingCore.length === 0 ? "pass" : "fail",
      conclusion: missingCore.length === 0
        ? "第二品类能够走通从证据到买样前决策的核心链路。"
        : `核心链路仍缺少：${missingCore.join("、")}。`,
      evidence: [`已接入 ${availableCore.length}/6 项核心能力`, ...availableCore],
      nextAction: missingCore.length > 0 ? `补齐 ${missingCore.join("、")}。` : null,
    },
    {
      key: "category_specificity",
      label: "品类事实独立性",
      status: distinctiveTerms.length >= 4 ? "pass" : "fail",
      conclusion: distinctiveTerms.length >= 4
        ? "需求、结构、风险和验证对象由宠物清洁场景驱动，没有只替换商品名称。"
        : "第二品类的独立事实不足，存在模板化风险。",
      evidence: distinctiveTerms.length > 0 ? distinctiveTerms : [product],
      nextAction: distinctiveTerms.length >= 4 ? null : "补充犬只接受度、脚掌适配、拆洗与干燥证据。",
    },
    {
      key: "evidence_boundary",
      label: "证据边界",
      status: capabilities.voiceOfCustomer && capabilities.buildPlan ? "pass" : "fail",
      conclusion: "公开竞品、用户反馈和供应候选仍与目标样品事实分开。",
      evidence: ["目标样品尚未验证", "公开供应商仅作为候选", "用户反馈不等于总体发生率"],
      nextAction: null,
    },
    {
      key: "decision_boundary",
      label: "行动边界",
      status: !listingAllowed && !adTestAllowed ? "pass" : "fail",
      conclusion: !listingAllowed && !adTestAllowed
        ? "允许受控买样，但正式上架和广告测试仍被禁止。"
        : "第二品类错误跨过了正式上架或投放门禁。",
      evidence: [`上架：${listingAllowed ? "允许" : "禁止"}`, `广告测试：${adTestAllowed ? "允许" : "禁止"}`],
      nextAction: !listingAllowed && !adTestAllowed ? null : "恢复正式 SKU、单位经济和投放停止规则。",
    },
    {
      key: "contamination",
      label: "跨品类污染",
      status: contaminationTerms.length === 0 ? "pass" : "fail",
      conclusion: contaminationTerms.length === 0
        ? "结构化报告数据未发现服饰品类专属结论。"
        : `发现 ${contaminationTerms.length} 个服饰品类专属词。`,
      evidence: contaminationTerms.length > 0 ? contaminationTerms : ["未发现服饰竞品、服饰痛点或外观功效专属结论"],
      nextAction: contaminationTerms.length > 0 ? "移除硬编码竞品、人物图和服饰专属文案。" : null,
    },
    {
      key: "advanced_modules",
      label: "新增高级模块",
      status: missingAdvanced.length === 0 ? "pass" : "warning",
      conclusion: missingAdvanced.length === 0
        ? "最近新增的高级模块已经全部通过第二品类验证。"
        : `核心链路可用，但仍有 ${missingAdvanced.length} 个高级模块尚未生成第二品类产物。`,
      evidence: [`已接入 ${availableAdvanced.length}/5 项`, ...(availableAdvanced.length > 0 ? availableAdvanced : ["当前仅验证核心报告链路"])],
      nextAction: missingAdvanced.length > 0 ? `下一步验证：${missingAdvanced.join("、")}。` : null,
    },
  ];

  const hasFailure = checks.some((check) => check.status === "fail");
  const hasWarning = checks.some((check) => check.status === "warning");
  const status = hasFailure ? "failed" as const : hasWarning ? "partial" as const : "passed" as const;
  const statusLabel = status === "passed" ? "第二品类验证通过" : status === "partial" ? "核心链路通过，继续补齐" : "第二品类验证未通过";

  return secondCategoryValidationSchema.parse({
    schemaVersion: "1.0",
    validationId: `second-category:${runId}`,
    baselineRunId: dogPawCleanerProfile.baselineRunId,
    candidateRunId: runId,
    generatedAt,
    candidateCategory: dogPawCleanerProfile.candidateCategory,
    candidateLabel: dogPawCleanerProfile.candidateLabel,
    status,
    statusLabel,
    summary: status === "passed"
      ? "系统已经证明新增能力可以脱离服饰品类独立运行。"
      : status === "partial"
        ? "核心买样前决策链已经跨品类运行，高级模块仍需逐项生成第二品类证据和产物。"
        : "当前仍存在决定性缺口或跨品类污染，不能宣称模块已经通用。",
    checks,
    metrics: {
      passedChecks: checks.filter((check) => check.status === "pass").length,
      totalChecks: 6,
      coreCapabilitiesAvailable: availableCore.length,
      coreCapabilitiesTotal: 6,
      advancedCapabilitiesAvailable: availableAdvanced.length,
      advancedCapabilitiesTotal: 5,
      contaminationCount: contaminationTerms.length,
      distinctiveTermCount: distinctiveTerms.length,
    },
    reusableCapabilities: availableCore,
    missingCapabilities: [...missingCore, ...missingAdvanced],
    boundary: "第二品类验证只证明当前核心报告结构能在宠物清洁用品上运行；未生成的心理链、价格结构、预估单位经济和结论治理模块仍不能视为已经跨品类通过。",
  });
};
