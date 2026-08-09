import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sellerBriefLocalizationSchema, validationTypeLabels } from "./localization";
import { PreSampleBriefView } from "./pre-sample-brief-view";
import {
  decisionStateAssessmentSchema,
  deriveSellerDecisionState,
  readinessKeys,
} from "./decision-state";
import {
  mapSellerDecisionStatus,
  preSampleBriefHtml,
  preSampleBriefMarkdown,
  sellerBriefLeakageFindings,
  sumBudgetCaps,
} from "./service";
import type { PreSampleDecisionBrief, ValidationTestType } from "./types";
import type { ResearchClaim } from "../research/live-types";
import type { VocSummary } from "../voc/types";

const testTypes = Object.keys(validationTypeLabels) as ValidationTestType[];

const brief: PreSampleDecisionBrief = {
  runId: "research-run-test-us",
  product: "测试商品",
  market: "US",
  generatedAt: "2026-07-27T00:00:00.000Z",
  language: "zh-CN",
  status: "READY_FOR_SOURCING",
  statusLabel: "可以开始供应商候选研究和受控买样",
  conclusion: "这个方向值得继续，可以小规模买样；但目前还不能判断供应商可靠性、样品质量或正式盈利能力。",
  scopeNotice: "当前结论只适用于买样前机会判断。",
  whyContinue: {
    users: ["重视产品可靠性的目标用户。"],
    scenarios: ["在日常使用场景中反复使用。"],
    painPoints: ["现有方案缺少目标样品的实测证明。"],
    currentAlternatives: ["通用替代品容易购买，但缺少明确性能证据。"],
    competitorReasons: ["竞品通过清楚展示使用结果降低理解成本。"],
    opportunityEvidence: ["公开证据支持进行有边界的小规模验证。"],
    majorUnknowns: ["目标样品表现和正式成本仍然未知。"],
  },
  recommendation: {
    title: "证据优先的测试方向",
    internalTitle: "Proof-first direction",
    targetCustomer: "需要降低选择风险的目标用户。",
    targetScenario: "无法在购买前确认真实表现的场景。",
    productConcept: "先验证关键性能，再决定是否扩大投入。",
    coreValue: "用目标样品实测降低购买不确定性。",
    whyFirst: "该方向能够以较低成本验证最关键假设。",
    alternativesDeferred: ["其他方向目前需要更多未经验证的假设。"],
    evidenceStrength: "中等：方向有证据，但目标样品仍待验证。",
  },
  mustHave: ["产品本身必须通过关键性能实测。"],
  nextStageRequirements: ["取得准确规格和正式报价后再核算成本。"],
  mustNotHave: {
    productScope: ["验证前不要扩展过多款式。"],
    marketingClaims: ["不要使用未经证明的效果说法。"],
    evidenceAndSupplyChain: ["不要把公开页面当正式报价。"],
  },
  supplierHandoff: {
    productDirection: "寻找能够验证关键性能的候选样品。",
    structureAndMaterialDirections: ["确认关键材料和结构规格。"],
    sampleScope: "最多选择两个候选样品。",
    supplierConfirmations: ["书面确认准确样品编号和规格。"],
    requestedDocuments: ["索取正式规格表和报价。"],
    publicPageLimitations: ["公开页面不能证明供应商可靠性。"],
  },
  supplierInquiryGroups: [{
    title: "A. 是否有匹配样品",
    questionsZh: ["最接近目标方向的现货款是哪款？"],
    questionsEn: ["Which existing sample is closest to the target direction?"],
  }],
  validationSteps: testTypes.map((internalType, index) => ({
    internalType,
    name: validationTypeLabels[internalType],
    method: "执行有记录的小规模验证。",
    scope: "使用一个边界清楚的测试范围。",
    budgetCap: index === 0 ? "USD 250" : "USD 150",
    durationDays: 7,
    metric: "记录定义清楚的测试结果。",
    pass: "达到预先定义的通过标准。",
    fail: "未达到预先定义的最低标准。",
    stop: "发现证据边界被突破时停止。",
    nextIfPass: "进入下一项受控验证。",
    nextIfFail: "停止或修改当前方向。",
  })),
  estimatedValidationBudget: {
    currency: "USD",
    amount: 850,
    label: "USD 850",
    budgetFit: "UNKNOWN",
    budgetFitLabel: "预算匹配：尚未确认",
    note: "这是所有实验预算上限的合计，不代表必须一次性花完。",
  },
  stopConditionGroups: testTypes.map((internalType) => ({
    title: `${validationTypeLabels[internalType]}停止条件`,
    conditions: ["发现证据边界被突破时停止。"],
  })),
  evidenceTrust: {
    sourceCount: 13,
    verifiedCount: 8,
    needsReviewCount: 5,
    unresolvedCount: 6,
    verifiedExplanation: "已验证：当前研究流程已成功读取并核验。",
    needsReviewExplanation: "待复核：来源适用性仍需人工确认。",
    sources: [{
      title: "Public Source",
      url: "https://example.com/source",
      status: "verified",
      statusLabel: "已验证",
    }],
  },
  voiceOfCustomer: {
    available: true,
    confidence: "MEDIUM",
    confidenceRationale: "评论级观察跨两个来源族，并包含反证。",
    validObservations: 18,
    negativeOrNeutral: 11,
    positiveOrCounterevidence: 5,
    sourceCount: 3,
    sourceFamilyCount: 2,
    platformCount: 2,
    denominatorDefinition: "当前有界语料中的 18 条有效评论级观察。",
    topPainPoints: [{
      theme: "使用摩擦",
      count: 4,
      denominator: 18,
      sourceFamilies: ["community", "marketplace"],
      scopeNote: "competitor_product",
    }],
    desiredOutcomes: ["减少使用步骤（3/18）"],
    counterevidence: ["部分用户认为现有方案足够（2/18）"],
    representativeExcerpts: [{
      theme: "使用摩擦",
      excerpt: "still needs another step",
      url: "https://example.com/review",
    }],
    blockers: [],
    limitations: ["当前语料不是总体发生率。"],
    amazonCommentLevelEvidence: false,
  },
  advancedAuditUrls: {
    research: "/research/research-run-test-us",
    firstPrinciples: "/research/research-run-test-us/first-principles",
  },
  decisionBoundaries: {
    formalPurchase: "尚未判断；需要正式报价和样品验证。",
    supplierReliability: "尚未判断；公开页面只用于候选研究。",
    listing: "不属于当前产品阶段。",
    adTest: "不属于当前产品阶段。",
  },
};

const claims: ResearchClaim[] = [
  {
    id: "CLM-001",
    sourceId: "SRC-001",
    statement: "Observed users describe a repeatable task.",
    evidence: "The current-run source contains the observation.",
    confidence: "High",
    category: "customer",
    targetScope: "market",
  },
  {
    id: "CLM-002",
    sourceId: "SRC-002",
    statement: "Observed substitutes already solve the task.",
    evidence: "The current-run source compares common alternatives.",
    confidence: "Medium",
    category: "market",
    targetScope: "market",
  },
];

const assessment = (options: {
  ready?: boolean;
  credibleOpportunity?: boolean;
  stops?: Array<"weak_user_value" | "sufficient_substitutes">;
}) => decisionStateAssessmentSchema.parse({
  schemaVersion: "1.0",
  runId: "research-run-test-us",
  generatedAt: "2026-07-27T00:00:00.000Z",
  readiness: Object.fromEntries(readinessKeys.map((key) => [key, {
    supported: options.ready ?? false,
    claimIds: options.ready ? ["CLM-001"] : [],
    rationale: options.ready ? "Current-run evidence supports this condition." : "This condition is not supported yet.",
  }])),
  credibleBoundedOpportunity: {
    supported: options.credibleOpportunity ?? false,
    claimIds: options.credibleOpportunity ? ["CLM-001"] : [],
    rationale: options.credibleOpportunity ? "A bounded opportunity is supported." : "No bounded opportunity is supported.",
  },
  structuralStopSignals: (options.stops ?? []).map((code, index) => ({
    code,
    supported: true,
    claimIds: [index === 0 ? "CLM-001" : "CLM-002"],
    rationale: "The current-run evidence supports this structural stop signal.",
  })),
  missingEvidence: [],
});

describe("pre-sample decision brief", () => {
  it("maps internal product selection outcomes to seller-facing states", () => {
    expect(mapSellerDecisionStatus("REJECT")).toBe("NOT_WORTH_PURSUING");
    expect(mapSellerDecisionStatus("PROCEED_TO_SAMPLE")).toBe("READY_FOR_SOURCING");
    expect(mapSellerDecisionStatus("HOLD_RESEARCH")).toBe("RESEARCH_MORE");
  });

  it("sums one-currency validation caps and rejects incomplete totals", () => {
    expect(sumBudgetCaps(["USD 250", "USD 450", "USD 150"])).toEqual({ currency: "USD", amount: 850 });
    expect(sumBudgetCaps(["USD 250", "pending"])).toEqual({ currency: "UNKNOWN", amount: null });
    expect(sumBudgetCaps(["USD 250", "EUR 100"])).toEqual({ currency: "MIXED", amount: null });
  });

  it("renders the user status and Chinese budget guidance", () => {
    render(<PreSampleBriefView brief={brief} />);
    expect(screen.getByText("买样前机会判断")).toBeInTheDocument();
    expect(screen.getByText("可以开始供应商候选研究和受控买样")).toBeInTheDocument();
    expect(screen.getByText("建议验证预算上限")).toBeInTheDocument();
    expect(screen.getByText("预算匹配：尚未确认")).toBeInTheDocument();
  });

  it("separates product requirements from stage-entry requirements", () => {
    render(<PreSampleBriefView brief={brief} />);
    const productSection = screen.getByRole("heading", { name: /产品必须具备/ }).closest("section");
    const stageSection = screen.getByRole("heading", { name: /进入下一阶段前必须完成/ }).closest("section");
    expect(productSection).toHaveTextContent("产品本身必须通过关键性能实测");
    expect(productSection).not.toHaveTextContent("正式报价");
    expect(stageSection).toHaveTextContent("正式报价");
  });

  it("maps all five internal validation types to Chinese display names", () => {
    render(<PreSampleBriefView brief={brief} />);
    for (const label of Object.values(validationTypeLabels)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("concept_test")).not.toBeInTheDocument();
  });

  it("generates safe Markdown and HTML without seller-view leakage", () => {
    const markdown = preSampleBriefMarkdown(brief);
    const html = preSampleBriefHtml(brief);
    for (const output of [markdown, html]) {
      expect(output).toContain("建议验证预算上限");
      expect(output).toContain("进入下一阶段前必须完成");
      expect(sellerBriefLeakageFindings(output)).toEqual([]);
    }
    expect(html).toContain("观察倾向构成");
    expect(html).toContain("来源验证状态");
    expect(html).toContain("主题可能同时出现在同一条观察中");
  });

  it("adds an explicitly illustrative persona image only for the supported yoga report", () => {
    expect(preSampleBriefHtml(brief)).not.toContain("/research-report/3d-yoga-pants-persona.jpg");
    const yogaHtml = preSampleBriefHtml({
      ...brief,
      product: "3D yoga pants",
      recommendation: {
        ...brief.recommendation,
        title: "证据优先的自然塑形瑜伽裤",
      },
    });
    expect(yogaHtml).toContain("/research-report/3d-yoga-pants-persona.jpg");
    expect(yogaHtml).toContain("AI 生成的用户场景示意图，不代表真实受访者");
  });

  it("detects internal IDs, gate states, and untranslated experiment types", () => {
    expect(sellerBriefLeakageFindings("CLM-001 HOLD_SUPPLY concept_test")).toEqual([
      "internal artifact ID",
      "HOLD_SUPPLY",
      "untranslated validation type",
    ]);
  });

  it("renders different Run data without reusing the first product", () => {
    const petBrief: PreSampleDecisionBrief = {
      ...brief,
      runId: "research-run-pet-us",
      product: "宠物清洁杯",
      conclusion: "宠物清洁方向需要独立样品验证。",
    };
    const { rerender } = render(<PreSampleBriefView brief={brief} />);
    expect(screen.getByRole("heading", { name: "测试商品" })).toBeInTheDocument();
    rerender(<PreSampleBriefView brief={petBrief} />);
    expect(screen.getByRole("heading", { name: "宠物清洁杯" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "测试商品" })).not.toBeInTheDocument();
  });

  it("requires Chinese seller text in localization artifacts", () => {
    expect(sellerBriefLocalizationSchema.shape.conclusion.safeParse("English only").success).toBe(false);
    expect(sellerBriefLocalizationSchema.shape.conclusion.safeParse("这是中文卖家结论。").success).toBe(true);
  });

  it("defaults to RESEARCH_MORE when no structured assessment exists", () => {
    expect(deriveSellerDecisionState(null, claims)).toMatchObject({
      status: "RESEARCH_MORE",
      assessmentAvailable: false,
    });
  });

  it("requires every readiness condition before returning READY_FOR_SOURCING", () => {
    expect(deriveSellerDecisionState(assessment({ ready: true, credibleOpportunity: true }), claims)).toMatchObject({
      status: "READY_FOR_SOURCING",
      missingReadiness: [],
    });
    expect(deriveSellerDecisionState(assessment({ ready: false, credibleOpportunity: true }), claims).status).toBe("RESEARCH_MORE");
  });

  it("requires triangulated VOC, counterevidence, and alternatives when a VOC summary exists", () => {
    const vocSummary = {
      schema_version: "1.0",
      run_id: "research-run-test-us",
      generated_at: "2026-07-28T00:00:00.000Z",
      confidence: "LOW",
      confidence_rationale: "Only one source family is available.",
      coverage: {
        valid_observations: 8,
        negative_or_neutral: 6,
        positive_or_counterevidence: 0,
        alternative_observations: 0,
        source_count: 1,
        source_family_count: 1,
        platform_count: 1,
        duplicate_count: 0,
        excluded_count: 0,
      },
      top_pain_points: [],
      desired_outcomes: [],
      positive_and_counterevidence: [],
      representative_excerpts: [],
      blockers: ["Insufficient triangulation."],
      limitations: ["Bounded corpus."],
      amazon_comment_level_evidence: false,
      denominator_definition: "All valid observations in the bounded corpus.",
    } satisfies VocSummary;
    expect(deriveSellerDecisionState(
      assessment({ ready: true, credibleOpportunity: true }),
      claims,
      "research-run-test-us",
      vocSummary,
    )).toMatchObject({
      status: "RESEARCH_MORE",
      reasonCodes: ["VOC_EVIDENCE_INSUFFICIENT"],
    });
    expect(deriveSellerDecisionState(
      assessment({ ready: true, credibleOpportunity: true }),
      claims,
      "research-run-test-us",
      {
        ...vocSummary,
        confidence: "MEDIUM",
        coverage: {
          ...vocSummary.coverage,
          source_family_count: 2,
          positive_or_counterevidence: 3,
          alternative_observations: 1,
        },
      },
    ).status).toBe("READY_FOR_SOURCING");
  });

  it("requires independent structural evidence before returning NOT_WORTH_PURSUING", () => {
    expect(deriveSellerDecisionState(assessment({
      credibleOpportunity: false,
      stops: ["weak_user_value", "sufficient_substitutes"],
    }), claims)).toMatchObject({
      status: "NOT_WORTH_PURSUING",
      supportedStopSignals: ["weak_user_value", "sufficient_substitutes"],
    });
    expect(deriveSellerDecisionState(assessment({
      credibleOpportunity: false,
      stops: ["weak_user_value"],
    }), claims).status).toBe("RESEARCH_MORE");
  });

  it("rejects decision evidence from another Run", () => {
    const invalid = assessment({ ready: true, credibleOpportunity: true });
    invalid.readiness.user_task_supported.claimIds = ["CLM-OTHER"];
    expect(() => deriveSellerDecisionState(invalid, claims, "research-run-test-us")).toThrow("outside the current Run");
  });

  it("uses a research-only structure for RESEARCH_MORE", () => {
    const researchBrief: PreSampleDecisionBrief = {
      ...brief,
      status: "RESEARCH_MORE",
      statusLabel: "存在机会，但需要继续补证",
      conclusion: "现在不能进入供应链，需要先补齐用户任务和差异化证据。",
      researchMore: {
        possibleOpportunities: ["可移动指针可能帮助部分读者记录页内位置，但目前只是待验证假设。"],
        keyMissingEvidence: ["缺少独立用户对页内进度追踪的重复需求。"],
        researchPlan: [{
          question: "用户是否反复需要记录页内阅读位置？",
          suggestedSources: ["读者访谈", "独立阅读社区"],
          pass: "至少三个独立用户描述同一任务。",
          fail: "用户只需要普通书签。",
          budgetCap: "USD 30",
          stop: "无法找到目标用户时停止。",
        }],
        upgradeConditions: ["形成具体用户、场景和可测试规格。"],
        doNotInvest: ["不联系大量供应商。", "不支付样品费。"],
      },
    };
    render(<PreSampleBriefView brief={researchBrief} />);
    expect(screen.getByText("存在机会，但需要继续补证")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "下一轮研究计划" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "供应链交接简报" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "供应商询盘清单" })).not.toBeInTheDocument();
    for (const output of [preSampleBriefMarkdown(researchBrief), preSampleBriefHtml(researchBrief)]) {
      expect(output).toContain("关键缺失证据");
      expect(output).not.toContain("供应商询盘清单");
      expect(sellerBriefLeakageFindings(output)).toEqual([]);
    }
  });

  it("uses a stop structure for NOT_WORTH_PURSUING", () => {
    const stopBrief: PreSampleDecisionBrief = {
      ...brief,
      status: "NOT_WORTH_PURSUING",
      statusLabel: "不建议进入供应链阶段",
      conclusion: "替代方案已经足够，新增结构没有形成值得买样的用户价值。",
      notWorthPursuing: {
        stopReasons: ["用户可以直接手动完成同一任务。", "同质化产品缺少可验证差异。"],
        supportingEvidence: ["独立讨论反复提到无需专用工具。"],
        whyNotMoreResearch: ["问题来自价值结构，不是缺少供应商页面。"],
        reassessmentConditions: ["出现明确且未被满足的辅助使用场景。"],
        doNotInvest: ["不联系供应商。", "不购买样品。", "不创建商品页。"],
      },
    };
    render(<PreSampleBriefView brief={stopBrief} />);
    expect(screen.getByText("不建议进入供应链阶段")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "为什么不是继续补证" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "供应商询盘清单" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "样品与市场验证计划" })).not.toBeInTheDocument();
    for (const output of [preSampleBriefMarkdown(stopBrief), preSampleBriefHtml(stopBrief)]) {
      expect(output).toContain("停止原因");
      expect(output).not.toContain("供应商询盘清单");
      expect(output).not.toContain("建议验证预算上限");
      expect(sellerBriefLeakageFindings(output)).toEqual([]);
    }
  });
});
