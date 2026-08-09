import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  demandFieldTextZh,
  demandRelationshipZh,
  demandStatusZh,
} from "../demand-field/presentation";
import { demandFieldPaths } from "../demand-field/service";
import { demandFieldArtifactSchema, type DemandFieldArtifact } from "../demand-field/types";
import { readFirstPrinciplesBundle, researchPackagePath } from "../first-principles/service";
import { readEvidencePackage } from "../research/evidence-package";
import { readLiveResearchArtifacts } from "../research/live-research";
import { readDecisionStateAssessment } from "./decision-state";
import {
  evidenceStatusLabels,
  readSellerBriefLocalization,
  statusLabels,
  validationTypeLabels,
} from "./localization";
import type {
  PreSampleDecisionBrief,
  SellerDecisionStatus,
  ValidationTestType,
} from "./types";
import { readVocSummary } from "../voc/service";
import { productNameZh, sourceTitleZh, statusZh, validationBudgetZh } from "../presentation/zh";

const vocThemeLabels: Record<string, string> = {
  "opacity risk": "透视与不透风险",
  "opacity and squat-proof performance": "不透与深蹲表现",
  "fabric durability": "面料耐久性",
  "scrunch seam durability": "提臀缝耐久性",
  "fit and sizing": "版型与尺码",
  "comfort and handfeel": "舒适度与手感",
  "contour and appearance": "塑形与外观",
  "overall product experience": "整体产品体验",
  "color consistency": "颜色一致性",
  "waistband stability": "腰头稳定性",
  pilling: "起球",
  "price-value concern": "价格与价值不匹配",
  "scrunch durability": "提臀缝耐久性",
  "body-specific fit": "版型对体型的限制",
  "cheap handfeel": "面料手感廉价",
  "color sizing inconsistency": "不同颜色尺码不一致",
  "balanced compression": "压缩与活动空间平衡",
  "higher waist": "更高腰头",
  "subtle contour": "克制自然的塑形",
  "underwear workaround": "依赖内衣的补救做法",
  "customer service recovery": "售后补救",
  "repeat purchase loyalty": "复购与忠诚度",
  "fit satisfaction": "版型满意",
  "flattering fit": "修饰效果满意",
  "glute support": "臀部支撑",
  "hidden scrunch comfort": "隐形提臀缝舒适度",
  "long-term satisfaction": "长期使用满意",
  "material satisfaction": "面料满意",
  "scrunch discomfort": "提臀缝不适",
  "dog resistance": "犬只抗拒",
  "abandonment risk": "购买后弃用风险",
  "cleaning complexity": "清洗流程复杂",
  "handling difficulty": "操作与控制困难",
  "long coat limitation": "长毛犬适用限制",
  "mold risk": "潮湿与发霉风险",
  "repeat rinsing": "重污需要重复换水",
  "between-pad cleaning": "趾缝清洁",
  "towel pairing": "配合毛巾擦干",
  "training with treats": "用零食建立配合",
  "water replacement": "及时更换污水",
  "mud cleaning effectiveness": "泥污清洁有效",
  "road salt removal": "道路盐清除",
  "coat-specific effectiveness": "不同毛发类型效果差异",
  "contained mess": "减少污水扩散",
  "easier than wipes": "比湿巾更省事",
  "floor protection": "减少地板脏污",
  "repeat daily use": "长期高频使用",
  "sticky clay removal": "黏性泥土清除",
};

const vocFamilyLabels: Record<string, string> = {
  marketplace: "零售评论",
  community: "独立社区",
  brand_competitor: "品牌商品评论",
  specialist: "独立评论平台",
};

const vocScopeLabels: Record<string, string> = {
  competitor_product: "竞品",
  category: "品类",
  parent_listing: "父商品页",
  target_product: "目标商品",
};

export const localizeVocTheme = (value: string): string => vocThemeLabels[value] ?? value;
const localizeVocScope = (value: string): string =>
  value.split(",").map((item) => vocScopeLabels[item.trim()] ?? item.trim()).join("、");

const localizeVocDenominator = (value: string): string => {
  if (value.includes("All valid, comment-level observations")) {
    return "当前 Phase 4.4 有界语料中的全部有效评论级观察；计数不代表市场总体发生率。";
  }
  return value;
};

const localizeVocLimitation = (value: string): string => {
  if (value.includes("No Amazon comment-level evidence")) return "未取得亚马逊评论级证据。";
  if (value.includes("bounded convenience sample")) return "当前语料是有边界的便利样本，不代表市场总体发生率。";
  if (value.includes("competitors or the category") || value.includes("competitors or category examples")) {
    return "观察来自竞品或品类，不能验证尚未实测的目标 SKU。";
  }
  if (value.includes("pagination may bias")) return "品牌页与评论平台的分页机制可能影响可见样本。";
  if (value.includes("Dog coat, size")) return "犬只毛发、体型、触碰耐受和泥污类型都会影响体验。";
  if (value.includes("two source families")) return "独立来源族不足两个。";
  if (value.includes("counterevidence")) return "当前缺少正向证据或反证。";
  return value;
};

export const mapSellerDecisionStatus = (status: string): SellerDecisionStatus => {
  if (status === "REJECT") return "NOT_WORTH_PURSUING";
  if (status === "PROCEED_TO_SAMPLE") return "READY_FOR_SOURCING";
  return "RESEARCH_MORE";
};

export const sumBudgetCaps = (caps: string[]): { currency: string; amount: number | null } => {
  const parsed = caps.map((cap) => {
    const match = /\b([A-Z]{3})\s*([\d,]+(?:\.\d+)?)/.exec(cap);
    return match ? { currency: match[1], amount: Number(match[2].replaceAll(",", "")) } : null;
  });
  if (parsed.some((item) => item === null)) return { currency: "UNKNOWN", amount: null };
  const values = parsed.filter((item): item is { currency: string; amount: number } => item !== null);
  const currencies = new Set(values.map((item) => item.currency));
  if (currencies.size !== 1) return { currency: "MIXED", amount: null };
  return { currency: values[0]?.currency ?? "UNKNOWN", amount: values.reduce((sum, item) => sum + item.amount, 0) };
};

export const preSampleBriefPaths = (runId: string) => {
  const reports = path.join(researchPackagePath(runId), "reports");
  return {
    reports,
    markdown: path.join(reports, "pre-sample-decision-brief.md"),
    html: path.join(reports, "pre-sample-decision-brief.html"),
  };
};

export const buildPreSampleDecisionBrief = async (runId: string): Promise<PreSampleDecisionBrief> => {
  const packagePath = researchPackagePath(runId);
  const [evidencePackage, bundle, localization, liveArtifacts, vocSummary] = await Promise.all([
    readEvidencePackage(packagePath),
    readFirstPrinciplesBundle(runId),
    readSellerBriefLocalization(runId),
    readLiveResearchArtifacts(packagePath),
    readVocSummary(runId),
  ]);
  const { result: decisionState } = await readDecisionStateAssessment(runId, liveArtifacts.claims);
  const recommended =
    bundle.opportunity_hypotheses.find((item) => item.id === bundle.recommended_opportunity_id) ??
    bundle.opportunity_hypotheses[0];
  if (!recommended) throw new Error(`Opportunity portfolio is empty for ${runId}`);

  const budget = sumBudgetCaps(bundle.validation_plan.map((item) => item.budget_cap));
  const status = decisionState.status;
  if (status === "RESEARCH_MORE" && !localization.researchMore) {
    throw new Error(`RESEARCH_MORE localization is missing for ${runId}`);
  }
  if (status === "NOT_WORTH_PURSUING" && !localization.notWorthPursuing) {
    throw new Error(`NOT_WORTH_PURSUING localization is missing for ${runId}`);
  }
  const localizedValidationByType = new Map(localization.validationSteps.map((item) => [item.internalType, item]));
  const validationSteps = bundle.validation_plan.map((item) => {
    const internalType = item.test_type as ValidationTestType;
    const localized = localizedValidationByType.get(internalType);
    if (!localized) throw new Error(`Missing localized validation step: ${item.test_type}`);
    return {
      internalType,
      name: validationTypeLabels[internalType],
      method: localized.method,
      scope: localized.scope,
      budgetCap: item.budget_cap,
      durationDays: item.duration_days,
      metric: localized.metric,
      pass: localized.pass,
      fail: localized.fail,
      stop: localized.stop,
      nextIfPass: localized.nextIfPass,
      nextIfFail: localized.nextIfFail,
    };
  });

  return {
    runId,
    product: evidencePackage.researchInput.productName,
    market: evidencePackage.researchInput.targetMarket,
    generatedAt: localization.generatedAt,
    language: "zh-CN",
    status,
    statusLabel: statusLabels[status],
    conclusion: localization.conclusion,
    scopeNotice: "当前结论只适用于买样前机会判断，不代表供应商、样品、大货、单位经济或投放已经通过。",
    whyContinue: localization.whyContinue,
    recommendation: {
      ...localization.recommendation,
      internalTitle: recommended.title,
    },
    mustHave: localization.mustHave,
    nextStageRequirements: localization.nextStageRequirements,
    mustNotHave: localization.mustNotHave,
    supplierHandoff: localization.supplierHandoff,
    supplierInquiryGroups: localization.supplierInquiryGroups,
    validationSteps,
    estimatedValidationBudget: {
      currency: budget.currency,
      amount: budget.amount,
      label: budget.amount === null ? "尚未确认" : `${budget.currency} ${budget.amount.toLocaleString("en-US")}`,
      budgetFit: "UNKNOWN",
      budgetFitLabel: "预算匹配：尚未确认",
      note: "这是所有实验预算上限的合计，不代表必须一次性花完。应按阶段投入；前一阶段失败后，不再投入后续预算。",
    },
    stopConditionGroups: validationSteps.map((item) => ({
      title: `${item.name}停止条件`,
      conditions: [item.stop],
    })),
    researchMore: localization.researchMore,
    notWorthPursuing: localization.notWorthPursuing,
    evidenceTrust: {
      sourceCount: evidencePackage.sources.length,
      verifiedCount: evidencePackage.sources.filter((item) => item.evidenceStatus === "verified").length,
      needsReviewCount: evidencePackage.sources.filter((item) => item.evidenceStatus === "needs_review").length,
      unresolvedCount: evidencePackage.unresolvedItems.length,
      verifiedExplanation: "已验证：当前研究流程已成功读取并核验。",
      needsReviewExplanation: "待复核：已发现来源，但内容、适用性或访问稳定性仍需人工确认。",
      sources: evidencePackage.sources.map((item) => ({
        title: sourceTitleZh(item.title),
        url: item.url,
        status: item.evidenceStatus,
        statusLabel: evidenceStatusLabels[item.evidenceStatus] ?? "待复核",
      })),
    },
    voiceOfCustomer: vocSummary
      ? {
          available: true,
          confidence: vocSummary.confidence,
          confidenceRationale: vocSummary.confidence === "HIGH"
            ? "当前有界语料跨三个独立来源族，包含足量负面或中性观察以及正向反证。"
            : vocSummary.confidence === "MEDIUM"
              ? "重复主题可追溯到至少两个独立来源族，并包含正向证据或反证。"
              : vocSummary.confidence_rationale,
          validObservations: vocSummary.coverage.valid_observations,
          negativeOrNeutral: vocSummary.coverage.negative_or_neutral,
          positiveOrCounterevidence: vocSummary.coverage.positive_or_counterevidence,
          sourceCount: vocSummary.coverage.source_count,
          sourceFamilyCount: vocSummary.coverage.source_family_count,
          platformCount: vocSummary.coverage.platform_count,
          denominatorDefinition: localizeVocDenominator(vocSummary.denominator_definition),
          topPainPoints: vocSummary.top_pain_points.map((item) => ({
            theme: localizeVocTheme(item.theme),
            count: item.count,
            denominator: item.denominator,
            sourceFamilies: item.source_families.map((family) => vocFamilyLabels[family] ?? family),
            scopeNote: localizeVocScope(item.scope_note),
          })),
          desiredOutcomes: vocSummary.desired_outcomes.map((item) => `${localizeVocTheme(item.theme)}（${item.count}/${item.denominator}）`),
          counterevidence: vocSummary.positive_and_counterevidence.map((item) => `${localizeVocTheme(item.theme)}（${item.count}/${item.denominator}）`),
          representativeExcerpts: vocSummary.representative_excerpts.map((item) => ({
            theme: localizeVocTheme(item.theme),
            excerpt: item.excerpt,
            url: item.url,
          })),
          blockers: vocSummary.blockers.map(localizeVocLimitation),
          limitations: vocSummary.limitations.map(localizeVocLimitation),
          amazonCommentLevelEvidence: vocSummary.amazon_comment_level_evidence,
        }
      : {
          available: false,
          confidence: "INSUFFICIENT",
          confidenceRationale: "当前 Run 尚未导入评论级用户之声证据。",
          validObservations: 0,
          negativeOrNeutral: 0,
          positiveOrCounterevidence: 0,
          sourceCount: 0,
          sourceFamilyCount: 0,
          platformCount: 0,
          denominatorDefinition: "当前无有效评论级观察。",
          topPainPoints: [],
          desiredOutcomes: [],
          counterevidence: [],
          representativeExcerpts: [],
          blockers: ["尚未完成用户之声研究。"],
          limitations: ["文档来源不能替代评论级用户观察。"],
          amazonCommentLevelEvidence: false,
        },
    advancedAuditUrls: {
      research: `/research/${runId}`,
      firstPrinciples: `/research/${runId}/first-principles`,
    },
    decisionBoundaries: {
      formalPurchase: "尚未判断；需要正式报价、样品验证、标签与单位经济证据。",
      supplierReliability: "尚未判断；公开页面只能用于供应商候选研究。",
      listing: "不属于当前产品阶段。",
      adTest: "不属于当前产品阶段。",
    },
    marketingTranslation: liveArtifacts.analysis.marketingTranslation,
  };
};

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const markdownList = (items: string[]): string => items.map((item) => `- ${item}`).join("\n");
const htmlList = (items: string[]): string => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
const tableCell = (value: string): string => value.replaceAll("|", "\\|").replaceAll("\n", " ");

const markdownInquiryGroups = (brief: PreSampleDecisionBrief): string =>
  brief.supplierInquiryGroups.map((group) => `### ${group.title}\n${group.questionsZh.map((item, index) => `${index + 1}. ${item}`).join("\n")}`).join("\n\n");

const evidenceTrustMarkdown = (brief: PreSampleDecisionBrief): string => `## 证据信任摘要

- 来源总数：${brief.evidenceTrust.sourceCount}
- 已验证：${brief.evidenceTrust.verifiedCount}
- 待复核：${brief.evidenceTrust.needsReviewCount}
- 未解决问题：${brief.evidenceTrust.unresolvedCount}

${brief.evidenceTrust.verifiedExplanation}

${brief.evidenceTrust.needsReviewExplanation}

${brief.evidenceTrust.sources.map((item) => `- [${item.title}](${item.url}) — ${item.statusLabel}`).join("\n")}

[查看高级审计信息](${brief.advancedAuditUrls.research})`;

const sellerReportTextZh = (value: string): string => {
  const translations: Record<string, string> = {
    "Amazon evidence is a bounded third-party-provider sample and is not representative of all purchasers.": "亚马逊证据来自有边界的第三方服务商样本，不能代表全部购买者。",
    "Amazon review bodies were processed transiently; seller-facing artifacts retain paraphrases, ratings and audit hashes rather than full copyrighted text.": "亚马逊评论正文仅作临时处理；面向卖家的产物保留转述、评分和审计哈希，不保存受版权保护的完整正文。",
    "SUUKSESS evidence is a bounded brand-hosted review sample and may be subject to merchant moderation or selection effects.": "SUUKSESS 证据来自品牌自有页面的有边界评论样本，可能受到商家审核或样本选择效应影响。",
    community: "独立社区",
    marketplace: "零售平台",
    competitor_product: "竞品",
  };
  return translations[value] ?? value;
};

const voiceOfCustomerMarkdown = (brief: PreSampleDecisionBrief): string => `## 用户之声证据

这里的评论级观察与文档来源、结论分开统计。计数只描述当前有界语料，不代表市场总体发生率。

- 用户之声可信度：${statusZh(brief.voiceOfCustomer.confidence.toLowerCase())}
- 有效观察：${brief.voiceOfCustomer.validObservations}
- 负面或中性：${brief.voiceOfCustomer.negativeOrNeutral}
- 正向或反证：${brief.voiceOfCustomer.positiveOrCounterevidence}
- 来源页面 / 来源族 / 平台：${brief.voiceOfCustomer.sourceCount} / ${brief.voiceOfCustomer.sourceFamilyCount} / ${brief.voiceOfCustomer.platformCount}
- 分母：${brief.voiceOfCustomer.denominatorDefinition}
- 亚马逊评论级证据：${brief.voiceOfCustomer.amazonCommentLevelEvidence ? "已取得" : "未取得"}

${brief.voiceOfCustomer.confidenceRationale}

### 主要痛点
${brief.voiceOfCustomer.topPainPoints.length === 0 ? "- 无有效评论级痛点" : brief.voiceOfCustomer.topPainPoints.map((item) => `- ${item.theme}：${item.count}/${item.denominator}；来源族 ${item.sourceFamilies.map(sellerReportTextZh).join("、")}；范围 ${sellerReportTextZh(item.scopeNote)}`).join("\n")}

### 期望结果与做法
${markdownList(brief.voiceOfCustomer.desiredOutcomes.length > 0 ? brief.voiceOfCustomer.desiredOutcomes : ["无"])}

### 正向证据与反证
${markdownList(brief.voiceOfCustomer.counterevidence.length > 0 ? brief.voiceOfCustomer.counterevidence : ["无"])}

### 代表性短摘录
${brief.voiceOfCustomer.representativeExcerpts.length === 0 ? "- 无" : brief.voiceOfCustomer.representativeExcerpts.map((item) => `- [${item.theme}](${item.url})：${item.excerpt}`).join("\n")}

### 阻塞项与限制
${markdownList([...new Set([...brief.voiceOfCustomer.blockers, ...brief.voiceOfCustomer.limitations])].map(sellerReportTextZh))}`;

const decisionBoundariesMarkdown = (brief: PreSampleDecisionBrief): string => `## 决策边界

- 正式采购：${brief.decisionBoundaries.formalPurchase}
- 供应商可靠性：${brief.decisionBoundaries.supplierReliability}
- 商品上架：${brief.decisionBoundaries.listing}
- 广告测试：${brief.decisionBoundaries.adTest}`;

const briefMarkdownHeader = (brief: PreSampleDecisionBrief): string => `# 买样前机会决策简报

> ${productNameZh(brief.product)} / ${brief.market} / ${brief.runId}

**当前阶段：${brief.statusLabel}**

**中文说明：${brief.statusLabel}**

${brief.scopeNotice}

## 一句话结论

${brief.conclusion}`;

const marketingTranslationMarkdown = (brief: PreSampleDecisionBrief): string => {
  const translation = brief.marketingTranslation;
  if (!translation) return "";
  const statusLabel = translation.status === "ready_for_use" ? "可使用" : "待验证草案";
  const evidenceLabel = (status: string) => ({
    supported: "已支持",
    directional: "方向性证据",
    hypothesis: "待验证假设",
    prohibited: "禁止",
  }[status] ?? status);
  return `## 从商品机会到营销表达

**当前文案状态：${statusLabel}**

${translation.status === "ready_for_use"
    ? "相关动作权限已经开放；正式发布前仍需核对最终渠道版本。"
    : "商品上架或广告测试权限尚未全部开放，以下内容只能作为概念测试草案。"}

### 一句话价值主张

${translation.valueProposition}

### 产品卖点到用户价值

| 产品卖点 | 用户利益 | 使用场景 | 情绪价值 | 营销话术 | 证据 |
| --- | --- | --- | --- | --- | --- |
${translation.messagePillars.map((item) => `| ${tableCell(item.productSellingPoint)} | ${tableCell(item.customerBenefit)} | ${tableCell(item.useScenario)} | ${tableCell(item.emotionalValue)} | ${tableCell(item.marketingCopy)} | ${evidenceLabel(item.evidenceStatus)} |`).join("\n")}

### 渠道草案

- Listing 标题：${translation.channelDrafts.listingTitle.text}
- 独立站首屏：${translation.channelDrafts.hero.headline} — ${translation.channelDrafts.hero.subheadline}
- 广告角度：
${markdownList(translation.channelDrafts.adAngles.map((item) => item.text))}
- 内容钩子：
${markdownList(translation.channelDrafts.contentHooks.map((item) => item.text))}

### 禁用 Claim

${markdownList(translation.prohibitedClaims.map((item) => `${item.claim}：${item.reason}`))}

### 为什么还不能上线

${markdownList(translation.usageBoundaries)}

### 概念与 Claim 验证

${translation.validationExperiments.map((item) => `#### ${item.name}

- 关键假设：${item.keyHypothesis}
- 使用表达：${item.marketingExpression}
- 目标人群：${item.targetAudience}
- 指标：${item.metric}
- 通过：${item.passThreshold}
- 失败：${item.failThreshold}
- 停止：${item.stopCondition}
- 通过后：${item.nextIfPass}
- 失败后：${item.nextIfFail}`).join("\n\n")}
`;
};

export const preSampleBriefMarkdown = (brief: PreSampleDecisionBrief): string => {
  if (brief.status === "RESEARCH_MORE") {
    if (!brief.researchMore) throw new Error("RESEARCH_MORE Brief requires state-specific content");
    return `${briefMarkdownHeader(brief)}

## 当前可能存在的机会

以下内容仅为待验证假设，不是采购建议：

${markdownList(brief.researchMore.possibleOpportunities)}

## 关键缺失证据

${markdownList(brief.researchMore.keyMissingEvidence)}

## 下一轮研究计划

| 需要回答的问题 | 建议来源 | 研究预算上限 | 通过标准 | 失败标准 | 停止条件 |
| --- | --- | ---: | --- | --- | --- |
${brief.researchMore.researchPlan.map((item) => `| ${tableCell(item.question)} | ${tableCell(item.suggestedSources.join("；"))} | ${item.budgetCap} | ${tableCell(item.pass)} | ${tableCell(item.fail)} | ${tableCell(item.stop)} |`).join("\n")}

## 升级条件

只有满足以下条件后，才可以进入供应商候选研究与受控买样阶段：

${markdownList(brief.researchMore.upgradeConditions)}

## 当前不建议投入

${markdownList(brief.researchMore.doNotInvest)}

${marketingTranslationMarkdown(brief)}

${voiceOfCustomerMarkdown(brief)}

${evidenceTrustMarkdown(brief)}

${decisionBoundariesMarkdown(brief)}
`;
  }

  if (brief.status === "NOT_WORTH_PURSUING") {
    if (!brief.notWorthPursuing) throw new Error("NOT_WORTH_PURSUING Brief requires state-specific content");
    return `${briefMarkdownHeader(brief)}

## 停止原因

${markdownList(brief.notWorthPursuing.stopReasons)}

## 支持证据

${markdownList(brief.notWorthPursuing.supportingEvidence)}

## 为什么不是继续补证

${markdownList(brief.notWorthPursuing.whyNotMoreResearch)}

## 重新评估条件

${markdownList(brief.notWorthPursuing.reassessmentConditions)}

## 当前不建议投入

${markdownList(brief.notWorthPursuing.doNotInvest)}

${marketingTranslationMarkdown(brief)}

${voiceOfCustomerMarkdown(brief)}

${evidenceTrustMarkdown(brief)}

${decisionBoundariesMarkdown(brief)}
`;
  }

  return `# 买样前机会决策简报

> ${brief.product} / ${brief.market} / ${brief.runId}

**当前阶段：${brief.status}**

**中文说明：${brief.statusLabel}**

${brief.scopeNotice}

## 一、一句话结论

${brief.conclusion}

## 二、为什么值得或不值得继续

### 用户是谁
${markdownList(brief.whyContinue.users)}

### 典型场景
${markdownList(brief.whyContinue.scenarios)}

### 核心痛点
${markdownList(brief.whyContinue.painPoints)}

### 当前替代方案及缺口
${markdownList(brief.whyContinue.currentAlternatives)}

### 竞品为什么能卖
${markdownList(brief.whyContinue.competitorReasons)}

### 机会成立的关键依据
${markdownList(brief.whyContinue.opportunityEvidence)}

### 最大不确定性
${markdownList(brief.whyContinue.majorUnknowns)}

## 三、推荐产品方向

### ${brief.recommendation.title}

- 目标用户：${brief.recommendation.targetCustomer}
- 核心场景：${brief.recommendation.targetScenario}
- 产品概念：${brief.recommendation.productConcept}
- 核心价值：${brief.recommendation.coreValue}
- 当前证据强度：${brief.recommendation.evidenceStrength}

${brief.recommendation.whyFirst}

### 为什么其他方向暂不优先
${markdownList(brief.recommendation.alternativesDeferred)}

## 四、产品必须具备
${markdownList(brief.mustHave)}

## 五、进入下一阶段前必须完成
${markdownList(brief.nextStageRequirements)}

## 六、明确不能做

### 产品结构与范围
${markdownList(brief.mustNotHave.productScope)}

### 营销声明
${markdownList(brief.mustNotHave.marketingClaims)}

### 证据与供应链
${markdownList(brief.mustNotHave.evidenceAndSupplyChain)}

## 七、供应链交接简报

- 产品方向：${brief.supplierHandoff.productDirection}
- 候选样品范围：${brief.supplierHandoff.sampleScope}

### 核心结构和材料方向
${markdownList(brief.supplierHandoff.structureAndMaterialDirections)}

### 需要供应商书面确认
${markdownList(brief.supplierHandoff.supplierConfirmations)}

### 需要索取的文件
${markdownList(brief.supplierHandoff.requestedDocuments)}

### 公开页面不能代替
${markdownList(brief.supplierHandoff.publicPageLimitations)}

## 八、供应商询盘清单

${markdownInquiryGroups(brief)}

## 九、样品与市场验证计划

| 测试名称 | 怎么做 | 范围 | 预算上限 | 周期 | 通过标准 | 失败标准 | 停止条件 |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
${brief.validationSteps.map((item) => `| ${item.name} | ${tableCell(item.method)} | ${tableCell(item.scope)} | ${validationBudgetZh(item.internalType)} | ${item.durationDays} 天 | ${tableCell(item.pass)} | ${tableCell(item.fail)} | ${tableCell(item.stop)} |`).join("\n")}

## 十、预算上限

- 建议验证预算上限：**${brief.estimatedValidationBudget.label}**
- ${brief.estimatedValidationBudget.budgetFitLabel}
- ${brief.estimatedValidationBudget.note}

## 十一、立即停止条件

${brief.stopConditionGroups.map((group) => `### ${group.title}\n${markdownList(group.conditions)}`).join("\n\n")}

${marketingTranslationMarkdown(brief)}

${voiceOfCustomerMarkdown(brief)}

## 十二、证据信任摘要

- 来源总数：${brief.evidenceTrust.sourceCount}
- 已验证：${brief.evidenceTrust.verifiedCount}
- 待复核：${brief.evidenceTrust.needsReviewCount}
- 未解决问题：${brief.evidenceTrust.unresolvedCount}

${brief.evidenceTrust.verifiedExplanation}

${brief.evidenceTrust.needsReviewExplanation}

${brief.evidenceTrust.sources.map((item) => `- [${item.title}](${item.url}) — ${item.statusLabel}`).join("\n")}

[查看高级审计信息](${brief.advancedAuditUrls.research})

## 十三、决策边界

- 正式采购：${brief.decisionBoundaries.formalPurchase}
- 供应商可靠性：${brief.decisionBoundaries.supplierReliability}
- 商品上架：${brief.decisionBoundaries.listing}
- 广告测试：${brief.decisionBoundaries.adTest}
`;
};

type ReportBarDatum = {
  label: string;
  count: number;
  denominator: number;
  meta?: string;
};

const percentageLabel = (count: number, denominator: number): string =>
  denominator > 0 ? `${((count / denominator) * 100).toFixed(1)}%` : "N/A";

const reportBarChart = (items: ReportBarDatum[], note: string): string => {
  const maximum = Math.max(...items.map((item) => item.count), 1);
  return `<div class="bar-chart">${items.map((item) => {
    const relativeWidth = item.count === 0 ? 0 : Math.max(4, Math.round((item.count / maximum) * 100));
    const value = `${item.count}/${item.denominator} · ${percentageLabel(item.count, item.denominator)}`;
    return `<div class="bar-row"><div class="bar-heading"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(value)}</span></div><div class="bar-track" role="img" aria-label="${escapeHtml(`${item.label}：${value}`)}"><i style="--bar-width:${relativeWidth}%"></i></div>${item.meta ? `<small>${escapeHtml(item.meta)}</small>` : ""}</div>`;
  }).join("")}<p class="chart-note">${escapeHtml(note)}</p></div>`;
};

const countedEvidence = (items: string[]): ReportBarDatum[] =>
  items.flatMap((item) => {
    const match = /^(.+?)[（(]\s*(\d+)\s*\/\s*(\d+)\s*[）)]/u.exec(item);
    if (!match) return [];
    return [{
      label: match[1].trim(),
      count: Number(match[2]),
      denominator: Number(match[3]),
    }];
  });

const evidenceDonut = (
  total: number,
  segments: Array<{ label: string; value: number; color: string }>,
  centerLabel: string,
): string => {
  const safeTotal = Math.max(total, 1);
  let cursor = 0;
  const gradient = segments.map((segment) => {
    const start = cursor;
    cursor += (segment.value / safeTotal) * 100;
    return `${segment.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  }).join(",");
  return `<div class="donut-group"><div class="donut" role="img" aria-label="${escapeHtml(segments.map((segment) => `${segment.label} ${segment.value}`).join("，"))}" style="background:conic-gradient(${gradient})"><div><strong>${total}</strong><span>${escapeHtml(centerLabel)}</span></div></div><div class="donut-legend">${segments.map((segment) => `<p><i style="background:${segment.color}"></i><span>${escapeHtml(segment.label)}</span><strong>${segment.value}</strong></p>`).join("")}</div></div>`;
};

const personaHtml = (brief: PreSampleDecisionBrief): string => {
  if (!/yoga|瑜伽/iu.test(`${brief.product} ${brief.recommendation.title}`)) return "";
  return `<div class="persona-panel"><figure><img src="/research-report/3d-yoga-pants-persona.jpg" alt="基于研究证据生成的 3D 瑜伽裤核心用户场景示意图" width="1672" height="941" loading="lazy"><figcaption>AI 生成的用户场景示意图，不代表真实受访者</figcaption></figure><div class="persona-copy"><span class="eyebrow">证据合成用户画像</span><h3>从训练场景自然过渡到日常穿着</h3><dl><div><dt>核心人群</dt><dd>${escapeHtml(brief.recommendation.targetCustomer)}</dd></div><div><dt>高频场景</dt><dd>${escapeHtml(brief.recommendation.targetScenario)}</dd></div><div><dt>首要期待</dt><dd>${escapeHtml(brief.recommendation.coreValue)}</dd></div></dl><p class="chart-note">画像由当前研究中的用户、场景与痛点证据综合而成，用于帮助理解需求，不用于推断人口统计学分布。</p></div></div>`;
};

export const readDemandFieldArtifact = async (runId: string): Promise<DemandFieldArtifact | null> => {
  try {
    return demandFieldArtifactSchema.parse(JSON.parse(await readFile(demandFieldPaths(runId).artifact, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

const demandFieldReportHtml = (artifact: DemandFieldArtifact | null): string => {
  if (!artifact) return "";
  const audiences = artifact.audience_clusters.map((audience) => `<article><span>${audience.supporting_observation_ids.length} 条支持观察</span><h3>${escapeHtml(demandFieldTextZh(audience.label))}</h3><p>${escapeHtml(demandFieldTextZh(audience.definition))}</p></article>`).join("");
  const taskChain = [...artifact.task_chain].sort((a, b) => a.sequence - b.sequence)
    .map((step) => `<div><b>${step.sequence}</b><span>${escapeHtml(demandStatusZh(step.relative_to_current_product))}</span><strong>${escapeHtml(demandFieldTextZh(step.label))}</strong><p>${escapeHtml(demandFieldTextZh(step.job))}</p></div>`)
    .join("");
  const opportunities = artifact.adjacent_opportunities.map((opportunity) => `<article class="adjacent-card"><div class="adjacent-heading"><div><div class="adjacent-tags">${opportunity.relationship_types.map((relationship) => `<span>${escapeHtml(demandRelationshipZh(relationship))}</span>`).join("")}</div><h3>${escapeHtml(demandFieldTextZh(opportunity.title))}</h3><p>${escapeHtml(demandFieldTextZh(opportunity.candidate_category))}</p></div><b class="${opportunity.direct_product_evidence ? "direct" : "hypothesis"}">${opportunity.direct_product_evidence ? "有直接商品证据" : "任务链假设"}</b></div><div class="adjacent-metrics"><div><span>证据状态</span><strong>${escapeHtml(demandStatusZh(opportunity.evidence_status))}</strong></div><div><span>关系强度</span><strong>${escapeHtml(demandStatusZh(opportunity.relationship_strength))}</strong></div><div><span>下一步</span><strong>${escapeHtml(demandStatusZh(opportunity.status))}</strong></div></div><p><strong>为什么值得研究：</strong>${escapeHtml(demandFieldTextZh(opportunity.rationale))}</p><p><strong>为什么尚未批准：</strong>${escapeHtml(demandFieldTextZh(opportunity.why_not_approved))}</p></article>`).join("");
  return `<section><h2>十二、同一人群的相邻产品机会</h2><div class="adjacent-boundary"><strong>以下方向仅供继续研究，不是已批准选品。</strong><p>每个方向都必须创建新的 Research Run，重新验证需求、竞争、供应和单位经济。</p></div><h3>聚合用户画像</h3><div class="adjacent-audiences">${audiences}</div><h3>从当前商品延伸的任务链</h3><div class="adjacent-chain">${taskChain}</div><h3>候选研究方向</h3><div class="adjacent-list">${opportunities}</div></section>`;
};

const preSampleReportThemeCss = `
:root{--orange:#ff5b29;--lime:#f5ff80;--black:#000;--paper:#fafafa;--graphite:#242424;--steel:#6c6c6c;--ash:#b3b3b3;--forest:#174c2d;--forest-soft:#e7f4ea;--amber:#8a5a00;--amber-bg:#fff4d6;--red:#a33a2b;--red-bg:#fdebe8;--shadow:5px 5px 0 #000;--sans:"Geist","Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"Geist Mono","SFMono-Regular",Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;background-color:var(--paper);background-image:linear-gradient(rgba(0,0,0,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.045) 1px,transparent 1px);background-size:24px 24px;color:var(--black);font:15px/1.65 var(--sans)}
main{max-width:1120px;margin:auto;padding:48px 28px 88px}
h1{margin:0 0 8px;color:var(--black);font-size:48px;line-height:1.1;overflow-wrap:anywhere}
h2{margin:0 0 16px;color:var(--black);font-size:24px;line-height:1.3}
h3{color:var(--black);font-size:17px}
.meta{margin-bottom:28px;color:var(--steel);font-family:var(--mono)}
section{margin-top:32px;padding:24px;border:1px solid var(--black);border-radius:12px;background:var(--paper);box-shadow:var(--shadow)}
.status{padding:24px;border:1px solid var(--black);border-left:8px solid var(--orange);border-radius:12px;background:var(--lime);box-shadow:var(--shadow)}
.status code{display:block;color:var(--black);font-family:var(--mono);font-weight:700}
.status strong{display:block;margin:6px 0;color:var(--black);font:700 24px/1.3 var(--mono)}
.notice{color:var(--graphite)}
.conclusion{margin:0;color:var(--graphite);font-size:21px;line-height:1.6}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}.three{grid-template-columns:repeat(3,minmax(0,1fr))}
ul,ol{padding-left:22px}.sources{list-style:none;padding:0}.sources li{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.25)}
a{color:var(--black);overflow-wrap:anywhere;text-decoration-color:var(--orange);text-underline-offset:3px}
.plan{margin-top:16px;padding:18px;border:1px solid var(--black);border-radius:12px;background:var(--lime);box-shadow:var(--shadow)}.plan p{margin:6px 0}
table{width:100%;min-width:980px;border-collapse:collapse}th,td{padding:12px;border:1px solid var(--black);text-align:left;vertical-align:top}th{background:var(--lime);font-family:var(--mono);font-size:12px}td small{display:block;margin-top:4px;color:var(--steel)}.table-wrap{overflow-x:auto;border:1px solid var(--black);border-radius:12px;box-shadow:var(--shadow)}
.budget{color:var(--black);font:700 40px/1.1 var(--mono)}
.boundary,.stop{padding:16px;border:1px solid var(--amber);border-radius:8px;background:var(--amber-bg);color:var(--amber)}
.must-not{padding:16px;border:1px solid var(--red);border-radius:8px;background:var(--red-bg);color:#6f2b22}
details{margin-top:16px;padding:14px;border:1px solid var(--black);border-radius:8px}summary{cursor:pointer;font-weight:700}
.eyebrow{display:inline-block;margin-bottom:8px;font:700 12px/1.2 var(--mono);text-transform:uppercase}
.persona-panel{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(280px,.88fr);overflow:hidden;margin:0 0 24px;border:1px solid var(--black);border-radius:10px;background:#fff;box-shadow:var(--shadow)}
.persona-panel figure{position:relative;min-height:320px;margin:0;border-right:1px solid var(--black);background:#ececec}.persona-panel img{display:block;width:100%;height:100%;object-fit:cover}.persona-panel figcaption{position:absolute;right:10px;bottom:10px;max-width:78%;padding:5px 8px;border:1px solid var(--black);background:rgba(250,250,250,.92);font:11px/1.35 var(--mono)}
.persona-copy{padding:24px}.persona-copy h3{margin:0 0 18px;font-size:24px;line-height:1.25}.persona-copy dl{margin:0}.persona-copy dl div{padding:12px 0;border-top:1px solid rgba(0,0,0,.2)}.persona-copy dt{font:700 11px/1.3 var(--mono);text-transform:uppercase}.persona-copy dd{margin:4px 0 0}
.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin:18px 0 24px;border:1px solid var(--black);background:var(--black)}.metric-card{padding:15px;background:#fff}.metric-card span{display:block;color:var(--steel);font:12px/1.3 var(--mono)}.metric-card strong{display:block;margin-top:4px;font:700 26px/1.15 var(--mono)}
.visual-grid{display:grid;grid-template-columns:minmax(260px,.72fr) minmax(0,1.28fr);gap:24px;align-items:start;margin:20px 0 28px}.chart-panel{padding:20px;border:1px solid var(--black);border-radius:10px;background:#fff}.chart-panel>h3{margin:0 0 4px}.chart-kicker{margin:0 0 18px;color:var(--steel);font-size:13px}
.donut-group{display:grid;grid-template-columns:170px minmax(0,1fr);gap:20px;align-items:center}.donut{display:grid;width:170px;aspect-ratio:1;place-items:center;border:1px solid var(--black);border-radius:50%}.donut>div{display:grid;width:104px;aspect-ratio:1;place-items:center;border:1px solid var(--black);border-radius:50%;background:var(--paper);text-align:center}.donut strong{align-self:end;font:700 30px/1 var(--mono)}.donut span{align-self:start;color:var(--steel);font:11px/1.2 var(--mono)}.donut-legend p{display:grid;grid-template-columns:12px 1fr auto;gap:8px;align-items:center;margin:10px 0}.donut-legend i{width:12px;height:12px;border:1px solid var(--black)}.donut-legend strong{font-family:var(--mono)}
.bar-chart{display:grid;gap:14px}.bar-heading{display:flex;justify-content:space-between;gap:18px;align-items:end}.bar-heading strong{font-size:14px}.bar-heading span{flex:none;color:var(--steel);font:12px/1.2 var(--mono)}.bar-track{height:13px;overflow:hidden;border:1px solid var(--black);background:#e4e4e4}.bar-track i{display:block;width:var(--bar-width);height:100%;background:var(--orange)}.bar-row small{display:block;margin-top:5px;color:var(--steel)}.chart-note{margin:14px 0 0;color:var(--steel);font-size:12px}
.evidence-bars .bar-track i{background:var(--forest)}.excerpt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.excerpt{margin:0;padding:15px;border-left:5px solid var(--orange);background:#fff}.excerpt p{margin:0}.excerpt a{display:inline-block;margin-bottom:6px;font-weight:700}.subsection{margin-top:28px;padding-top:22px;border-top:1px solid rgba(0,0,0,.28)}
.adjacent-boundary{margin-bottom:22px;padding:16px;border:1px solid var(--amber);border-radius:8px;background:var(--amber-bg);color:var(--amber)}.adjacent-boundary p{margin:5px 0 0}.adjacent-audiences{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:26px}.adjacent-audiences article,.adjacent-card{padding:18px;border:1px solid var(--black);border-radius:9px;background:#fff}.adjacent-audiences span,.adjacent-tags span,.adjacent-heading>b{display:inline-flex;padding:3px 7px;border:1px solid var(--black);border-radius:99px;font:700 11px/1.3 var(--mono)}.adjacent-audiences h3{margin:10px 0 6px}.adjacent-chain{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-bottom:26px;border:1px solid var(--black);background:var(--black)}.adjacent-chain>div{display:grid;gap:4px;padding:14px;background:#fff}.adjacent-chain b{display:grid;width:26px;height:26px;place-items:center;border-radius:50%;background:var(--black);color:#fff}.adjacent-chain span{color:var(--steel);font:11px/1.3 var(--mono)}.adjacent-chain p{margin:3px 0 0}.adjacent-list{display:grid;gap:14px}.adjacent-heading{display:flex;justify-content:space-between;gap:18px}.adjacent-heading h3{margin:10px 0 0;font-size:20px}.adjacent-heading p{margin:4px 0;color:var(--steel)}.adjacent-tags{display:flex;flex-wrap:wrap;gap:5px}.adjacent-heading>b{height:max-content;white-space:nowrap}.adjacent-heading>.direct{border-color:var(--forest);background:var(--forest-soft);color:var(--forest)}.adjacent-heading>.hypothesis{border-color:var(--amber);background:var(--amber-bg);color:var(--amber)}.adjacent-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;margin:16px 0;border:1px solid var(--black);background:var(--black)}.adjacent-metrics div{display:grid;padding:10px;background:var(--paper)}.adjacent-metrics span{color:var(--steel);font:11px/1.3 var(--mono)}
@media(max-width:850px){.persona-panel,.visual-grid{grid-template-columns:1fr}.persona-panel figure{min-height:280px;border-right:0;border-bottom:1px solid var(--black)}.donut-group{grid-template-columns:150px minmax(0,1fr)}.donut{width:150px}.donut>div{width:92px}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){main{padding:28px 16px 64px}.grid,.three,.adjacent-audiences,.adjacent-chain,.adjacent-metrics{grid-template-columns:1fr}h1{font-size:36px}section{padding:18px}.sources li,.adjacent-heading{display:block}.sources span{display:block;color:var(--steel)}.excerpt-grid{grid-template-columns:1fr}.donut-group{grid-template-columns:1fr;justify-items:center}.donut-legend{width:100%}.bar-heading{align-items:start}.bar-heading strong{max-width:60%}.adjacent-heading>b{margin-top:10px}}
`;

export const preSampleBriefHtml = (brief: PreSampleDecisionBrief, demandField: DemandFieldArtifact | null = null): string => {
  const section = (title: string, body: string): string => `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
  const sourceRows = brief.evidenceTrust.sources
    .map((item) => `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a><span>${escapeHtml(item.statusLabel)}</span></li>`)
    .join("");
  const voc = brief.voiceOfCustomer;
  const uncategorizedObservations = Math.max(0, voc.validObservations - voc.negativeOrNeutral - voc.positiveOrCounterevidence);
  const sentimentDonut = evidenceDonut(voc.validObservations, [
    { label: "负面或中性", value: voc.negativeOrNeutral, color: "var(--orange)" },
    { label: "正向或反证", value: voc.positiveOrCounterevidence, color: "var(--forest)" },
    { label: "其他有效观察", value: uncategorizedObservations, color: "#d9d9d9" },
  ], "有效观察");
  const painPointBars = reportBarChart(voc.topPainPoints.map((item) => ({
    label: item.theme,
    count: item.count,
    denominator: item.denominator,
    meta: `来源族：${item.sourceFamilies.map(sellerReportTextZh).join("、")} · 范围：${sellerReportTextZh(item.scopeNote)}`,
  })), "主题可能同时出现在同一条观察中，因此不适合用饼图。条形长度按本图最高频主题归一化，标签保留实际语料占比。");
  const counterevidenceCounts = countedEvidence(voc.counterevidence);
  const counterevidenceVisual = counterevidenceCounts.length > 0
    ? `<div class="evidence-bars">${reportBarChart(counterevidenceCounts, "正向证据与反证主题可能重叠；条形用于横向比较，不能相加为总体比例。")}</div>`
    : htmlList(voc.counterevidence);
  const vocHtml = section("用户之声证据", `<p>评论级观察与文档来源、结论分开统计；所有计数仅描述当前有界语料，不代表市场总体发生率。</p><div class="metric-grid"><div class="metric-card"><span>可信度</span><strong>${statusZh(voc.confidence.toLowerCase())}</strong></div><div class="metric-card"><span>有效观察</span><strong>${voc.validObservations}</strong></div><div class="metric-card"><span>来源页面</span><strong>${voc.sourceCount}</strong></div><div class="metric-card"><span>来源族 / 平台</span><strong>${voc.sourceFamilyCount} / ${voc.platformCount}</strong></div></div><p>${escapeHtml(voc.confidenceRationale)}</p><p><b>统计分母：</b>${escapeHtml(voc.denominatorDefinition)}</p><div class="visual-grid"><div class="chart-panel"><h3>观察倾向构成</h3><p class="chart-kicker">互斥分类，可按整体构成阅读</p>${sentimentDonut}</div><div class="chart-panel"><h3>主要痛点</h3><p class="chart-kicker">高频痛点主题的相对强度</p>${painPointBars}</div></div><div class="grid"><div><h3>期望结果与做法</h3>${htmlList(voc.desiredOutcomes)}</div><div><h3>正向证据与反证</h3>${counterevidenceVisual}</div></div><div class="subsection"><h3>代表性评论原文</h3><div class="excerpt-grid">${voc.representativeExcerpts.map((item) => `<blockquote class="excerpt"><a href="${escapeHtml(item.url)}">${escapeHtml(item.theme)}</a><p>${escapeHtml(item.excerpt)}</p></blockquote>`).join("")}</div></div><div class="subsection"><h3>阻塞项与限制</h3>${htmlList([...new Set([...voc.blockers, ...voc.limitations])].map(sellerReportTextZh))}<p><b>亚马逊评论级证据：</b>${voc.amazonCommentLevelEvidence ? "已取得" : "未取得"}</p></div>`);
  const trustDonut = evidenceDonut(brief.evidenceTrust.sourceCount, [
    { label: "已验证", value: brief.evidenceTrust.verifiedCount, color: "var(--forest)" },
    { label: "待复核", value: brief.evidenceTrust.needsReviewCount, color: "var(--orange)" },
  ], "来源总数");
  const evidenceTrustHtml = `<div class="visual-grid"><div class="chart-panel"><h3>来源验证状态</h3><p class="chart-kicker">按来源总数拆分</p>${trustDonut}</div><div><div class="metric-grid"><div class="metric-card"><span>来源总数</span><strong>${brief.evidenceTrust.sourceCount}</strong></div><div class="metric-card"><span>已验证</span><strong>${brief.evidenceTrust.verifiedCount}</strong></div><div class="metric-card"><span>待复核</span><strong>${brief.evidenceTrust.needsReviewCount}</strong></div><div class="metric-card"><span>未解决问题</span><strong>${brief.evidenceTrust.unresolvedCount}</strong></div></div><p>${escapeHtml(brief.evidenceTrust.verifiedExplanation)}<br>${escapeHtml(brief.evidenceTrust.needsReviewExplanation)}</p></div></div><ul class="sources">${sourceRows}</ul><p><a href="${escapeHtml(brief.advancedAuditUrls.research)}">查看高级审计信息</a></p>`;
  const adjacentHtml = demandFieldReportHtml(demandField);
  const translation = brief.marketingTranslation;
  const marketingHtml = translation
    ? section("从商品机会到营销表达", `<div class="adjacent-boundary"><strong>当前文案状态：${translation.status === "ready_for_use" ? "可使用" : "待验证草案"}</strong><p>${translation.status === "ready_for_use" ? "相关动作权限已经开放；正式发布前仍需核对最终渠道版本。" : "商品上架或广告测试权限尚未全部开放，以下内容只能作为概念测试草案。"}</p></div><h3>一句话价值主张</h3><p class="conclusion">${escapeHtml(translation.valueProposition)}</p><h3>产品卖点到用户价值</h3><div class="table-wrap"><table><thead><tr><th>产品卖点</th><th>用户利益</th><th>使用场景</th><th>情绪价值</th><th>营销话术</th><th>证据</th></tr></thead><tbody>${translation.messagePillars.map((item) => `<tr><td>${escapeHtml(item.productSellingPoint)}</td><td>${escapeHtml(item.customerBenefit)}</td><td>${escapeHtml(item.useScenario)}</td><td>${escapeHtml(item.emotionalValue)}</td><td>${escapeHtml(item.marketingCopy)}</td><td>${escapeHtml(statusZh(item.evidenceStatus))}</td></tr>`).join("")}</tbody></table></div><div class="grid"><div><h3>Listing 与首屏</h3><p><b>Listing：</b>${escapeHtml(translation.channelDrafts.listingTitle.text)}</p><p><b>首屏：</b>${escapeHtml(translation.channelDrafts.hero.headline)} — ${escapeHtml(translation.channelDrafts.hero.subheadline)}</p><h3>广告角度</h3>${htmlList(translation.channelDrafts.adAngles.map((item) => item.text))}</div><div><h3>内容钩子</h3>${htmlList(translation.channelDrafts.contentHooks.map((item) => item.text))}<h3>禁用 Claim</h3>${htmlList(translation.prohibitedClaims.map((item) => `${item.claim}：${item.reason}`))}</div></div><h3>为什么还不能上线</h3>${htmlList(translation.usageBoundaries)}<h3>概念与 Claim 验证</h3><div class="adjacent-list">${translation.validationExperiments.map((item) => `<article class="adjacent-card"><h3>${escapeHtml(item.name)}</h3><p><b>关键假设：</b>${escapeHtml(item.keyHypothesis)}</p><p><b>目标人群 / 指标：</b>${escapeHtml(item.targetAudience)} / ${escapeHtml(item.metric)}</p><p><b>通过：</b>${escapeHtml(item.passThreshold)}</p><p><b>失败：</b>${escapeHtml(item.failThreshold)}</p><p><b>停止：</b>${escapeHtml(item.stopCondition)}</p><p><b>下一步：</b>${escapeHtml(item.nextIfPass)}；失败则 ${escapeHtml(item.nextIfFail)}</p></article>`).join("")}</div>`)
    : "";
  if (brief.status !== "READY_FOR_SOURCING") {
    const researchMore = brief.researchMore;
    const notWorth = brief.notWorthPursuing;
    if (brief.status === "RESEARCH_MORE" && !researchMore) throw new Error("RESEARCH_MORE Brief requires state-specific content");
    if (brief.status === "NOT_WORTH_PURSUING" && !notWorth) throw new Error("NOT_WORTH_PURSUING Brief requires state-specific content");
    const stateSections = researchMore
      ? [
          section("当前可能存在的机会", `<p>以下内容仅为待验证假设，不是采购建议。</p>${htmlList(researchMore.possibleOpportunities)}`),
          section("关键缺失证据", htmlList(researchMore.keyMissingEvidence)),
          section("下一轮研究计划", researchMore.researchPlan.map((item) => `<div class="plan"><h3>${escapeHtml(item.question)}</h3><p><b>建议来源：</b>${escapeHtml(item.suggestedSources.join("；"))}</p><p><b>预算上限：</b>${escapeHtml(item.budgetCap)}</p><p><b>通过：</b>${escapeHtml(item.pass)}</p><p><b>失败：</b>${escapeHtml(item.fail)}</p><p><b>停止：</b>${escapeHtml(item.stop)}</p></div>`).join("")),
          section("升级条件", `<p>只有满足以下条件后，才可以进入供应商候选研究与受控买样阶段。</p>${htmlList(researchMore.upgradeConditions)}`),
          section("当前不建议投入", htmlList(researchMore.doNotInvest)),
        ].join("")
      : [
          section("停止原因", htmlList(notWorth?.stopReasons ?? [])),
          section("支持证据", htmlList(notWorth?.supportingEvidence ?? [])),
          section("为什么不是继续补证", htmlList(notWorth?.whyNotMoreResearch ?? [])),
          section("重新评估条件", htmlList(notWorth?.reassessmentConditions ?? [])),
          section("当前不建议投入", htmlList(notWorth?.doNotInvest ?? [])),
        ].join("");
    return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(productNameZh(brief.product))} 买样前机会决策简报</title>
<style>
${preSampleReportThemeCss}
.status{border-color:${researchMore ? "var(--amber)" : "var(--red)"};border-left-color:${researchMore ? "var(--amber)" : "var(--red)"};background:${researchMore ? "var(--amber-bg)" : "var(--red-bg)"};box-shadow:5px 5px 0 ${researchMore ? "var(--amber)" : "var(--red)"}}.status code,.status strong{color:${researchMore ? "var(--amber)" : "var(--red)"}}
</style></head><body><main>
<h1>${escapeHtml(productNameZh(brief.product))}</h1><p class="meta">目标市场：${escapeHtml(brief.market)}</p>
<div class="status"><code>当前阶段：${escapeHtml(brief.statusLabel)}</code><strong>${escapeHtml(brief.statusLabel)}</strong><p class="notice">${escapeHtml(brief.scopeNotice)}</p></div>
${section("一句话结论", `<p class="conclusion">${escapeHtml(brief.conclusion)}</p>`)}
	${stateSections}
	${marketingHtml}
	${vocHtml}
	${adjacentHtml}
	${section("证据信任摘要", evidenceTrustHtml)}
${section("决策边界", `<div class="boundary"><p><b>正式采购：</b>${escapeHtml(brief.decisionBoundaries.formalPurchase)}</p><p><b>供应商可靠性：</b>${escapeHtml(brief.decisionBoundaries.supplierReliability)}</p><p><b>商品上架：</b>${escapeHtml(brief.decisionBoundaries.listing)}</p><p><b>广告测试：</b>${escapeHtml(brief.decisionBoundaries.adTest)}</p></div>`)}
</main></body></html>`;
  }
  const validationRows = brief.validationSteps
    .map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${item.durationDays} 天</small></td><td>${escapeHtml(item.method)}<small>${escapeHtml(item.scope)}</small></td><td>${escapeHtml(validationBudgetZh(item.internalType))}</td><td>${escapeHtml(item.pass)}</td><td>${escapeHtml(item.fail)}</td><td>${escapeHtml(item.stop)}</td></tr>`)
    .join("");
  const inquiryGroups = brief.supplierInquiryGroups
    .map((group) => `<div><h3>${escapeHtml(group.title)}</h3><ol>${group.questionsZh.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div>`)
    .join("");
  const stopGroups = brief.stopConditionGroups
    .map((group) => `<div><h3>${escapeHtml(group.title)}</h3>${htmlList(group.conditions)}</div>`)
    .join("");

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(productNameZh(brief.product))} 买样前机会决策简报</title>
<style>
${preSampleReportThemeCss}
</style></head><body><main>
<h1>买样前机会决策简报</h1><p class="meta">${escapeHtml(productNameZh(brief.product))} · ${escapeHtml(brief.market)}</p>
<div class="status"><code>当前阶段：${escapeHtml(brief.statusLabel)}</code><strong>${escapeHtml(brief.statusLabel)}</strong><p class="notice">${escapeHtml(brief.scopeNotice)}</p></div>
${section("一、一句话结论", `<p class="conclusion">${escapeHtml(brief.conclusion)}</p>`)}
	${section("二、为什么值得或不值得继续", `${personaHtml(brief)}<div class="grid"><div><h3>用户是谁</h3>${htmlList(brief.whyContinue.users)}<h3>典型场景</h3>${htmlList(brief.whyContinue.scenarios)}<h3>核心痛点</h3>${htmlList(brief.whyContinue.painPoints)}</div><div><h3>当前替代方案及缺口</h3>${htmlList(brief.whyContinue.currentAlternatives)}<h3>竞品为什么能卖</h3>${htmlList(brief.whyContinue.competitorReasons)}<h3>机会成立的关键依据</h3>${htmlList(brief.whyContinue.opportunityEvidence)}<h3>最大不确定性</h3>${htmlList(brief.whyContinue.majorUnknowns)}</div></div>`)}
${section("三、推荐产品方向", `<h3>${escapeHtml(brief.recommendation.title)}</h3><p><b>目标用户：</b>${escapeHtml(brief.recommendation.targetCustomer)}</p><p><b>核心场景：</b>${escapeHtml(brief.recommendation.targetScenario)}</p><p><b>产品概念：</b>${escapeHtml(brief.recommendation.productConcept)}</p><p><b>核心价值：</b>${escapeHtml(brief.recommendation.coreValue)}</p><p><b>当前证据强度：</b>${escapeHtml(brief.recommendation.evidenceStrength)}</p><p>${escapeHtml(brief.recommendation.whyFirst)}</p><h3>为什么其他方向暂不优先</h3>${htmlList(brief.recommendation.alternativesDeferred)}`)}
<div class="grid">${section("四、产品必须具备", htmlList(brief.mustHave))}${section("五、进入下一阶段前必须完成", htmlList(brief.nextStageRequirements))}</div>
${section("六、明确不能做", `<div class="grid three must-not"><div><h3>产品结构与范围</h3>${htmlList(brief.mustNotHave.productScope)}</div><div><h3>营销声明</h3>${htmlList(brief.mustNotHave.marketingClaims)}</div><div><h3>证据与供应链</h3>${htmlList(brief.mustNotHave.evidenceAndSupplyChain)}</div></div>`)}
${section("七、供应链交接简报", `<p><b>产品方向：</b>${escapeHtml(brief.supplierHandoff.productDirection)}</p><p><b>候选样品范围：</b>${escapeHtml(brief.supplierHandoff.sampleScope)}</p><div class="grid"><div><h3>核心结构和材料方向</h3>${htmlList(brief.supplierHandoff.structureAndMaterialDirections)}<h3>需要供应商书面确认</h3>${htmlList(brief.supplierHandoff.supplierConfirmations)}</div><div><h3>需要索取的文件</h3>${htmlList(brief.supplierHandoff.requestedDocuments)}<h3>公开页面不能代替</h3>${htmlList(brief.supplierHandoff.publicPageLimitations)}</div></div>`)}
${section("八、供应商询盘清单", `<div class="grid">${inquiryGroups}</div>`)}
${section("九、样品与市场验证计划", `<div class="table-wrap"><table><thead><tr><th>测试名称</th><th>怎么做与范围</th><th>预算上限</th><th>通过标准</th><th>失败标准</th><th>停止条件</th></tr></thead><tbody>${validationRows}</tbody></table></div>`)}
${section("十、预算上限", `<p>建议验证预算上限</p><p class="budget">${escapeHtml(brief.estimatedValidationBudget.label)}</p><p><b>${escapeHtml(brief.estimatedValidationBudget.budgetFitLabel)}</b></p><p>${escapeHtml(brief.estimatedValidationBudget.note)}</p>`)}
	${section("十一、立即停止条件", `<div class="grid stop">${stopGroups}</div>`)}
	${marketingHtml}
	${vocHtml}
	${adjacentHtml}
	${section(demandField ? "十三、证据信任摘要" : "十二、证据信任摘要", evidenceTrustHtml)}
	${section(demandField ? "十四、决策边界" : "十三、决策边界", `<div class="boundary"><p><b>正式采购：</b>${escapeHtml(brief.decisionBoundaries.formalPurchase)}</p><p><b>供应商可靠性：</b>${escapeHtml(brief.decisionBoundaries.supplierReliability)}</p><p><b>商品上架：</b>${escapeHtml(brief.decisionBoundaries.listing)}</p><p><b>广告测试：</b>${escapeHtml(brief.decisionBoundaries.adTest)}</p></div>`)}
</main></body></html>`;
};

const sellerLeakPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "internal artifact ID", pattern: /\b(?:CLM|DEM|SUP|CON|OPP)-[A-Za-z0-9_-]+\b/u },
  { label: "WorkflowStageRun", pattern: /\bWorkflowStageRun\b/u },
  { label: "Validation Error Code", pattern: /\bValidation Error Code\b/u },
  { label: "HOLD_SUPPLY", pattern: /\bHOLD_SUPPLY\b/u },
  { label: "PROCEED_TO_SAMPLE", pattern: /\bPROCEED_TO_SAMPLE\b/u },
  { label: "untranslated validation type", pattern: /\b(?:concept_test|supplier_validation|sample_test|pricing_test|unit_economics_check)\b/u },
];

export const sellerBriefLeakageFindings = (output: string): string[] =>
  sellerLeakPatterns.filter(({ pattern }) => pattern.test(output)).map(({ label }) => label);

export const writePreSampleDecisionBrief = async (runId: string) => {
  const [brief, demandField] = await Promise.all([
    buildPreSampleDecisionBrief(runId),
    readDemandFieldArtifact(runId),
  ]);
  const paths = preSampleBriefPaths(runId);
  const markdown = preSampleBriefMarkdown(brief);
  const html = preSampleBriefHtml(brief, demandField);
  const findings = [...new Set([...sellerBriefLeakageFindings(markdown), ...sellerBriefLeakageFindings(html)])];
  if (findings.length > 0) throw new Error(`Seller Brief leakage check failed: ${findings.join(", ")}`);
  await mkdir(paths.reports, { recursive: true });
  await Promise.all([
    writeFile(paths.markdown, markdown, "utf8"),
    writeFile(paths.html, html, "utf8"),
  ]);
  return { status: "generated", runId, brief, leakageFindings: findings, markdownPath: paths.markdown, htmlPath: paths.html };
};
