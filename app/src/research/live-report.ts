import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LiveResearchAnalysis, ResearchClaim } from "./live-types";
import type { EvidencePackage } from "./types";
import type { FirstPrinciplesBundle } from "../first-principles/types";
import { buildWhiteboardReportModules } from "../research-whiteboard/service";
import { buildReportScorecard } from "../research-whiteboard/report-scorecard";
import type { ResearchWhiteboardSource } from "../research-whiteboard/types";
import { readSearchLog } from "./search-log";

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const list = (items: string[]): string => items.map((item) => `- ${item}`).join("\n");
const htmlList = (items: string[]): string => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
const marketingStatusLabel = (value: string): string => value === "ready_for_use" ? "可使用" : "待验证草案";
const evidenceStatusLabel = (value: string): string => ({
  supported: "已支持",
  directional: "方向性证据",
  hypothesis: "待验证假设",
  prohibited: "禁止",
}[value] ?? value);
const splitConclusion = (value: string): string[] => value.match(/[^。！？]+[。！？]?/gu)?.map((item) => item.trim()).filter(Boolean) ?? [value];
const highlightedConclusion = (value: string): string => escapeHtml(value).replace(
  /(\b(?:RESEARCH_MORE|READY_FOR_SOURCING|NOT_WORTH_PURSUING)\b|\d+(?:[.,]\d+)*(?:\/\d+)?(?:\s*(?:%|美元|条|个|项|份|名|个月|月|天))?)/gu,
  "<mark>$1</mark>",
);

export const generateLiveResearchReports = async (
  packagePath: string,
  evidencePackage: EvidencePackage,
  claims: ResearchClaim[],
  analysis: LiveResearchAnalysis,
  firstPrinciples?: FirstPrinciplesBundle,
): Promise<{ markdownPath: string; htmlPath: string; whiteboardHtmlPath: string }> => {
  const reportDir = path.join(packagePath, "reports");
  const markdownPath = path.join(reportDir, "decision-report.md");
  const htmlPath = path.join(reportDir, "analysis-report.html");
  const whiteboardHtmlPath = path.join(reportDir, "whiteboard-report.html");
  await mkdir(reportDir, { recursive: true });

  const sourceRows = evidencePackage.sources
    .map((source) => `| ${source.id} | ${source.sourceType} | ${source.title.replaceAll("|", "\\|")} | ${source.evidenceStatus} | ${source.url} |`)
    .join("\n");
  const scoreRows = (["demand", "competition", "trend", "monetization"] as const)
    .map((key) => {
      const score = analysis.marketOpportunity[key];
      return `| ${key} | ${score.score} | ${score.rationale.replaceAll("|", "\\|")} |`;
    })
    .join("\n");

  const recommendedOpportunity = firstPrinciples?.opportunity_hypotheses.find((item) => item.id === firstPrinciples.recommended_opportunity_id);
  const firstPrinciplesMarkdown = firstPrinciples
    ? `\n## 第一性原理机会重构

### 表面产品与真实问题
${firstPrinciples.problem_reframe.reframed_problem}

### 已知事实 / 假设 / 待验证
${list([
  ...firstPrinciples.fact_hypothesis_unknown.facts.map((item) => `FACT: ${item.statement}`),
  ...firstPrinciples.fact_hypothesis_unknown.hypotheses.map((item) => `HYPOTHESIS: ${item.statement}`),
  ...firstPrinciples.fact_hypothesis_unknown.unknowns.map((item) => `UNKNOWN: ${item.statement}`),
])}

### 原子需求
${list(firstPrinciples.demand_atoms.map((item) => `${item.user_segment} / ${item.scenario} / ${item.pain_or_job} -> ${item.desired_outcome}`))}

### 原子供给
${list(firstPrinciples.supply_atoms.map((item) => `${item.name} (${item.target_sku_verified ? "target SKU verified" : "candidate only"})`))}

### 主要约束
${list(Object.values(firstPrinciples.constraints).flat().map((item) => `${item.type}: ${item.statement} -> ${item.design_response}`))}

### 机会组合
${list(firstPrinciples.opportunity_hypotheses.map((item) => `${item.title}: ${item.score}/100`))}

### 推荐机会
**${recommendedOpportunity?.title ?? "No recommendation"}**

${firstPrinciples.recommendation_rationale}

### 为什么不推荐其他方向
${list(firstPrinciples.alternatives_not_recommended.map((item) => `${item.opportunity_id}: ${item.reason}`))}

### 7-14 天最低成本验证计划
${list(firstPrinciples.validation_plan.map((item) => `${item.test_type}, ${item.duration_days} days, cap ${item.budget_cap}, PASS ${item.pass_threshold}, FAIL ${item.fail_threshold}, STOP ${item.stop_condition}`))}

### 决策边界
- First-Principles: ${firstPrinciples.decision_summary.first_principles_recommendation}
- Product Selection: ${firstPrinciples.decision_summary.product_selection_decision}
- Formal SKU: ${firstPrinciples.decision_summary.formal_sku_decision}
- Listing: ${firstPrinciples.decision_summary.listing_allowed ? "YES" : "NO"}
- Ad Test: ${firstPrinciples.decision_summary.ad_test_allowed ? "YES" : "NO"}
`
    : "";
  const firstPrinciplesHtml = firstPrinciples
    ? `<h2>第一性原理机会重构</h2>
      <div class="section"><h3>表面产品与真实问题</h3><p>${escapeHtml(firstPrinciples.problem_reframe.reframed_problem)}</p>
      <h3>已知事实 / 假设 / 待验证</h3>${htmlList([
        ...firstPrinciples.fact_hypothesis_unknown.facts.map((item) => `FACT: ${item.statement}`),
        ...firstPrinciples.fact_hypothesis_unknown.hypotheses.map((item) => `HYPOTHESIS: ${item.statement}`),
        ...firstPrinciples.fact_hypothesis_unknown.unknowns.map((item) => `UNKNOWN: ${item.statement}`),
      ])}
      <h3>原子需求</h3>${htmlList(firstPrinciples.demand_atoms.map((item) => `${item.user_segment} / ${item.scenario} / ${item.pain_or_job} -> ${item.desired_outcome}`))}
      <h3>原子供给</h3>${htmlList(firstPrinciples.supply_atoms.map((item) => `${item.name} (${item.target_sku_verified ? "target SKU verified" : "candidate only"})`))}
      <h3>主要约束</h3>${htmlList(Object.values(firstPrinciples.constraints).flat().map((item) => `${item.type}: ${item.statement} -> ${item.design_response}`))}
      <h3>机会组合</h3>${htmlList(firstPrinciples.opportunity_hypotheses.map((item) => `${item.title}: ${item.score}/100`))}
      <h3>推荐机会</h3><p><strong>${escapeHtml(recommendedOpportunity?.title ?? "No recommendation")}</strong></p><p>${escapeHtml(firstPrinciples.recommendation_rationale)}</p>
      <h3>为什么不推荐其他方向</h3>${htmlList(firstPrinciples.alternatives_not_recommended.map((item) => `${item.opportunity_id}: ${item.reason}`))}
      <h3>7-14 天最低成本验证计划</h3>${htmlList(firstPrinciples.validation_plan.map((item) => `${item.test_type}, ${item.duration_days} days, cap ${item.budget_cap}, PASS ${item.pass_threshold}, FAIL ${item.fail_threshold}, STOP ${item.stop_condition}`))}
      <h3>决策边界</h3><p>First-Principles: ${escapeHtml(firstPrinciples.decision_summary.first_principles_recommendation)}<br>Product Selection: ${escapeHtml(firstPrinciples.decision_summary.product_selection_decision)}<br>Formal SKU: ${escapeHtml(firstPrinciples.decision_summary.formal_sku_decision)}<br>Listing: ${firstPrinciples.decision_summary.listing_allowed ? "YES" : "NO"}<br>Ad Test: ${firstPrinciples.decision_summary.ad_test_allowed ? "YES" : "NO"}</p></div>`
    : "";
  const translation = analysis.marketingTranslation;
  const marketingMarkdown = translation
    ? `
## 从商品机会到营销表达

> 当前状态：**${marketingStatusLabel(translation.status)}**。${translation.status === "ready_for_use" ? "相关权限已开放，最终渠道版本仍需留存审核记录。" : "Listing 或广告权限尚未全部开放，以下内容仅用于概念测试与 Claim 验证。"}

### 一句话价值主张

${translation.valueProposition}

### 产品卖点 → 用户利益 → 使用场景 → 情绪价值 → 营销话术

| 产品卖点 | 用户利益 | 使用场景 | 情绪价值 | 营销话术 | 证据状态 |
| --- | --- | --- | --- | --- | --- |
${translation.messagePillars.map((item) => `| ${item.productSellingPoint.replaceAll("|", "\\|")} | ${item.customerBenefit.replaceAll("|", "\\|")} | ${item.useScenario.replaceAll("|", "\\|")} | ${item.emotionalValue.replaceAll("|", "\\|")} | ${item.marketingCopy.replaceAll("|", "\\|")} | ${evidenceStatusLabel(item.evidenceStatus)} |`).join("\n")}

### 渠道表达

- Listing 标题（${marketingStatusLabel(translation.channelDrafts.listingTitle.status)}）：${translation.channelDrafts.listingTitle.text}
- 独立站首屏：${translation.channelDrafts.hero.headline} — ${translation.channelDrafts.hero.subheadline}
- 广告角度：
${list(translation.channelDrafts.adAngles.map((item) => `${item.text}（${evidenceStatusLabel(item.evidenceStatus)}）`))}
- 内容钩子：
${list(translation.channelDrafts.contentHooks.map((item) => `${item.text}（${evidenceStatusLabel(item.evidenceStatus)}）`))}

### 禁用 Claim

${list(translation.prohibitedClaims.map((item) => `${item.claim}：${item.reason}`))}

### 使用边界

${list(translation.usageBoundaries)}

### 营销验证闭环

${list(translation.validationExperiments.map((item) => `${item.name}｜假设：${item.keyHypothesis}｜指标：${item.metric}｜通过：${item.passThreshold}｜失败：${item.failThreshold}｜停止：${item.stopCondition}｜通过后：${item.nextIfPass}｜失败后：${item.nextIfFail}`))}
`
    : "";
  const marketingHtml = translation
    ? `<h2>从商品机会到营销表达</h2>
      <div class="section">
        <p><span class="tag">${escapeHtml(marketingStatusLabel(translation.status))}</span></p>
        <p>${translation.status === "ready_for_use" ? "相关权限已开放，最终渠道版本仍需留存审核记录。" : "Listing 或广告权限尚未全部开放，以下内容仅用于概念测试与 Claim 验证。"}</p>
        <h3>一句话价值主张</h3><p><strong>${escapeHtml(translation.valueProposition)}</strong></p>
        <h3>完整营销转译</h3>
        <div class="table-wrap"><table><thead><tr><th>产品卖点</th><th>用户利益</th><th>使用场景</th><th>情绪价值</th><th>营销话术</th><th>证据状态</th></tr></thead><tbody>
        ${translation.messagePillars.map((item) => `<tr><td>${escapeHtml(item.productSellingPoint)}</td><td>${escapeHtml(item.customerBenefit)}</td><td>${escapeHtml(item.useScenario)}</td><td>${escapeHtml(item.emotionalValue)}</td><td>${escapeHtml(item.marketingCopy)}</td><td>${escapeHtml(evidenceStatusLabel(item.evidenceStatus))}</td></tr>`).join("")}
        </tbody></table></div>
        <h3>渠道表达</h3><p><b>Listing：</b>${escapeHtml(translation.channelDrafts.listingTitle.text)}</p><p><b>独立站首屏：</b>${escapeHtml(translation.channelDrafts.hero.headline)} — ${escapeHtml(translation.channelDrafts.hero.subheadline)}</p>
        <div class="grid grid-2"><div><h3>广告角度</h3>${htmlList(translation.channelDrafts.adAngles.map((item) => item.text))}</div><div><h3>内容钩子</h3>${htmlList(translation.channelDrafts.contentHooks.map((item) => item.text))}</div></div>
        <h3>禁用 Claim</h3>${htmlList(translation.prohibitedClaims.map((item) => `${item.claim}：${item.reason}`))}
        <h3>为什么还不能上线</h3>${htmlList(translation.usageBoundaries)}
        <h3>验证计划</h3>${htmlList(translation.validationExperiments.map((item) => `${item.name}｜${item.metric}｜通过：${item.passThreshold}｜失败：${item.failThreshold}｜停止：${item.stopCondition}`))}
      </div>`
    : "";

  const markdown = `# ${evidencePackage.researchInput.productName} / ${evidencePackage.researchInput.targetMarket} Web Research

> 数据来源：真实公开网页。竞品与市场证据不得迁移为目标 SKU 已验证事实。

| 项目 | 结果 |
| --- | --- |
| Research Run | ${analysis.researchRunId} |
| 研究模式 | live / web-access |
| Product Decision | ${analysis.productDecision.status} |
| Market Opportunity Score | ${analysis.marketOpportunity.overall}/100 |
| 建议售价 | ${analysis.positioning.recommendedPriceRange} |
| Listing Allowed | ${analysis.actionBoundary.listingAllowed ? "YES" : "NO"} |
| Ad Test Allowed | ${analysis.actionBoundary.adTestAllowed ? "YES" : "NO"} |
| Source / Claim | ${evidencePackage.sources.length} / ${claims.length} |

## 市场有没有机会？

${analysis.marketOpportunity.verdict}

| 维度 | 分数 | 依据 |
| --- | ---: | --- |
${scoreRows}

## 竞品为什么能卖？

${list(analysis.competitorInsight.whyItSells)}

- 品牌定位：${analysis.competitorInsight.brandPositioning}
- 目标人群：${analysis.competitorInsight.targetAudience}
- 价格定位：${analysis.competitorInsight.pricePositioning}
- Bundle：${analysis.competitorInsight.bundleStrategy}
- 折扣：${analysis.competitorInsight.discountStrategy}
- Homepage messaging：${analysis.competitorInsight.homepageMessaging}
- CTA：${analysis.competitorInsight.cta}
- Social proof / Reviews / UGC：${analysis.competitorInsight.socialProof} / ${analysis.competitorInsight.reviews} / ${analysis.competitorInsight.ugc}

## 用户为什么买？

### 痛点
${list(analysis.customerInsight.painPoints)}

### 功能动机
${list(analysis.customerInsight.functionalMotives)}

### 情绪与社交动机
${list([...analysis.customerInsight.emotionalMotives, ...analysis.customerInsight.socialMotives])}

## 我应该卖什么？

- Target Customer：${analysis.positioning.targetCustomer}
- Price Range：${analysis.positioning.recommendedPriceRange}
- Core Selling Point：${analysis.positioning.coreSellingPoint}
- Differentiation：
${list(analysis.positioning.differentiation)}
${marketingMarkdown}

## 是否值得打样？

**${analysis.productDecision.status}**

${list(analysis.productDecision.rationale)}
${firstPrinciplesMarkdown}

## 动作边界

${analysis.actionBoundary.reason}

## 未知与待补证

${list(analysis.unknowns)}

## 真实来源

| Source ID | 类型 | 标题 | Confidence | URL |
| --- | --- | --- | --- | --- |
${sourceRows}
`;

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(evidencePackage.researchInput.productName)} Web Research</title>
  <style>
    :root{--bg:#fffefc;--panel:#fffefc;--text:#222222;--muted:rgba(34,34,34,.68);--line:#efeeeb;--green:#0f3e17;--lime:#e1f4df;--sage:#b1dbb8;--slate:#b6ced5;--amber:#8a5a00;--amber-bg:#fff4d6}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:1120px;margin:auto;padding:32px 24px 64px}h1,h2,h3{color:var(--green)}h1{font-size:30px;margin:0 0 8px}h2{font-size:20px;margin:30px 0 12px;border-bottom:1px solid var(--line);padding-bottom:8px}
    .meta{color:var(--muted);margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric,.section{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px}
    .metric span{display:block;color:var(--muted);font-size:12px}.metric strong{font-size:22px}.decision{background:var(--amber-bg);color:var(--amber);border:1px solid rgba(138,90,0,.24)}
    table{width:100%;border-collapse:collapse;background:var(--panel)}th,td{border:1px solid var(--line);padding:9px;text-align:left;vertical-align:top}th{background:var(--slate)}a{color:var(--green);overflow-wrap:anywhere}
    .tag{display:inline-block;background:var(--lime);color:var(--green);padding:3px 8px;border-radius:4px;font-weight:700}.table-wrap{overflow-x:auto}.grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}ul{padding-left:20px}@media(max-width:760px){.grid,.grid-2{grid-template-columns:1fr}main{padding:20px 14px}}
  </style>
</head>
<body><main>
  <span class="tag">LIVE WEB RESEARCH</span>
  <h1>${escapeHtml(evidencePackage.researchInput.productName)}</h1>
  <p class="meta">${escapeHtml(evidencePackage.researchInput.targetMarket)} · ${escapeHtml(analysis.researchRunId)} · ${escapeHtml(analysis.generatedAt)}</p>
  <div class="grid">
    <div class="metric decision"><span>Product Decision</span><strong>${escapeHtml(analysis.productDecision.status)}</strong></div>
    <div class="metric"><span>Market Opportunity</span><strong>${analysis.marketOpportunity.overall}/100</strong></div>
    <div class="metric"><span>Price Range</span><strong>${escapeHtml(analysis.positioning.recommendedPriceRange)}</strong></div>
    <div class="metric"><span>Evidence</span><strong>${evidencePackage.sources.length} / ${claims.length}</strong></div>
  </div>
  <h2>市场有没有机会？</h2><div class="section"><p>${escapeHtml(analysis.marketOpportunity.verdict)}</p></div>
  <h2>竞品为什么能卖？</h2><div class="section">${htmlList(analysis.competitorInsight.whyItSells)}</div>
  <h2>我应该卖什么？</h2><div class="section"><p><b>Target Customer：</b>${escapeHtml(analysis.positioning.targetCustomer)}</p><p><b>Core Selling Point：</b>${escapeHtml(analysis.positioning.coreSellingPoint)}</p>${htmlList(analysis.positioning.differentiation)}</div>
  ${marketingHtml}
  <h2>是否值得打样？</h2><div class="section decision"><strong>${escapeHtml(analysis.productDecision.status)}</strong>${htmlList(analysis.productDecision.rationale)}<p>${escapeHtml(analysis.actionBoundary.reason)}</p></div>
  ${firstPrinciplesHtml}
  <h2>未知与待补证</h2><div class="section">${htmlList(analysis.unknowns)}</div>
  <h2>真实来源</h2><table><thead><tr><th>ID</th><th>类型</th><th>标题</th><th>Confidence</th><th>URL</th></tr></thead><tbody>
  ${evidencePackage.sources.map((source) => `<tr><td>${escapeHtml(source.id)}</td><td>${escapeHtml(source.sourceType)}</td><td>${escapeHtml(source.title)}</td><td>${escapeHtml(source.evidenceStatus)}</td><td><a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a></td></tr>`).join("")}
  </tbody></table>
</main></body></html>`;

  const reportModules = buildWhiteboardReportModules(analysis, claims);
  const searchLog = await readSearchLog(packagePath);
  const sourceIndex = new Map(evidencePackage.sources.map((source) => [source.id, source]));
  const scoreSources: ResearchWhiteboardSource[] = evidencePackage.sources.map((source) => ({
    id: source.id,
    label: source.title,
    url: source.url,
    kind: /reddit\.com|walmart\.com\/reviews/i.test(source.url) ? "community" : ({ market: "market", competitor: "competitor", supplier: "supplier", regulation: "official", other: "other" } as const)[source.sourceType],
    status: source.accessStatus === "blocked" || source.accessStatus === "unavailable" ? "blocked" : source.evidenceStatus === "verified" ? "verified" : "candidate",
  }));
  const scorecard = buildReportScorecard(reportModules, scoreSources);
  const levelLabel = { fact: "事实证据", directional: "方向性证据", hypothesis: "待验证假设", unknown: "未知 / 缺口" } as const;
  const sourceKindLabel = { market: "市场数据", community: "用户社区", competitor: "竞品页面", supplier: "供应信息", official: "官方资料", other: "其他信源" } as const;
  const marketSignalCount = scoreSources.filter((source) => ["market", "competitor", "official"].includes(source.kind)).length;
  const redditDiscussionCount = scoreSources.filter((source) => /reddit\.com/i.test(source.url)).length;
  const trendsUrl = `https://trends.google.com/trends/explore?geo=${encodeURIComponent(evidencePackage.researchInput.targetMarket)}&q=${encodeURIComponent(evidencePackage.researchInput.productName)}`;
  const moduleSlides = reportModules.map((reportModule, index) => {
    const activeSourceIds = new Set(reportModule.items.flatMap((item) => item.sourceIds));
    const activeSourceCount = activeSourceIds.size;
    const coverage = (Object.keys(sourceKindLabel) as ResearchWhiteboardSource["kind"][])
      .map((kind) => ({ kind, label: sourceKindLabel[kind], count: scoreSources.filter((source) => source.kind === kind && activeSourceIds.has(source.id)).length }))
      .filter((item) => item.count > 0);
    const maximumCoverage = Math.max(1, ...coverage.map((item) => item.count));
    const coverageHtml = coverage.length > 0
      ? coverage.map((item) => `<p><b>${escapeHtml(item.label)}</b><i><span style="width:${Math.max(12, item.count / maximumCoverage * 100)}%"></span></i><strong>${item.count}</strong></p>`).join("")
      : `<p class="empty">当前模块还没有可回溯信源。</p>`;
    const actionGate = reportModule.items.find((item) => item.text.startsWith("行动验收："));
    const vocUnitLabel = ({ discussion_thread: "讨论线程", review: "评论", response: "回复", mixed: "混合记录" } as const)[reportModule.voc?.unit ?? "mixed"];
    const maximumVocChannel = Math.max(1, ...(reportModule.voc?.channels.map((item) => item.count) ?? []));
    const maximumVocTheme = Math.max(1, ...(reportModule.voc?.themes.map((item) => item.count) ?? []));
    const vocHtml = reportModule.voc ? `<section class="voc"><header><div><span>STRUCTURED VOC</span><h4>用户声音覆盖</h4></div><p><b>${reportModule.voc.totalRecords}</b> 个${vocUnitLabel} · <b>${reportModule.voc.channels.length}</b> 个渠道</p></header><div class="voc-grid"><article><h5>渠道覆盖</h5>${reportModule.voc.channels.map((item) => `<p class="voc-bar"><b>${escapeHtml(item.label)}</b><i><span style="width:${Math.max(10, item.count / maximumVocChannel * 100)}%"></span></i><strong>${item.count}</strong></p>`).join("")}</article><article><h5>主题证据 <small>允许多标签</small></h5>${reportModule.voc.themes.map((item) => `<p class="voc-bar"><b>${escapeHtml(item.label)}</b><i><span style="width:${Math.max(10, item.count / maximumVocTheme * 100)}%"></span></i><strong>${item.count}</strong></p>`).join("")}</article><article><h5>触发场景</h5><div class="voc-scenes">${reportModule.voc.scenarios.map((item) => `<span>${escapeHtml(item.label)} <b>${item.count}/${reportModule.voc?.totalRecords}</b></span>`).join("")}</div></article><article><h5>情绪编码</h5><div class="voc-scenes">${reportModule.voc.sentiments.map((item) => `<span>${escapeHtml(item.label)} <b>${item.count}</b></span>`).join("")}</div><p class="voc-warning">${reportModule.voc.sentiments.every((item) => item.key === "unknown") ? "本轮没有逐条情绪标注，禁止推断满意度。" : "比例只描述当前样本，不代表市场总体。"}</p></article></div><p class="voc-boundary"><b>样本边界</b>${escapeHtml(reportModule.voc.sampleBoundary)}</p><div class="voc-gaps"><b>覆盖缺口</b>${reportModule.voc.gaps.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></section>` : "";
    const conclusionParts = splitConclusion(reportModule.conclusion);
    const conclusionHtml = `<section class="conclusion"><span>核心判断</span><strong>${highlightedConclusion(conclusionParts[0] ?? "")}</strong>${conclusionParts.length > 1 ? `<ol>${conclusionParts.slice(1).map((part, partIndex) => `<li><i>${String(partIndex + 1).padStart(2, "0")}</i><p>${highlightedConclusion(part)}</p></li>`).join("")}</ol>` : ""}</section>`;
    const moduleJudgment = ({
      market: reportModule.conclusion.includes("RESEARCH_MORE") ? "值得保留，继续补证" : "需求与竞争已形成判断",
      customer: "人群与任务明确，规模待验证",
      competitor: "转化链清楚，真实经营数据未知",
      product: reportModule.conclusion.includes("READY_FOR_SOURCING") ? "可进入受控寻源" : "继续补证，暂不买样",
      marketing: reportModule.unknowns.length > 0 ? "仅限概念素材测试" : "可进入素材验证",
      validation: reportModule.unknowns.length > 0 ? "先过验证闸门" : "可进入受控验证",
    } as const)[reportModule.code];
    const metrics = reportModule.code === "market"
      ? [["公开市场信源", `${marketSignalCount} 个`], ["市场机会分", `${analysis.marketOpportunity.overall} / 100`], ["观察价格带", analysis.competitorInsight.pricePositioning], ["用户讨论来源", `Reddit ${redditDiscussionCount}`], ["当前决策", analysis.productDecision.status]]
      : [["证据条目", `${reportModule.items.length} 条`], ["引用信源", `${activeSourceCount} 个`], ["待补证", `${reportModule.unknowns.length} 项`], ["当前判断", moduleJudgment]];
    const sideNote = reportModule.code === "market"
      ? analysis.marketOpportunity.verdict
      : "核心结论来自当前 Research Run。每条证据均保留来源链接和证据等级，可直接向下核查。";
    const marketCharts = "";
    const evidenceItems = reportModule.items.map((item) => `<article class="evidence-row"><b class="level-${item.level}">${levelLabel[item.level]}</b><span>${escapeHtml(item.text)}</span>${item.sourceIds.length ? `<details><summary>查看 ${item.sourceIds.length} 个信源</summary><div class="source-list">${item.sourceIds.map((id) => { const source = sourceIndex.get(id); return source ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(source.title)}</strong><small>${escapeHtml(source.url)}</small></a>` : `<span>${escapeHtml(id)}</span>`; }).join("")}</div></details>` : ""}</article>`).join("");
    return `<article class="report-slide${index === 0 ? " active" : ""}" data-report-slide="${index}" id="report-${escapeHtml(reportModule.code)}">
      <div class="slide-topline"><span>MODULE ${String(index + 1).padStart(2, "0")}</span><b>${escapeHtml(reportModule.question)}</b></div>
      <div class="slide-grid"><div class="main-copy"><h3>${escapeHtml(reportModule.title)}</h3>${conclusionHtml}<div class="metrics">${metrics.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></div>`).join("")}</div></div><aside><span>本页判断</span><strong>${escapeHtml(moduleJudgment)}</strong><p>${escapeHtml(sideNote)}</p>${reportModule.code === "market" ? `<a href="${escapeHtml(trendsUrl)}" target="_blank" rel="noreferrer">打开 Google Trends 核对 ↗</a>` : ""}</aside></div>
      ${vocHtml}<section class="insight-grid"><article class="coverage"><header><span>本页证据覆盖</span><small>只统计本模块实际引用信源</small></header><div>${coverageHtml}</div></article><article class="action-gate"><header><span>行动验收</span><small>待验证假设，不代表已经通过</small></header><strong>${escapeHtml(actionGate?.text.replace(/^行动验收：/u, "") ?? "先补齐本模块关键证据，再决定是否升级商业状态。")}</strong><p><b>不升级条件</b>${escapeHtml(reportModule.unknowns[0] ?? "无法回溯到当前 Run 的结论不进入下一阶段。")}</p></article></section>
      ${marketCharts}<div class="evidence-title"><span>证据与行动</span><small>${reportModule.items.length} 条证据 · ${reportModule.unknowns.length} 项缺口</small></div><div class="evidence-list">${evidenceItems}</div>
      ${reportModule.unknowns.length ? `<div class="gaps"><b>仍需补证</b>${reportModule.unknowns.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      <div class="slide-controls"><button type="button" data-prev ${index === 0 ? "disabled" : ""}>上一页</button><span>${index + 1} / ${reportModules.length}</span><button type="button" data-next ${index === reportModules.length - 1 ? "disabled" : ""}>下一页</button></div>
    </article>`;
  }).join("");
  const whiteboardHtml = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(evidencePackage.researchInput.productName)} · 选品猫决策白板</title>
<style>
.voc{margin-bottom:24px;border:1px solid var(--ink);background:#f8f5ff}.voc>header{display:flex;align-items:end;justify-content:space-between;gap:18px;padding:13px 15px;background:#171421;color:#fff}.voc>header span{color:#cdbbff;font:800 10px/1 ui-monospace,monospace}.voc>header h4{margin:6px 0 0;font-size:20px}.voc>header p{margin:0}.voc>header p b{color:var(--lime);font-size:17px}.voc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;padding:1px;background:#d8d1e5}.voc-grid article{padding:14px;background:#fff}.voc-grid h5{margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid #e7e1ef;font-size:13px}.voc-grid h5 small{float:right;color:#777080;font-weight:400}.voc-bar{display:grid;grid-template-columns:132px minmax(70px,1fr) 28px;gap:8px;align-items:center;margin:8px 0}.voc-bar b{overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.voc-bar i{display:block;height:8px;background:#ece8f2}.voc-bar i span{display:block;height:100%;background:#8068c8}.voc-bar strong{font:800 11px/1 ui-monospace,monospace;text-align:right}.voc-scenes{display:flex;flex-wrap:wrap;gap:7px}.voc-scenes span{padding:6px 8px;border:1px solid #d9d0e7;border-radius:999px;background:#f8f5ff;font-size:11px}.voc-warning{color:#785b00;font-size:11px}.voc-boundary{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:9px;margin:0;padding:11px 14px;border-top:1px solid #d8d1e5;color:#51485c;font-size:11px}.voc-gaps{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 12px}.voc-gaps>b{color:#8e3328;font-size:11px}.voc-gaps span{padding:3px 6px;background:#fff0ec;color:#7a4238;font-size:10px}@media(max-width:800px){.voc>header{align-items:flex-start;flex-direction:column}.voc-grid{grid-template-columns:1fr}.voc-bar{grid-template-columns:108px minmax(60px,1fr) 28px}}
</style>
<style>
:root{--ink:#111;--paper:#fafaf7;--lime:#efff72;--orange:#ff5b29;--line:#b8b8b0}*{box-sizing:border-box}body{margin:0;background-color:var(--paper);background-image:radial-gradient(#d2d2ca 1px,transparent 1px);background-size:18px 18px;color:var(--ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1440px;margin:auto;padding:30px}.hero{padding:26px;border:1px solid var(--ink);border-radius:16px 16px 0 0;background:#111;color:#fff}.hero span,.eyebrow{color:var(--lime);font:800 10px/1 ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em}.hero h1{margin:12px 0 7px;font-size:clamp(30px,5vw,58px);line-height:1}.hero p{max-width:900px;margin:0;color:#bbb}.basis{border:1px solid #111;border-top:0;background:#fff}.basis>header{display:flex;justify-content:space-between;gap:12px;padding:9px 12px;background:#111;color:#fff}.basis>header span{color:var(--lime);font:800 10px/1 ui-monospace,monospace}.basis>header b{font-size:11px}.scope{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1px;padding:1px;background:#d7d9d4}.scope div{padding:12px;background:#fff}.scope small{display:block;color:#777}.scope b{overflow-wrap:anywhere}.flow{display:grid;grid-template-columns:repeat(5,minmax(190px,1fr));gap:12px;padding:20px;border:1px solid #111;border-top:0;overflow-x:auto}.flow article{position:relative;padding:14px;border:1px solid #111;border-radius:9px;background:#fff}.flow article:not(:last-child):after{content:'→';position:absolute;right:-21px;top:50%;z-index:2;display:grid;place-items:center;width:28px;height:28px;border:1px solid #111;border-radius:50%;background:var(--lime);font-weight:900}.flow h2{margin:8px 0 5px;font-size:17px}.flow p{margin:0;color:#666;font-size:11px}.report{padding:22px;border:1px solid #111;border-top:0;background:#f4f4ef}.report>header h2{margin:8px 0 4px;font-size:28px}.report>header p{margin:0 0 16px;color:#666}.report-tabs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border:1px solid var(--ink);background:#fff}.report-tabs button{display:grid;gap:7px;min-height:68px;padding:12px 10px;border:0;border-right:1px solid #d7d9d4;background:#fff;color:#5f6570;cursor:pointer;text-align:left;font-size:14px;font-weight:800}.report-tabs button:last-child{border-right:0}.report-tabs button span{color:var(--orange);font:800 11px/1 ui-monospace,monospace}.report-tabs button.active{background:var(--ink);color:#fff}.report-tabs button.active span{color:var(--lime)}.scorecard{border:1px solid var(--ink);border-top:0;background:#f4f4ef}.scorecard summary{display:flex;align-items:center;gap:14px;padding:12px 16px;cursor:pointer;list-style:none}.scorecard summary::-webkit-details-marker{display:none}.scorecard summary b{color:var(--orange);font:900 18px/1 ui-monospace,monospace}.scorecard summary button{padding:5px 9px;border:1px solid #9ea49b;border-radius:999px;background:#fff;cursor:pointer;font-size:11px;font-weight:800}.scorecard summary em{margin-left:auto;padding:4px 8px;border-radius:999px;background:var(--lime);font-size:11px;font-style:normal;font-weight:900}.score-explainer{display:grid;grid-template-columns:1.5fr 1fr;gap:1px;border-top:1px solid var(--ink);background:#d4d6cf}.score-explainer div{padding:13px 16px;background:#fff}.score-explainer span{color:var(--orange);font:800 10px/1 ui-monospace,monospace}.score-explainer p{margin:7px 0 0;color:#4d5561;font-size:12px}.scoregrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;border-top:1px solid var(--ink);background:#d4d6cf}.scoregrid div{display:grid;grid-template-columns:1fr auto;gap:5px 10px;padding:12px;background:#fff}.scoregrid small{display:grid;grid-column:1/-1;grid-template-columns:58px minmax(0,1fr);gap:7px;padding-top:6px;border-top:1px solid #eceee8;color:#737983;font-size:10px}.scoregrid small strong{color:#343b44}.scoregrid small.missing{color:#8a4a37}.scoregrid small.complete{color:#3d6b39}.scorecard>p{margin:0;padding:11px 16px;border-top:1px solid #d4d6cf}.report-slide{display:none;min-height:520px;padding:24px;border:1px solid var(--ink);border-top:0;background:#fff}.report-slide.active{display:block}.slide-topline{display:flex;align-items:baseline;justify-content:space-between;gap:18px;padding-bottom:12px;border-bottom:1px solid #ddd;color:#727984}.slide-topline span{color:var(--orange);font:800 11px/1 ui-monospace,monospace}.slide-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(240px,.55fr);gap:28px;padding:28px 0 24px}.main-copy h3{margin:0 0 14px;font-size:34px;letter-spacing:-.04em}.conclusion{max-width:780px;overflow:hidden;border:1px solid #d7dad3;border-left:5px solid var(--orange);background:#fafaf6}.conclusion>span{display:block;padding:10px 16px 8px;border-bottom:1px solid #e2e4de;color:#727984;font:800 11px/1 ui-monospace,monospace}.conclusion>strong{display:block;padding:15px 16px;font-size:20px;line-height:1.55}.conclusion mark{display:inline-block;margin:0 2px;padding:1px 5px;border-radius:3px;background:var(--lime);font-weight:850}.conclusion ol{margin:0;padding:0;border-top:1px solid #e2e4de;list-style:none}.conclusion li{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;padding:12px 16px;border-bottom:1px solid #e8e9e4}.conclusion li:last-child{border-bottom:0}.conclusion li i{display:grid;place-items:center;width:27px;height:22px;border-radius:999px;background:#eceee8;font:800 10px/1 ui-monospace,monospace;font-style:normal}.conclusion li p{margin:0;color:#3d4550;font-size:15px;line-height:1.72}.metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:22px}.metrics div{min-height:74px;padding:11px;border-top:3px solid var(--orange);background:#f3f4ef}.metrics small{display:block;color:#737984;font-size:11px}.metrics b{display:block;margin-top:5px;font-size:15px;line-height:1.35}.slide-grid aside{align-self:start;padding:17px;border:1px solid #d2d5ce;background:#f6f7f1}.slide-grid aside>span{color:var(--orange);font:800 11px/1 ui-monospace,monospace}.slide-grid aside>strong{display:block;margin-top:10px}.slide-grid aside p{color:#444b55}.slide-grid aside a{color:#1e55b7;font-weight:800}.insight-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:10px;margin-bottom:24px}.insight-grid article{padding:15px;border:1px solid #d4d7d0;background:#fff}.insight-grid header{display:flex;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid #e1e3dd}.insight-grid header span{font-weight:900}.insight-grid header small{color:#747b84;font-size:10px}.coverage>div{display:grid;gap:9px;margin-top:12px}.coverage p{display:grid;grid-template-columns:76px minmax(80px,1fr) 24px;gap:9px;align-items:center;margin:0}.coverage p b{font-size:11px}.coverage p i{display:block;height:8px;background:#e8eae5}.coverage p i span{display:block;height:100%;background:#315fca}.coverage p strong{font:800 11px/1 ui-monospace,monospace;text-align:right}.coverage p.empty{display:block;color:#747b84}.action-gate{border-top:4px solid #e3a928!important;background:#fffdf3!important}.action-gate>strong{display:block;margin-top:12px;line-height:1.65}.action-gate>p{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px;margin:12px 0 0;padding-top:10px;border-top:1px solid #eadfb9;color:#765e24;font-size:12px}.action-gate>p b{color:#8b3d2c}.visual-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr);gap:10px;margin-bottom:22px}.chart-card{padding:16px;border:1px solid #d2d5ce;background:#f6f7f1}.chart-card header{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px}.chart-card header span{font-weight:900}.chart-card header small,.chart-note{color:#737984;font-size:11px}.bars{display:grid;gap:10px}.bar-row{display:grid;grid-template-columns:120px minmax(0,1fr) max-content;align-items:center;gap:9px;font-size:12px}.bar-row i{display:block;height:12px;background:#e1e4dc}.bar-row i b{display:block;height:100%;background:var(--orange)}.bar-row strong{font:800 11px/1 ui-monospace,monospace}.chart-note{display:block;margin-top:13px}.evidence-title{display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid var(--ink)}.evidence-title span{font-size:15px;font-weight:900}.evidence-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.evidence-row{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 10px;min-height:108px;padding:12px 13px;border-left:3px solid #d9dcd5;background:#f5f5f1}.evidence-row>b{padding:4px 6px;border-radius:3px;font:800 10px/1 ui-monospace,monospace}.evidence-row>span{font-weight:650}.level-fact{background:#dff1d2;color:#275b1a}.level-directional{background:#e2edf1;color:#264d5d}.level-hypothesis{background:#fff0bf;color:#785b00}.level-unknown{background:#f3ded8;color:#8e3328}.evidence-row details{grid-column:2}.evidence-row summary{cursor:pointer;color:#315f6c;font-weight:800}.source-list{display:grid;gap:5px;margin-top:7px}.source-list a{display:grid;padding:7px;background:#fff;color:#315f6c;text-decoration:none}.source-list small{overflow-wrap:anywhere}.gaps{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}.gaps b{color:#a23d2b}.gaps span{padding:4px 7px;background:#fff0ec;color:#7a4238;font-size:12px}.slide-controls{display:flex;justify-content:center;align-items:center;gap:18px;margin-top:24px}.slide-controls button{padding:7px 12px;border:1px solid #c4c8c0;background:#fff;cursor:pointer}.slide-controls button:disabled{opacity:.4}.audit{padding:22px;border:1px solid #111;border-top:0;border-radius:0 0 16px 16px;background:#fff}.audit table{width:100%;border-collapse:collapse}.audit th,.audit td{padding:9px;border:1px solid #ccc;text-align:left;vertical-align:top}.audit a{color:#315f6c;overflow-wrap:anywhere}@media(max-width:800px){main{padding:12px}.scope,.scoregrid,.score-explainer{grid-template-columns:1fr}.basis>header{flex-direction:column}.flow{grid-template-columns:1fr;overflow:visible}.flow article:not(:last-child):after{content:'↓';position:static;margin:12px auto -28px}.report-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.slide-grid,.visual-grid,.evidence-list,.insight-grid{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.audit{overflow-x:auto}}
</style></head><body><main>
<section class="hero"><span>TRACEABLE SELECTION REPORT</span><h1>${escapeHtml(evidencePackage.researchInput.productName)}</h1><p>先看六大选品结论；展开每张卡片即可核对证据等级、来源和仍需补证的事项。</p></section>
<section class="basis"><header><span>RESEARCH BASIS</span><b>所有数字仅限本次 Research Run</b></header><div class="scope"><div><small>研究对象</small><b>${escapeHtml(evidencePackage.researchInput.productName)}</b></div><div><small>目标市场</small><b>${escapeHtml(evidencePackage.researchInput.targetMarket)}</b></div><div><small>Research Run</small><b>${escapeHtml(analysis.researchRunId)}</b></div><div><small>本轮检索</small><b>${searchLog.totals.total} 条</b></div><div><small>保留信源</small><b>${evidencePackage.sources.length} 个</b></div><div><small>已核验</small><b>${scoreSources.filter((source) => source.status === "verified").length} 个</b></div><div><small>来源类型</small><b>${new Set(scoreSources.map((source) => source.kind)).size} 类</b></div><div><small>原子判断</small><b>${claims.length} 条</b></div><div><small>报告快照</small><b>${escapeHtml(analysis.generatedAt)}</b></div></div></section>
<section class="flow">${["研究对象确认", "数据来源", "Agent 采集记录", "整理分析", "六大报告与执行"].map((title, index) => `<article><span class="eyebrow">0${index + 1}</span><h2>${title}</h2><p>${["锁定商品、市场与边界", "市场、用户、竞品、供应、合规", "保留查询、时间、去重和有效记录", "形成价格、趋势、画像、竞争与缺口", "结论、产品、营销、验证与证据回流"][index]}</p></article>`).join("")}</section>
<section class="report"><header><span class="eyebrow" style="color:var(--orange)">SELECTION DECISIONS</span><h2>六大选品结论</h2><p>像翻一份选品演示稿一样查看六个模块；每页保留指标、证据、来源和待验证缺口。</p></header>
<nav class="report-tabs" aria-label="六大选品报告导航">${reportModules.map((reportModule, index) => `<button type="button" data-module-index="${index}" class="${index === 0 ? "active" : ""}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(reportModule.title)}</button>`).join("")}</nav>
<details class="scorecard"><summary><span>报告自评</span><b>${scorecard.total} / 100</b><button type="button">查看评分依据与满分缺口</button><em>${escapeHtml(scorecard.grade)}</em></summary><div class="score-explainer"><div><span>计算公式</span><p>${escapeHtml(scorecard.formula)}</p></div><div><span>距离满分</span><p>当前还差 <b>${scorecard.missingPoints} 分</b>。以下每个维度均列出计分规则、当前依据和满分所需信息。</p></div></div><div class="scoregrid">${scorecard.dimensions.map((item) => `<div><span>${escapeHtml(item.label)}</span><b>${item.score} / ${item.weight}</b><small><strong>当前依据</strong>${escapeHtml(item.note)}</small><small><strong>计分规则</strong>${escapeHtml(item.rule)}</small><small><strong>满分条件</strong>${escapeHtml(item.fullScoreRequirement)}</small><small class="${item.score >= item.weight ? "complete" : "missing"}"><strong>${item.score >= item.weight ? "当前状态" : `还差 ${item.weight - item.score} 分`}</strong>${escapeHtml(item.missingToFull)}</small></div>`).join("")}</div><p><b>当前最高优先级：</b>${escapeHtml(scorecard.priority)}</p></details>
${moduleSlides}</section>
<section class="audit"><details><summary><b>完整来源审计（${evidencePackage.sources.length}）</b></summary><table><thead><tr><th>ID</th><th>类型</th><th>状态</th><th>来源</th></tr></thead><tbody>${evidencePackage.sources.map((source) => `<tr><td>${escapeHtml(source.id)}</td><td>${escapeHtml(source.sourceType)}</td><td>${escapeHtml(source.evidenceStatus)}</td><td><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a></td></tr>`).join("")}</tbody></table></details></section>
</main><script>(()=>{const tabs=[...document.querySelectorAll('[data-module-index]')];const slides=[...document.querySelectorAll('[data-report-slide]')];let active=0;const show=(index)=>{active=Math.max(0,Math.min(slides.length-1,index));tabs.forEach((tab,i)=>tab.classList.toggle('active',i===active));slides.forEach((slide,i)=>slide.classList.toggle('active',i===active));history.replaceState(null,'','#module-'+String(active+1).padStart(2,'0'));};tabs.forEach((tab,i)=>tab.addEventListener('click',()=>show(i)));slides.forEach((slide,i)=>{slide.querySelector('[data-prev]')?.addEventListener('click',()=>show(i-1));slide.querySelector('[data-next]')?.addEventListener('click',()=>show(i+1));});const hash=Number(location.hash.replace('#module-',''));show(Number.isFinite(hash)&&hash>0?hash-1:0);})();</script></body></html>`;

  await Promise.all([
    writeFile(markdownPath, markdown, "utf8"),
    writeFile(htmlPath, html, "utf8"),
    writeFile(whiteboardHtmlPath, whiteboardHtml, "utf8"),
  ]);
  return { markdownPath, htmlPath, whiteboardHtmlPath };
};
