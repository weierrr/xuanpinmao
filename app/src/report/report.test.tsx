import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  isStandaloneLandingPath,
  isStandaloneReadingPath,
  isStandaloneReportPath,
  isStandaloneWorkbenchPath,
} from "../app/app-shell";
import { buildRunReport } from "./service";
import { ReportView } from "./report-view";
import { parsePriceAnchor, parsePriceRange } from "./price-anchors";
import { mergedNextStageChecklistZh, reportTextZh } from "./report-copy";
import { activeChapterAt, reportChapters, reportChapterIds } from "./types";
import { calculateBreakoutScore, type BreakoutScoreFactor } from "./visual-shaping-opportunity";

const liveRunId = "research-run-3d-yoga-pants-dccf676c3167-us";
const composedRunId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

describe("run report storyline", () => {
  it("exposes exactly the eight mainline chapters in decision order", () => {
    const chapters = reportChapters();
    expect(chapters.map((chapter) => chapter.id)).toEqual([...reportChapterIds]);
    expect(chapters.map((chapter) => chapter.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(chapters[0].label).toBe("结论摘要");
    expect(chapters[6].label).toBe("能怎么宣传、不能怎么宣传");
    expect(chapters[7].label).toBe("现在允许做什么");
  });

  it("renders the report as a standalone view without the workbench menu", () => {
    expect(isStandaloneReportPath(`/research/${liveRunId}/report`)).toBe(true);
    expect(isStandaloneReadingPath(`/research/${liveRunId}/opportunities`)).toBe(true);
    expect(isStandaloneReportPath(`/research/${liveRunId}`)).toBe(false);
    expect(isStandaloneReportPath("/")).toBe(false);
    expect(isStandaloneLandingPath("/")).toBe(true);
    expect(isStandaloneLandingPath("/projects")).toBe(false);
    expect(isStandaloneWorkbenchPath("/discover")).toBe(true);
    expect(isStandaloneWorkbenchPath("/projects")).toBe(true);
    expect(isStandaloneWorkbenchPath("/discover/plan")).toBe(true);
    expect(isStandaloneWorkbenchPath("/discover/plan/ready")).toBe(true);
  });

  it("aggregates a live run without inventing conclusions", async () => {
    const report = await buildRunReport(liveRunId);

    // Chapter 0 only restates values that later chapters already carry.
    expect(report.summary.marketOverallScore).toBe(report.marketChapter.overall);
    expect(report.summary.marketVerdict).toBe(report.marketChapter.verdict);
    expect(report.summary.nextStepCost.experimentCount).toBe(report.validationPlan.length);
    expect(report.summary.nextStepCost.totalDurationDays).toBe(
      report.validationPlan.reduce((sum, item) => sum + item.duration_days, 0),
    );
    expect(report.summary.criticalUnknowns.length).toBeLessThanOrEqual(3);
    if (report.recommendedOpportunityId) {
      // The seller-facing direction is the localized wording of the same
      // recommendation, not the English reasoning artifact's internal title.
      expect(report.summary.recommendedDirection).toBe(report.recommendation.title);
      expect(report.recommendation.internalTitle).toBe(
        report.opportunities.find((item) => item.id === report.recommendedOpportunityId)?.title,
      );
    }
  });

  it("composes historical analysis with a separately labelled audit trail", async () => {
    const report = await buildRunReport(composedRunId);
    const html = renderToStaticMarkup(<ReportView report={report} />);

    expect(report.runId).toBe(composedRunId);
    expect(report.evidenceLineage?.primary.observationCount).toBe(699);
    expect(report.evidenceLineage?.primary.platformCount).toBe(5);
    expect(report.evidenceLineage?.audit.observationCount).toBe(13);
    expect(report.evidenceLineage?.audit.datedObservationCount).toBe(8);
    expect(report.appendix.searchLog.totals.total).toBe(15);
    expect(report.voice.validObservations).toBe(699);
    expect(report.summary.decisions.productSelection.value).toBe("HOLD_RESEARCH");
    expect(report.summary.decisions.productSelection.label).toBe("继续调研后再决定");
    expect(report.summary.decisions.formalSku.value).toBe("HOLD_SUPPLY");
    expect(report.summary.decisions.formalSku.label).toBe("暂缓正式供货");
    expect(report.summary.listingAllowed).toBe(false);
    expect(report.summary.adTestAllowed).toBe(false);
    expect(report.commercialViability).toMatchObject({
      decision: "RESEARCH_MORE",
      decisionLabel: "补证后再判断",
      commercialViabilityProven: false,
      evidenceCoverage: {
        assessedDimensions: 3,
        totalDimensions: 5,
        positiveDimensions: 0,
        blockedDimensions: 3,
      },
    });
    expect(report.conclusionGovernance).toMatchObject({
      currentCount: 12,
      topicCount: 12,
      supersededCount: 2,
      boundChapterCount: 7,
      conflictCount: 0,
    });
    expect(report.conclusionGovernance?.currentByTopic.product_direction?.[0].statement)
      .toBe("视觉磨皮与自然轮廓管理款");
    const directionBindings = ["summary", "positioning", "validation", "marketing"]
      .map((chapter) => report.conclusionGovernance?.currentByChapter[
        chapter as "summary" | "positioning" | "validation" | "marketing"
      ]?.product_direction?.[0].id);
    expect(directionBindings).toEqual([
      "CON-DIR-002",
      "CON-DIR-002",
      "CON-DIR-002",
      "CON-DIR-002",
    ]);
    expect(html).not.toContain("结论已统一");
    expect(html).not.toContain("全文已按最新有效证据统一结论");
    expect(html).not.toContain("旧结论已被覆盖");
    expect(html).not.toContain("查看一致性检查明细");
    expect(html).not.toContain("report-governance");
    expect(html).not.toContain("当前报告只有一套有效结论");
    expect(html).toContain("当前行动边界");
    expect(html).toContain("商业可行性决策卡");
    expect(html).toContain("商业成立尚未证明");
    expect(html).toContain("这不是平均分");
    expect(html).toContain("供应可实现性");
    expect(html).toContain("单位经济");
    expect(html).toContain("本报告综合 699 条多渠道反馈与 13 条最新核查反馈");
    expect(html).toContain("所有章节只呈现合并后的当前结论");
    expect(html).toContain("两部分资料已经在全文中合并，不形成两套并列结论");
    expect(html).toContain("查看资料范围与时间边界");
    expect(html).not.toContain("结论版本中心");
    expect(html).not.toContain("安全发布");
    expect(html).not.toContain("执行日志");
    expect(html).not.toContain("研究过程时间线");
    expect(html).not.toContain("高级审计与导出");
    expect(html).not.toContain("检索过程");
    expect(html).not.toContain('class="report-lineage-grid"');
    expect(html).not.toContain('class="report-lineage-card primary"');
    expect(html).not.toContain('class="report-lineage-connector"');
    expect(html).toContain("不能倒推旧资料当时是怎么搜到的、何时发布");
    expect(html).not.toContain(`>${report.runId}<`);
    expect(html).not.toContain(`>${report.evidenceLineage?.primary.runId}<`);
    expect(html).not.toContain(`>${report.evidenceLineage?.audit.runId}<`);
    expect(html).not.toContain(">HOLD_RESEARCH<");
    expect(html).not.toContain(">HOLD_SUPPLY<");
    expect(html.indexOf("四个维度的评分")).toBeLessThan(html.indexOf("各项评分为什么是这个分数"));
    expect(html.indexOf("各项评分为什么是这个分数")).toBeLessThan(html.indexOf("机会成立的关键依据"));
    expect(html).toContain("lucide-circle-help");
    expect(html).toContain("Google Trends 数值");
    expect(html).toContain("本次获取受阻");
    expect(html).toContain("打开 Google Trends 重新获取");
    expect(html).toContain("trends.google.com/trends/explore");
    expect(html).toContain("date=today+5-y");
    expect(html).toContain("geo=US");
    expect(html).toContain("butt+lifting+leggings%2Cscrunch+leggings");
    expect(html).toContain("report-stance-source-links");
    expect(html).toContain("查看商品页");
    expect(html).toContain("查看品牌页");
    expect(html).toContain("先分清：什么让用户点进来，什么让用户最终下单");
    expect(html).toContain("不同竞品分别用什么抓手把用户带进来？");
    expect(report.consumerPsychology?.stages).toHaveLength(6);
    expect(html).toContain("用户决策链");
    expect(html).toContain("用户为什么会行动？");
    expect(html).toContain("场景触发");
    expect(html).toContain("心理张力");
    expect(html).toContain("理想自我投射");
    expect(html).toContain("结果想象");
    expect(html).toContain("信任形成");
    expect(html).toContain("风险消除");
    expect(html).toContain("目标 SKU 尚未实测");
    expect(report.marketing?.decisionChain?.mappings).toHaveLength(5);
    expect(html).toContain("心理链如何转成营销表达");
    expect(html).toContain("PSYCHOLOGY");
    expect(html).toContain("让用户停下来");
    expect(html).toContain("让用户形成信任");
    expect(html).toContain("让用户采取下一步");
    expect(html).not.toContain("分品牌广告抓手");
    expect(html).toContain("Ionix 用橘皮与外观焦虑切入");
    expect(html).toContain("Silix 用循环、炎症和身体不适切入");
    expect(html).toContain("不透、尺码、舒适、退款保证、折扣和免邮主要用于降低风险与犹豫");
    expect(html).toContain("购买页如何承接兴趣并促成下单");
    expect(html).not.toContain("旧结论已调整");
    expect(html).not.toContain(">竞品为什么卖得出去<");
    expect(html).not.toContain(">Ionix 为什么能卖<");
    expect(html.indexOf("核心转化结论")).toBeLessThan(html.indexOf("竞品成交证据"));
    expect(html).toContain("Facebook 广告用“去橘皮”切入外观焦虑");
    expect(html).toContain("广告用“促进淋巴流动、减轻炎症”吸引身体不适与塑形人群");
    expect(html).toContain("查看独立评论记录");
    expect(html).toContain("打开 Meta 广告资料库继续核查");
    expect(html).toContain("不能确认 Ionix 当前是否仍在投放");
    expect(html).toContain("不进入可直接使用的营销文案");
    expect(html).toContain("视觉磨皮与自然轮廓管理款");
    expect(html).toContain("值得找样验证，不值得直接备货");
    expect(html).toContain('href="#chapter-validation"');
    expect(html).toContain("查看验证方案");
    expect(html).toContain("这个品能不能卖，机会在哪里");
    expect(html).toContain("这份判断基于");
    expect(html).toContain("699</dt><dd>条买家反馈");
    expect(html).toContain("Amazon 528、SUUKSESS 129、Reddit 26、Trustpilot 12、DFYNE 4");
    expect(html).not.toContain("条近期补充资料");
    expect(html).not.toContain("用来确认原来的判断现在还靠不靠谱");
    expect(html).toContain("7</dt><dd>个在售价格");
    expect(html).toContain("用来判断市场大致卖多少钱");
    expect(html).toContain("2</dt><dd>个重点竞品");
    expect(html).toContain("Ionix、Silix的广告和商品页");
    expect(html).toContain("哪些事情还没有被证明？");
    expect(html.indexOf("值得找样验证，不值得直接备货"))
      .toBeLessThan(html.indexOf(report.summary.conclusion));
    expect(html).toContain("有没有市场");
    expect(html).toContain("有明确需求");
    expect(html).toContain("竞争偏高");
    expect(html).toContain("比较卷");
    expect(html).toContain("有差异化窗口");
    expect(html).not.toContain('class="report-seller-signal opportunity"');
    expect(html).toContain("拿着这些词去找货");
    expect(html).toContain("视觉磨皮瑜伽裤");
    expect(html).toContain("复制完整寻源包");
    expect(html).toContain("展开组合搜索词和工厂询盘话术");
    expect(html).toContain("找到货后，把链接带回来核验");
    expect(html).toContain("等待候选商品");
    expect(html).toContain("识别商品");
    expect(html).toContain("隔离变体");
    expect(html).toContain("Exact / Near 匹配规则");
    expect(html).toContain("现在可以做");
    expect(html).toContain("必须先确认");
    expect(html).toContain("现在不能做");
    expect(html).toContain("竞品页面与素材参考");
    expect(html).toContain("不同变体可能共享页面标题");
    expect(html).toContain("未提交候选商品时只展示核验规则");
    expect(html).not.toContain("此前的“证据优先自然塑形款”已经合并到本方向");
    expect(html).toContain("先解决侧光下臀腿凹凸、腰腹断层和轮廓不连贯");
    expect(html).toContain("它把最新广告抓手、用户外观焦虑和可视化产品效果串成同一条链路");
    expect(html).not.toContain("该方向同时回应了当前证据中最明确的不透、舒适和克制塑形需求");
    expect(html).not.toContain("补充优先验证方向");
    expect(html).not.toContain(">证据优先的自然塑形款<");
    expect(html).toContain("这种外观焦虑到底覆盖多少人？");
    expect(html).toContain("80%–90%");
    expect(html).toContain("约 1.016 亿");
    expect(html).toContain("约 8100万–9100万");
    expect(html).toContain("约 9.0 亿美元");
    expect(html).not.toContain("lululemon 2024 财年收入");
    expect(html).not.toContain("用于证明高溢价运动服饰已有成熟消费");
    expect(html).not.toContain("受影响人数直接写成潜在买家");
    expect(html).toContain("只说明焦虑覆盖面，不代表购买意愿");
    expect(html).toContain("不是销量预测");
    expect(html).toContain("从“压力”改为“肉眼可见的外观管理”");
    expect(html).toContain("同光线、同姿势的视觉盲测");
    expect(html).toContain("至少 60% 的盲选判断");
    expect(html).toContain("爆品潜力分");
    expect(html).toContain("这条产品方向具不具备爆品结构？");
    expect(html).toContain("高频或高强度焦虑");
    expect(html).toContain("明确触发场景");
    expect(html).toContain("可感知效果");
    expect(html).toContain("低理解成本");
    expect(html).toContain("可信证明");
    expect(html).toContain("渠道可放大性");
    expect(html).toContain("交付可持续性");
    expect(html).toContain("七项按乘法逻辑计算几何平均");
    expect(html).toContain("值得验证，暂不放量");
    expect(html).toContain("横向对比 7 个公开价格点");
    expect(html).toContain("report-price-scatter");
    expect(html).toContain("7 个竞品公开售价与建议售价区间散点图");
    expect(html).toContain("我们建议 $39–$49");
    for (const competitor of ["Oner Active", "AYBL", "Yeoreo", "Aoxjox", "Paragon"]) {
      expect(html).toContain(competitor);
    }
    for (const source of ["Amazon 528 条", "SUUKSESS 129 条", "Reddit 26 条", "Trustpilot 12 条", "DFYNE 4 条"]) {
      expect(html).toContain(source);
    }
    expect(html).toContain("补充更多渠道的用户反馈和反向证据");
    expect(html).toContain("在独立页面继续查看这些机会");
    expect(html).toContain(`/research/${composedRunId}/opportunities`);
    expect(html).toContain("report-discovery-network-title");
    expect(html).toContain("这款商品连接着哪些人、场景与相邻机会？");
    expect(html).not.toContain("进入完整发现网络");
    expect(html).toContain("共同讨论不等于共同购买");
    const nextStageChecklist = mergedNextStageChecklistZh(report.nextStageRequirements, report.entryConditions);
    expect(nextStageChecklist).toHaveLength(5);
    expect(html).toContain("进入下一阶段前必须完成（5 项）");
    expect(html).not.toContain("进入下一阶段的判断依据");
    expect(html).toContain("研究过程与证据附录");
    expect(html).toContain("研究与证据附录");
    expect(html).not.toContain(">附录<");
  });

  it("keeps conclusion-governance diagnostics out of the reader-facing report", async () => {
    const report = await buildRunReport(composedRunId);
    if (!report.conclusionGovernance) throw new Error("expected conclusion governance");
    report.conclusionGovernance = {
      ...report.conclusionGovernance,
      conflictCount: 2,
    };

    const html = renderToStaticMarkup(<ReportView report={report} />);
    expect(html).not.toContain("report-governance");
    expect(html).not.toContain("发现 2 个未解决的跨章节冲突");
    expect(html).not.toContain("查看冲突与覆盖记录");
  });

  it("caps the breakout score when one factor is a weak link", () => {
    const factors: BreakoutScoreFactor[] = [
      { key: "a", label: "A", score: 90, status: "已成立", rationale: "Strong factor", nextAction: "Keep testing" },
      { key: "b", label: "B", score: 20, status: "薄弱项", rationale: "Weak factor", nextAction: "Fix weak link" },
    ];

    expect(calculateBreakoutScore(factors)).toBe(42);
    expect(calculateBreakoutScore([])).toBe(0);
  });

  it("keeps the reading storyline in Chinese and English artifacts in disclosed records", async () => {
    const report = await buildRunReport(liveRunId);
    const html = renderToStaticMarkup(<ReportView report={report} />);

    const body = html
      // <details> blocks hold the disclosed original-language records.
      .replace(/<details[\s\S]*?<\/details>/g, "")
      // Verbatim user quotes are evidence and must never be translated.
      .replace(/<blockquote[\s\S]*?<\/blockquote>/g, "")
      // Verbatim competitor excerpts are evidence, kept in their own language.
      .replace(/<span class="report-verbatim[^"]*">[\s\S]*?<\/span>/g, "")
      // Run identifier and source-provided budget strings are not prose.
      .replace(/<aside class="report-chrome"[\s\S]*?<\/aside>/g, "")
      .replace(/<span class="report-experiment-cost">[\s\S]*?<\/span>/g, "")
      .replace(/<span class="report-timeline-meta">[\s\S]*?<\/span>/g, "");
    const paragraphs = body.match(/>([^<>]{25,})</g) ?? [];
    const englishOnly = paragraphs
      .map((chunk) => chunk.slice(1, -1))
      .filter((text) => {
        const cjk = (text.match(/[一-鿿]/g) ?? []).length;
        const latin = (text.match(/[A-Za-z]/g) ?? []).length;
        return latin > 20 && cjk / (cjk + latin) < 0.15;
      });

    expect(englishOnly).toEqual([]);
  });

  it("keeps the three decision layers separate", async () => {
    const report = await buildRunReport(liveRunId);
    const { decisions } = report.summary;
    expect(decisions.firstPrinciplesRecommendation.length).toBeGreaterThan(0);
    expect(decisions.productSelection.value).not.toBe(decisions.formalSku.value);
  });

  it("forbids listing and ad tests while the formal SKU decision is on hold", async () => {
    const report = await buildRunReport(liveRunId);
    expect(report.summary.decisions.formalSku.value).toBe("HOLD_SUPPLY");
    expect(report.summary.listingAllowed).toBe(false);
    expect(report.summary.adTestAllowed).toBe(false);
  });

  it("does not surface risk or economics blocks a live run has no data for", async () => {
    const report = await buildRunReport(liveRunId);
    expect(report.appendix.riskModuleCount).toBe(0);
    expect(report.appendix.economicsScenarioCount).toBe(0);

    const html = renderToStaticMarkup(<ReportView report={report} />);
    expect(html).not.toContain("打开风险模块明细");
    expect(html).not.toContain("打开单位经济明细");
  });

  it("preserves original source titles and urls in the evidence ledger", async () => {
    const report = await buildRunReport(liveRunId);
    const html = renderToStaticMarkup(<ReportView report={report} />);
    for (const source of report.appendix.evidence.sources.slice(0, 5)) {
      expect(html).toContain(source.url);
    }
    expect(report.appendix.evidence.sources.some((source) => source.originalTitle !== source.title)).toBe(true);
  });

  it("renders every chapter anchor once, in order, plus the appendix", async () => {
    const report = await buildRunReport(liveRunId);
    const html = renderToStaticMarkup(<ReportView report={report} />);
    const anchors = [...html.matchAll(/id="chapter-([a-z]+)"/g)].map((match) => match[1]);
    expect(anchors).toEqual([...reportChapterIds, "appendix"]);
  });

  it("puts the four reader outcomes before the verdict and moves research method to the appendix", async () => {
    const report = await buildRunReport(liveRunId);
    const html = renderToStaticMarkup(<ReportView report={report} />);
    const mapStart = html.indexOf("先看 4 个最终答案，再展开 3 组关键依据");
    const verdictStart = html.indexOf(report.summary.conclusion);

    expect(mapStart).toBeGreaterThan(-1);
    expect(mapStart).toBeLessThan(verdictStart);
    expect(html).toContain("一分钟看清当前结论、关键未知和允许动作。");
    expect(html).toContain("市场、用户和竞品负责解释为什么");
    expect(html).toContain("得到目标用户、产品方向、差异化与相邻机会。");
    expect(html).toContain("得到营销转译、消息支柱，以及可说与不可说的 Claim。");
    expect(html).toContain("结论是怎么得出的？");
    expect(html).toContain("需要复核时，再按研究视角展开");
    for (const chapterId of ["market", "competitors", "customers", "positioning", "validation", "marketing", "boundary"]) {
      expect(html).toContain(`href="#chapter-${chapterId}"`);
    }
  });

  it("keeps market, customer and competitor conclusions in the main reading navigation", async () => {
    const report = await buildRunReport(composedRunId);
    const html = renderToStaticMarkup(<ReportView report={report} />);
    const labels = ["1分钟判断", "市场与机会", "用户画像", "竞品分析", "产品", "营销", "验证"];
    const positions = labels.map((label) => html.indexOf(`>${label}</span>`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(html).toContain('class="report-evidence-chapter report-chapter-market"');
    expect(html).toContain("市场、用户和竞品的关键结论已经回到正文");
    expect(html.match(/class="report-evidence-chapter-preview"/g) ?? []).toHaveLength(3);
    expect(html).toContain(reportTextZh(report.marketChapter.verdict));
  });

  it("direct-labels every bar so no value depends on reading a color", async () => {
    const report = await buildRunReport(liveRunId);
    const html = renderToStaticMarkup(<ReportView report={report} />);
    const bars = html.match(/class="report-bar-row"/g) ?? [];
    const values = html.match(/class="report-bar-value"/g) ?? [];
    expect(bars.length).toBeGreaterThan(0);
    expect(values.length).toBe(bars.length);
  });

  it("keeps the real denominator on every voice-of-customer bar", async () => {
    const report = await buildRunReport(liveRunId);
    const html = renderToStaticMarkup(<ReportView report={report} />);
    // Bars are scaled for comparison between themes, so the true denominator
    // must never be dropped from the label.
    for (const pain of report.voice.topPainPoints) {
      expect(html).toContain(`${pain.count}/${pain.denominator}`);
    }
  });

  describe("sticky rail highlight", () => {
    // Real offsets measured on the live report at 1280x900, reading line 80.
    const offsets = [
      { id: "summary", top: -1650 },
      { id: "market", top: -794 },
      { id: "competitors", top: 24 },
      { id: "customers", top: 655 },
      { id: "positioning", top: 2629 },
      { id: "validation", top: 3805 },
      { id: "marketing", top: 6936 },
      { id: "boundary", top: 8680 },
      { id: "appendix", top: 9724 },
    ];

    it("highlights the last chapter whose top passed the reading line", () => {
      expect(activeChapterAt(offsets, 80, false)).toBe("competitors");
    });

    it("holds the first chapter before anything has scrolled past", () => {
      const atTop = offsets.map((offset, index) => ({ ...offset, top: index * 900 }));
      expect(activeChapterAt(atTop, 80, false)).toBe("summary");
    });

    it("pins the last chapter at the bottom of the page", () => {
      // The appendix is short enough that its top may never cross the line.
      expect(activeChapterAt(offsets, 80, true)).toBe("appendix");
    });

    it("does not skip a short chapter sandwiched between tall ones", () => {
      const shortMiddle = [
        { id: "validation", top: -2400 },
        { id: "marketing", top: -40 },
        { id: "boundary", top: 320 },
      ];
      expect(activeChapterAt(shortMiddle, 80, false)).toBe("marketing");
    });

    it("returns null when no chapters are in the dom yet", () => {
      expect(activeChapterAt([], 80, false)).toBeNull();
    });
  });

  describe("price anchors", () => {
    const claim = (statement: string, targetScope = "competitor") =>
      ({ id: "CLM-001", sourceId: "SRC-001", statement, targetScope });

    it("reads a sale price and its list price", () => {
      const anchor = parsePriceAnchor(
        claim("Ionix lists Sculpt 3D leggings at $49.90 sale versus $69.90 regular."),
        "Ionix",
        null,
      );
      expect(anchor).toMatchObject({ current: 49.9, original: 69.9, currencySymbol: "$" });
    });

    it("ignores numbers that are not product prices", () => {
      // A shipping threshold reads as a price to a naive parser.
      expect(parsePriceAnchor(
        claim("Ionix uses a $55 free-shipping threshold and 90-day guarantee to reduce friction."),
        "Ionix",
        null,
      )).toBeNull();
    });

    it("ignores claims that are not about a competitor", () => {
      expect(parsePriceAnchor(
        claim("Public supplier price fields must not be used at $9.90.", "supplier"),
        "Alibaba",
        null,
      )).toBeNull();
    });

    it("refuses mixed currencies rather than guessing", () => {
      expect(parsePriceAnchor(
        claim("Listed at $49.90 sale in the US and €59.90 regular in the EU."),
        "Mixed",
        null,
      )).toBeNull();
    });

    it("drops a list price that is not above the current price", () => {
      const anchor = parsePriceAnchor(
        claim("Priced at $49.90 sale versus $39.90 regular."),
        "Odd",
        null,
      );
      expect(anchor?.original).toBeNull();
    });

    it("parses our recommended band and rejects an unparseable one", () => {
      expect(parsePriceRange("USD $39-$49 after sample quality is verified"))
        .toEqual({ low: 39, high: 49, currencySymbol: "$" });
      expect(parsePriceRange("to be determined after sampling")).toBeNull();
    });

    it("keeps every rendered anchor traceable to a source", async () => {
      const report = await buildRunReport(liveRunId);
      expect(report.priceAnchors.length).toBeGreaterThan(0);
      for (const anchor of report.priceAnchors) {
        expect(anchor.claimId).toMatch(/^CLM-/);
        expect(anchor.sourceId).toMatch(/^SRC-/);
      }
    });
  });

  describe("generic price bands and market structure", () => {
    it("builds a reusable observed-offer structure for the composed report", async () => {
      const report = await buildRunReport(composedRunId);
      const structure = report.priceMarketStructure;
      if (!structure) throw new Error("expected composed report to have a price market structure");

      expect(structure.coverage.status).toBe("sufficient");
      expect(structure.coverage.usableObservationCount).toBe(7);
      expect(structure.bands.map((band) => band.key)).toEqual(["entry", "core", "premium"]);
      expect(structure.coverage.claimBackedCount).toBeGreaterThan(0);
      expect(structure.coverage.curatedBenchmarkCount).toBe(5);
      expect(structure.boundary).toContain("不是市场均价、市场份额或需求曲线");
    });

    it("renders price structure, evidence boundaries and the recommendation position", async () => {
      const report = await buildRunReport(composedRunId);
      const html = renderToStaticMarkup(<ReportView report={report} />);

      expect(html).toContain("通用价格带 · 公开报价结构");
      expect(html).toContain("这个市场的价格是怎么分层的？");
      expect(html).toContain("低位进入带");
      expect(html).toContain("主流比较带");
      expect(html).toContain("高位溢价带");
      expect(html).toContain("不是销量加权市场均价");
      expect(html).toContain("不能回答什么");
      expect(html).toContain("哪个价格带销量最大或利润最好");
    expect(html).toContain("建议价格的位置");
    expect(report.estimatedUnitEconomics).toMatchObject({
      status: "planning_estimate",
      method: "reverse_landed_cost_ceiling",
      inputCoverage: {
        formalEconomicsProven: false,
      },
    });
    expect(html).toContain("假设情景示例 · 成本红线反推");
    expect(html).toContain("这单生意最多能承受多少成本");
    expect(html).toContain("基准情景 · 总落地成本红线");
    expect(html).toContain("$10.42");
    expect(html).toContain("接入真实数据前仅供规划");
    expect(html.match(/>推导值</g)?.length).toBeGreaterThanOrEqual(20);
    expect(html).toContain(">假设变化</small>");
    expect(html).toContain(">假设值</small>");
    expect(html).toContain(">当前记录</small>");
    expect(html).toContain("预估模型不会把未知项填成 0");
  });
  });

  describe("competitor stance table", () => {
    it("pairs competitor observations with our own requirements", async () => {
      const report = await buildRunReport(liveRunId);
      expect(report.competitorStance.length).toBeGreaterThan(0);
      for (const row of report.competitorStance) {
        // A row exists only when both sides carry content.
        expect(row.competitor.length).toBeGreaterThan(0);
        expect(row.ours.length).toBeGreaterThan(0);
      }
    });

    it("does not assert whether the two sides agree", async () => {
      const report = await buildRunReport(liveRunId);
      const html = renderToStaticMarkup(<ReportView report={report} />);
      // No verdict column: judging alignment needs a physical sample we lack.
      expect(html).not.toContain("已对齐");
      expect(html).toContain("右边给出我们的产品要求；是否真正做到，仍需目标样品实测");
    });
  });

  describe("adjacent opportunities", () => {
    // Narrows the nullable field once so the assertions below need no `!`.
    const loadDemandField = async () => {
      const report = await buildRunReport(liveRunId);
      const field = report.demandField;
      if (field === null) throw new Error("expected this run to have a demand field artifact");
      return { report, field };
    };

    it("surfaces the demand field without approving anything", async () => {
      const { field } = await loadDemandField();
      expect(field.opportunities.length).toBeGreaterThan(0);
      // The artifact's own boundary flags must survive into the report.
      expect(field.opportunitiesNotApproved).toBe(true);
      expect(field.newRunRequired).toBe(true);
      expect(field.currentDecisionUnchanged).toBe(true);
    });

    it("carries a reason and open questions for every candidate", async () => {
      const { field } = await loadDemandField();
      for (const opportunity of field.opportunities) {
        expect(opportunity.whyNotApproved.length).toBeGreaterThan(0);
        expect(opportunity.relationships.length).toBeGreaterThan(0);
      }
    });

    it("flags candidates the corpus never names as products", async () => {
      const { report, field } = await loadDemandField();
      expect(field.opportunities.filter((item) => !item.directProductEvidence).length).toBeGreaterThan(0);

      const html = renderToStaticMarkup(<ReportView report={report} />);
      expect(html).toContain("语料中没有直接出现该商品");
      expect(html).toContain("以下方向均未获批准");
    });

    it("leaves every candidate in a non-approving status", async () => {
      const { field } = await loadDemandField();
      // Semantic check rather than a keyword blacklist: a blacklist collides
      // with legitimate copy such as the chapter title 市场值不值得做.
      const approving = field.opportunities.filter(
        (item) => !["需要继续研究", "暂不优先"].includes(item.statusLabel),
      );
      expect(approving).toEqual([]);
    });
  });

  describe("counterevidence", () => {
    it("pairs complaints with satisfaction on the same theme", async () => {
      const report = await buildRunReport(liveRunId);
      expect(report.sentimentSplit.length).toBeGreaterThan(0);

      const fit = report.sentimentSplit.find((row) => row.theme === "版型与尺码");
      // The join is the point: 45 complaints alone reads far worse than
      // 45 complaints beside 229 satisfied observations on the same theme.
      expect(fit).toMatchObject({ negative: 45, positive: 229 });
    });

    it("separates direct rebuttals from ordinary positive reviews", async () => {
      const report = await buildRunReport(liveRunId);
      // The corpus types these differently; merging them into one figure would
      // overstate how much of it actually argues against a pain point.
      expect(report.positiveEvidenceCount).toBe(552);
      expect(report.counterevidence.length).toBe(9);
      expect(report.positiveEvidenceCount).not.toBe(report.counterevidence.length);
    });

    it("shows rebuttal content, not just a count", async () => {
      const report = await buildRunReport(liveRunId);
      const html = renderToStaticMarkup(<ReportView report={report} />);
      expect(html).not.toContain("正向或反证");
      for (const item of report.counterevidence) {
        expect(item.paraphrase.length).toBeGreaterThan(0);
        expect(html).toContain(reportTextZh(item.paraphrase));
        expect(html).toContain(item.url);
      }
    });

    it("degrades to empty when a run has no voice-of-customer artifacts", async () => {
      const { readVocEvidence } = await import("./voc-evidence");
      const evidence = await readVocEvidence("research-run-does-not-exist", (value) => value);
      expect(evidence).toEqual({
        sentimentSplit: [],
        counterevidence: [],
        positiveEvidenceCount: 0,
        // No corpus is not the same as a corpus without dates: claiming the
        // latter would put a limitation notice on a run that has no VoC at all.
        missingObservationDates: false,
        observationCount: 0,
        datedObservationCount: 0,
        platformCounts: [],
      });
    });
  });

  describe("search process", () => {
    it("retains recorded queries internally without exposing them in the reader report", async () => {
      const report = await buildRunReport(liveRunId);
      // This run only has the hand-written markdown log.
      expect(report.appendix.searchLog.fidelity).toBe("queries_only");
      expect(report.appendix.searchLog.totals.total).toBeGreaterThan(0);

      const html = renderToStaticMarkup(<ReportView report={report} />);
      expect(html).not.toContain("检索过程");
      expect(html).not.toContain("仅记录了查询词");
      expect(html).not.toContain(report.appendix.searchLog.queries[0].query);
    });

    it("keeps missing search-log diagnostics out of the reader report", async () => {
      const report = await buildRunReport("research-run-manual-dog-paw-cleaner-cup-4c8ff1c9a424-us");
      expect(report.appendix.searchLog.fidelity).toBe("unrecorded");

      const html = renderToStaticMarkup(<ReportView report={report} />);
      expect(html).not.toContain("没有留下检索过程记录");
    });
  });

  describe("build plan", () => {
    const loadBuildPlan = async () => {
      const report = await buildRunReport(liveRunId);
      const plan = report.buildPlan;
      if (plan === null) throw new Error("expected this run to have supply atoms");
      return { report, plan };
    };

    it("summarises the cost questions a seller asks first", async () => {
      const { plan } = await loadBuildPlan();
      expect(plan.totals.total).toBe(10);
      // Nothing needs tooling, which is the one piece of good cost news here.
      expect(plan.totals.deepCustomization).toBe(0);
      // ...but nothing is costed or verified either, and that must stay visible.
      expect(plan.totals.costKnown).toBe(0);
      expect(plan.totals.targetVerified).toBe(0);
    });

    it("groups every atom under a translated category", async () => {
      const { plan } = await loadBuildPlan();
      const grouped = plan.categories.flatMap((category) => category.atoms);
      expect(grouped).toHaveLength(plan.atoms.length);
      for (const category of plan.categories) {
        // An untranslated category would leak a machine enum into the page.
        expect(category.label).not.toMatch(/^[a-z_]+$/);
      }
    });

    it("keeps the supply verification boundary without exposing the internal build-plan module", async () => {
      const { plan } = await loadBuildPlan();
      expect(plan.atoms.every((atom) => atom.targetSkuVerified === false)).toBe(true);

      const { report } = await loadBuildPlan();
      const html = renderToStaticMarkup(<ReportView report={report} />);
      expect(html).not.toContain("展开产品实现与供应拆解");
    });
  });

  it("renders appendix unknowns in Chinese", async () => {
    const report = await buildRunReport(composedRunId);
    const html = renderToStaticMarkup(<ReportView report={report} />);

    expect(html).toContain("最终供应商和准确的目标款");
    expect(html).toContain("正式报价、最低起订量、包装信息、生产交期和质量条款");
    expect(html).toContain("当前用户语料只使用了同一来源族下的两个 Reddit 页面");
    expect(html).not.toContain("Final supplier and exact target SKU");
    expect(html).not.toContain("The corpus uses two Reddit pages from one source family");
  });

  describe("missing observation dates", () => {
    it("detects that the corpus carries no publication dates", async () => {
      const report = await buildRunReport(liveRunId);
      // captured_at is our fetch time; it cannot support a recency claim.
      expect(report.missingObservationDates).toBe(true);
    });

    it("tells the reader recency cannot be judged", async () => {
      const report = await buildRunReport(liveRunId);
      const html = renderToStaticMarkup(<ReportView report={report} />);
      expect(html).toContain("这批观察没有原始发布时间");
      // The report must not imply it knows which themes are recent.
      for (const banned of ["近期爆发", "长期存在的老问题是"]) {
        expect(html.includes(`${banned}：`)).toBe(false);
      }
    });
  });

  it("keeps the prohibited marketing claims visible in the report body", async () => {
    const report = await buildRunReport(liveRunId);
    const html = renderToStaticMarkup(<ReportView report={report} />);
    expect(html).toContain("禁止使用的营销声明");
    const claims = report.marketing?.prohibitedClaims.map((item) => item.claim)
      ?? report.prohibitedMarketingClaims;
    expect(claims.length).toBeGreaterThan(0);
  });

  it("validates the dog paw cleaner as a second category without clothing leakage", async () => {
    const report = await buildRunReport("research-run-manual-dog-paw-cleaner-cup-4c8ff1c9a424-us");
    const html = renderToStaticMarkup(<ReportView report={report} />);

    expect(report.secondCategoryValidation).toMatchObject({
      status: "partial",
      statusLabel: "核心链路通过，继续补齐",
      metrics: {
        coreCapabilitiesAvailable: 6,
        contaminationCount: 0,
      },
    });

    expect(html).toContain("第二品类验证");
    expect(html).toContain("这套能力换一个品类还能不能成立");
    expect(html).toContain("手动洗爪杯");
    expect(html).toContain("犬只");
    expect(html).toContain("脚掌");
    expect(html).toContain("这款商品连接着哪些人、场景与相邻机会？");
    expect(html).toContain("尚未生成相邻商品产物");

    for (const leaked of [
      "Ionix",
      "Silix",
      "视觉磨皮",
      "橘皮",
      "塑形紧身裤",
      "3d-yoga-pants-customer-persona",
    ]) {
      expect(html).not.toContain(leaked);
    }
  });
});
