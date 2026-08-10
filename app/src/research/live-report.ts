import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LiveResearchAnalysis, ResearchClaim } from "./live-types";
import type { EvidencePackage } from "./types";
import type { FirstPrinciplesBundle } from "../first-principles/types";
import { buildWhiteboardReportModules } from "../research-whiteboard/service";

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
  const sourceIndex = new Map(evidencePackage.sources.map((source) => [source.id, source]));
  const levelLabel = { fact: "事实证据", directional: "方向性证据", hypothesis: "待验证假设", unknown: "未知 / 缺口" } as const;
  const whiteboardHtml = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(evidencePackage.researchInput.productName)} · 选品猫决策白板</title>
<style>
:root{--ink:#111;--paper:#fafaf7;--lime:#efff72;--orange:#ff5b29;--line:#b8b8b0}*{box-sizing:border-box}body{margin:0;background-color:var(--paper);background-image:radial-gradient(#d2d2ca 1px,transparent 1px);background-size:18px 18px;color:var(--ink);font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1440px;margin:auto;padding:30px}.hero{padding:26px;border:1px solid var(--ink);border-radius:16px 16px 0 0;background:#111;color:#fff}.hero span,.eyebrow{color:var(--lime);font:800 10px/1 ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em}.hero h1{margin:12px 0 7px;font-size:clamp(30px,5vw,58px);line-height:1}.hero p{max-width:900px;margin:0;color:#bbb}.scope{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;padding:1px;background:#111}.scope div{padding:12px;background:#fff}.scope small{display:block;color:#777}.scope b{overflow-wrap:anywhere}.flow{display:grid;grid-template-columns:repeat(5,minmax(190px,1fr));gap:12px;padding:20px;border:1px solid #111;border-top:0;overflow-x:auto}.flow article{position:relative;padding:14px;border:1px solid #111;border-radius:9px;background:#fff}.flow article:not(:last-child):after{content:'→';position:absolute;right:-21px;top:50%;z-index:2;display:grid;place-items:center;width:28px;height:28px;border:1px solid #111;border-radius:50%;background:var(--lime);font-weight:900}.flow h2{margin:8px 0 5px;font-size:17px}.flow p{margin:0;color:#666;font-size:11px}.report{padding:22px;border:1px solid #111;border-top:0;background:#f4f4ef}.report>header h2{margin:8px 0 4px;font-size:28px}.report>header p{margin:0 0 16px;color:#666}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.module{padding:18px;border:1px solid #111;border-radius:11px;background:#fff}.module header{display:grid;grid-template-columns:36px 1fr;gap:10px}.num{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--lime);font:900 11px/1 ui-monospace,monospace}.module h3{margin:0;font-size:19px}.module header p{margin:3px 0 0;color:#777;font-size:11px}.conclusion{margin:15px 0;font-size:14px;font-weight:800}.module details{border-top:1px solid #ddd;padding-top:10px}.module summary{cursor:pointer;font-weight:800}.items{display:grid;gap:8px;padding:0;list-style:none}.items li{display:grid;gap:5px;padding:10px;background:#f4f4ef}.tag{width:max-content;padding:3px 6px;border-radius:3px;background:#ddd;font:800 8px/1 ui-monospace,monospace}.fact{background:#dff1d2;color:#275b1a}.directional{background:#e2edf1;color:#264d5d}.hypothesis{background:#fff0bf;color:#785b00}.unknown{background:#f3ded8;color:#8e3328}.source-links{font-size:10px}.source-links a{color:#315f6c;overflow-wrap:anywhere}.gaps{padding:10px;border:1px dashed #a73729;background:#fff5f2}.audit{padding:22px;border:1px solid #111;border-top:0;border-radius:0 0 16px 16px;background:#fff}.audit table{width:100%;border-collapse:collapse}.audit th,.audit td{padding:9px;border:1px solid #ccc;text-align:left;vertical-align:top}.audit a{color:#315f6c;overflow-wrap:anywhere}@media(max-width:800px){main{padding:12px}.scope,.grid{grid-template-columns:1fr}.flow{grid-template-columns:1fr;overflow:visible}.flow article:not(:last-child):after{content:'↓';position:static;margin:12px auto -28px}.audit{overflow-x:auto}}
</style></head><body><main>
<section class="hero"><span>TRACEABLE SELECTION REPORT</span><h1>${escapeHtml(evidencePackage.researchInput.productName)}</h1><p>先看六大选品结论；展开每张卡片即可核对证据等级、来源和仍需补证的事项。</p></section>
<section class="scope"><div><small>目标市场</small><b>${escapeHtml(evidencePackage.researchInput.targetMarket)}</b></div><div><small>Research Run</small><b>${escapeHtml(analysis.researchRunId)}</b></div><div><small>来源</small><b>${evidencePackage.sources.length} 个</b></div><div><small>原子判断</small><b>${claims.length} 条</b></div></section>
<section class="flow">${["研究对象确认", "数据来源", "Agent 采集记录", "整理分析", "六大报告与执行"].map((title, index) => `<article><span class="eyebrow">0${index + 1}</span><h2>${title}</h2><p>${["锁定商品、市场与边界", "市场、用户、竞品、供应、合规", "保留查询、时间、去重和有效记录", "形成价格、趋势、画像、竞争与缺口", "结论、产品、营销、验证与证据回流"][index]}</p></article>`).join("")}</section>
<section class="report"><header><span class="eyebrow" style="color:var(--orange)">SELECTION DECISIONS</span><h2>六大选品结论</h2><p>结论默认可见，研究过程和审计细节按需展开。</p></header><div class="grid">
${reportModules.map((reportModule, index) => `<article class="module"><header><span class="num">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(reportModule.title)}</h3><p>${escapeHtml(reportModule.question)}</p></div></header><p class="conclusion">${escapeHtml(reportModule.conclusion)}</p><details><summary>展开证据与缺口</summary><ul class="items">${reportModule.items.map((item) => `<li><span class="tag ${item.level}">${levelLabel[item.level]}</span><span>${escapeHtml(item.text)}</span>${item.sourceIds.length ? `<span class="source-links">${item.sourceIds.map((id) => { const source = sourceIndex.get(id); return source ? `<a href="${escapeHtml(source.url)}">${escapeHtml(id)}</a>` : escapeHtml(id); }).join(" · ")}</span>` : ""}</li>`).join("")}</ul>${reportModule.unknowns.length ? `<div class="gaps"><b>仍需补证</b><ul>${reportModule.unknowns.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}</details></article>`).join("")}
</div></section>
<section class="audit"><details><summary><b>完整来源审计（${evidencePackage.sources.length}）</b></summary><table><thead><tr><th>ID</th><th>类型</th><th>状态</th><th>来源</th></tr></thead><tbody>${evidencePackage.sources.map((source) => `<tr><td>${escapeHtml(source.id)}</td><td>${escapeHtml(source.sourceType)}</td><td>${escapeHtml(source.evidenceStatus)}</td><td><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a></td></tr>`).join("")}</tbody></table></details></section>
</main></body></html>`;

  await Promise.all([
    writeFile(markdownPath, markdown, "utf8"),
    writeFile(htmlPath, html, "utf8"),
    writeFile(whiteboardHtmlPath, whiteboardHtml, "utf8"),
  ]);
  return { markdownPath, htmlPath, whiteboardHtmlPath };
};
