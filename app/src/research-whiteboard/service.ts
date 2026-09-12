import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OpportunityDiscoveryPlan } from "@/opportunity-discovery/types";
import type { LiveResearchAnalysis, ResearchClaim } from "@/research/live-types";
import type { EvidencePackage, ResearchSource } from "@/research/types";
import { reportTextZh } from "@/report/report-copy";
import {
  researchWhiteboardSchema,
  researchWhiteboardStageCodes,
  type ResearchWhiteboard,
  type ResearchWhiteboardSource,
  type ResearchWhiteboardReportModule,
  type ResearchWhiteboardStageCode,
  type ResearchWhiteboardStageStatus,
} from "./types";

export const researchWhiteboardPath = (discoveryId: string): string =>
  path.join(process.cwd(), "output", "discovery", discoveryId, "research-whiteboard.json");

const waitingSummaries: Partial<Record<ResearchWhiteboardStageCode, string>> = {
  market: "等待检索需求、趋势、价格与竞争强度。",
  customer: "等待读取评论、社区讨论与购买场景。",
  competitor: "等待分析竞品卖点、信任机制与成交路径。",
  supply: "等待寻找供应候选、规格、MOQ 与报价线索。",
  compliance: "等待核对官方规则、认证与宣传边界。",
};

const emptyStage = (code: ResearchWhiteboardStageCode, now: string) => ({
  code,
  status: code === "scope" ? "complete" as const : "pending" as const,
  queryCount: 0,
  sourceCount: 0,
  recordCount: 0,
  summary: code === "scope" ? "研究对象、市场与输入线索已经确认。" : waitingSummaries[code] ?? "等待 Agent 开始处理。",
  sources: [],
  queryLabels: [],
  updatedAt: now,
});

export const createResearchWhiteboard = (
  plan: OpportunityDiscoveryPlan,
  now = new Date(),
): ResearchWhiteboard => {
  const at = now.toISOString();
  const stages = Object.fromEntries(
    researchWhiteboardStageCodes.map((code) => [code, emptyStage(code, at)]),
  );
  return researchWhiteboardSchema.parse({
    schemaVersion: "1.0",
    discoveryId: plan.discoveryId,
    product: plan.categoryKeyword,
    market: plan.targetMarket,
    channel: plan.salesChannel,
    status: "waiting",
    createdAt: at,
    updatedAt: at,
    stages,
    activity: [{
      id: `scope-${now.getTime()}`,
      at,
      stage: "scope",
      status: "complete",
      message: "研究对象已在页面内确认，等待开始证据采集。",
    }],
    reportModules: [],
  });
};

export const initializeResearchWhiteboard = async (
  plan: OpportunityDiscoveryPlan,
  now = new Date(),
): Promise<ResearchWhiteboard> => {
  const whiteboard = createResearchWhiteboard(plan, now);
  await writeFile(researchWhiteboardPath(plan.discoveryId), `${JSON.stringify(whiteboard, null, 2)}\n`, "utf8");
  return whiteboard;
};

export const readResearchWhiteboard = async (discoveryId: string): Promise<ResearchWhiteboard> =>
  researchWhiteboardSchema.parse(JSON.parse(await readFile(researchWhiteboardPath(discoveryId), "utf8")));

const overallStatus = (whiteboard: ResearchWhiteboard): ResearchWhiteboard["status"] => {
  const values = Object.values(whiteboard.stages);
  if (values.some((stage) => stage.status === "blocked")) return "blocked";
  if (["market_report", "customer_report", "competitor_report", "product_report", "marketing_report", "validation_report"]
    .every((code) => whiteboard.stages[code as ResearchWhiteboardStageCode].status === "complete")) return "completed";
  if (values.some((stage) => stage.code.endsWith("_report") && stage.status === "in_progress")) return "reporting";
  if (whiteboard.stages.synthesis.status === "in_progress" || whiteboard.stages.synthesis.status === "complete") return "analyzing";
  if (values.some((stage) => stage.status === "in_progress" || (stage.code !== "scope" && stage.status === "complete"))) return "researching";
  return "waiting";
};

export type ResearchWhiteboardUpdate = {
  stage: ResearchWhiteboardStageCode;
  status: ResearchWhiteboardStageStatus;
  message: string;
  queryCount?: number;
  sourceCount?: number;
  recordCount?: number;
  researchRunId?: string;
  source?: ResearchWhiteboardSource;
};

export const updateResearchWhiteboard = async (
  discoveryId: string,
  update: ResearchWhiteboardUpdate,
  now = new Date(),
): Promise<ResearchWhiteboard> => {
  const current = await readResearchWhiteboard(discoveryId);
  const at = now.toISOString();
  const previousStage = current.stages[update.stage];
  const sources = update.source
    ? [...previousStage.sources.filter((item) => item.url !== update.source?.url), update.source]
    : previousStage.sources;
  const stage = {
    ...previousStage,
    status: update.status,
    queryCount: update.queryCount ?? previousStage.queryCount,
    sourceCount: update.sourceCount ?? Math.max(previousStage.sourceCount, sources.length),
    recordCount: update.recordCount ?? previousStage.recordCount,
    summary: update.message,
    sources,
    updatedAt: at,
  };
  const next = {
    ...current,
    researchRunId: update.researchRunId ?? current.researchRunId,
    updatedAt: at,
    stages: { ...current.stages, [update.stage]: stage },
    activity: [
      ...current.activity,
      { id: `${update.stage}-${now.getTime()}`, at, stage: update.stage, status: update.status, message: update.message },
    ].slice(-60),
  };
  const validated = researchWhiteboardSchema.parse({ ...next, status: overallStatus(next) });
  await writeFile(researchWhiteboardPath(discoveryId), `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return validated;
};

const sourceKind = (source: ResearchSource): ResearchWhiteboardSource["kind"] => {
  if (/reddit\.com|walmart\.com\/reviews/i.test(source.url)) return "community";
  return ({
    market: "market",
    competitor: "competitor",
    supplier: "supplier",
    regulation: "official",
    other: "other",
  }[source.sourceType] as ResearchWhiteboardSource["kind"]);
};

const sourceStatus = (source: ResearchSource): ResearchWhiteboardSource["status"] =>
  source.accessStatus === "blocked" || source.accessStatus === "unavailable"
    ? "blocked"
    : source.evidenceStatus === "verified" ? "verified" : "candidate";

const moduleItem = (
  text: string,
  sourceIds: string[] = [],
  level: "fact" | "directional" | "hypothesis" | "unknown" = "directional",
) => ({ text, sourceIds, level });

export const buildWhiteboardReportModules = (
  analysis: LiveResearchAnalysis,
  claims: ResearchClaim[],
  now = new Date(),
): ResearchWhiteboardReportModule[] => {
  const at = now.toISOString();
  const translation = analysis.marketingTranslation;
  const claimSourceIds = (category: ResearchClaim["category"]) => [...new Set(
    claims.filter((claim) => claim.category === category).map((claim) => claim.sourceId),
  )];
  const unknowns = analysis.unknowns;
  const competitorSourceIds = analysis.competitorInsight.sourceIds ?? [];
  const customerSourceIds = analysis.customerInsight.sourceIds ?? [];
  const voc = analysis.customerInsight.voc;
  const vocUnitLabel = ({ discussion_thread: "讨论线程", review: "评论", response: "回复", mixed: "混合记录" } as const)[voc?.unit ?? "mixed"];
  const vocBoundary = voc
    ? `当前 ${voc.totalRecords} 个${vocUnitLabel}覆盖 ${voc.channels.length} 个渠道；主题允许一条记录多标签，因此主题计数不能相加为样本总数。${voc.sampleBoundary}`
    : "当前用户证据尚未登记结构化 VOC 口径，不能展示渠道、主题或情绪分布。";
  const decisionLabel = analysis.productDecision.status === "PROCEED_TO_SAMPLE"
    ? "READY_FOR_SOURCING：可以进入受控寻源和买样，但仍不等于允许上架。"
    : analysis.productDecision.status === "HOLD_SUPPLY"
      ? "RESEARCH_MORE：机会值得保留，但正式 SKU、买样和投放都要等关键证据补齐。"
      : "NOT_WORTH_PURSUING：当前证据不支持继续投入。";
  const inline = (value: string) => reportTextZh(value).replace(/[。！？；，,.!?;:\s]+$/u, "");
  const first = (items: string[], fallback: string) => inline(items[0] ?? fallback);
  const second = (items: string[], fallback: string) => inline(items[1] ?? items[0] ?? fallback);
  return [
    {
      code: "market", title: "市场与机会", question: "有没有市场、需求趋势、价格空间、竞争强度。",
      conclusion: `值得继续研究，但不是低竞争、随便打包就能卖的机会。${inline(analysis.marketOpportunity.demand.rationale)}；${inline(analysis.marketOpportunity.competition.rationale)}。可参考的价格结构是：${inline(analysis.competitorInsight.pricePositioning)}。机会窗口是${inline(analysis.marketOpportunity.verdict)}。${decisionLabel}`,
      items: [
        moduleItem(`需求：${reportTextZh(analysis.marketOpportunity.demand.rationale)}`, analysis.marketOpportunity.demand.sourceIds, "fact"),
        moduleItem(`竞争：${reportTextZh(analysis.marketOpportunity.competition.rationale)}`, analysis.marketOpportunity.competition.sourceIds, "fact"),
        moduleItem(`趋势：${reportTextZh(analysis.marketOpportunity.trend.rationale)}`, analysis.marketOpportunity.trend.sourceIds),
        moduleItem(`价格与变现：${reportTextZh(analysis.marketOpportunity.monetization.rationale)}`, analysis.marketOpportunity.monetization.sourceIds),
        moduleItem(`商业含义：如果目标产品只是复制现有大众单品，就会同时承受低价货架和成熟 DTC 套装的双重挤压；差异化必须体现在任务设计、使用边界、套装结构或复购路径上。`, [...new Set([...analysis.marketOpportunity.competition.sourceIds, ...competitorSourceIds])], "directional"),
        moduleItem(`当前动作：只验证一个边界清晰的产品概念和价格带，不先扩成大而全的多配方 SKU。`, analysis.productDecision.sourceIds, "hypothesis"),
        moduleItem("行动验收：补齐至少 12 个月的同口径连续趋势或明确标注的需求代理，并形成同抓取窗口、同包装/购买方式字段的跨渠道价格矩阵；未满足前市场结论保持 RESEARCH_MORE。", [...new Set([...analysis.marketOpportunity.trend.sourceIds, ...analysis.marketOpportunity.monetization.sourceIds])], "hypothesis"),
      ],
      unknowns: unknowns.filter((item) => /market|trend|growth|price|cost|margin|市场|趋势|成本|利润/i.test(item)).map(reportTextZh), updatedAt: at,
    },
    {
      code: "customer", title: "用户画像", question: "谁在买、什么场景触发、最焦虑什么、为什么下单。",
      conclusion: `优先服务${inline(analysis.positioning.targetCustomer)}。典型触发是“${first(analysis.customerInsight.painPoints, "不知道该买什么") }”和“${second(analysis.customerInsight.painPoints, "现有方案太复杂") }”。用户真正购买的不是更多清洁用品，而是${first(analysis.customerInsight.functionalMotives, "更少选择负担") }，以及“${first(analysis.customerInsight.emotionalMotives, "更安心") }”的结果。${vocBoundary}`,
      items: [
        ...claims.filter((claim) => claim.category === "customer").map((claim) => moduleItem(`用户原声证据：${reportTextZh(claim.statement)} ${reportTextZh(claim.evidence)}`, [claim.sourceId], claim.confidence === "High" ? "fact" : "directional")),
        ...(voc?.themes ?? []).map((item) => moduleItem(`VOC 主题：${item.label}（${item.count}/${voc?.totalRecords ?? 0} 个${vocUnitLabel}涉及；允许多标签）`, item.sourceIds, "directional")),
        ...(voc?.scenarios ?? []).map((item) => moduleItem(`触发场景：${item.label}（${item.count}/${voc?.totalRecords ?? 0} 个${vocUnitLabel}涉及）`, item.sourceIds, "directional")),
        ...analysis.customerInsight.painPoints.map((item) => moduleItem(`焦虑：${reportTextZh(item)}`, customerSourceIds, "fact")),
        ...analysis.customerInsight.functionalMotives.map((item) => moduleItem(`下单理由：${reportTextZh(item)}`, customerSourceIds, "directional")),
        ...analysis.customerInsight.emotionalMotives.map((item) => moduleItem(`情绪动机：${reportTextZh(item)}`, customerSourceIds, "directional")),
        moduleItem(`反向证据：用户想减少产品数量，但不同污渍、材质和卫生区域又需要不同边界；“万能一瓶”可能降低复杂度，也可能放大误用和清洁失败。`, claimSourceIds("customer"), "directional"),
        moduleItem(`当前动作：用两版概念测试区分“工具与任务指南优先”与“工具加经验证配方”，观察用户是否愿意为减少选择负担支付溢价。`, customerSourceIds, "hypothesis"),
        moduleItem("行动验收：15 名目标用户中至少 12 人能正确复述产品分工、至少 9 人能在五个任务中选对方案、至少 5 人在目标价带表达明确购买意向；否则回到用户任务与产品定义。", customerSourceIds, "hypothesis"),
      ],
      unknowns: [
        ...(voc?.gaps ?? ["尚未登记结构化 VOC 渠道、主题和情绪口径。"]),
        "公开用户反馈只能支持定性判断；真实销量、搜索量、转化率、退货率和用户问题发生率仍需平台数据或结构化调研复核。",
      ],
      voc,
      updatedAt: at,
    },
    {
      code: "competitor", title: "竞品分析", question: "谁在卖、靠什么吸引点击、靠什么建立信任、靠什么成交。",
      conclusion: `成熟竞品卖的不是一瓶普通清洁剂，而是一条完整转化链：用“${inline(analysis.competitorInsight.homepageMessaging)}”吸引点击，用${inline(analysis.competitorInsight.socialProof)}建立信任，再通过${inline(analysis.competitorInsight.bundleStrategy)}提高首单和复购。公开价格结构为${inline(analysis.competitorInsight.pricePositioning)}。我们的可切入点不是更便宜，而是把任务分工、误用边界和首次起步体验做得更清楚；但竞品真实转化率和退货率仍未知。`,
      items: [
        moduleItem(`点击钩子：${reportTextZh(analysis.competitorInsight.homepageMessaging)}`, competitorSourceIds, "fact"),
        moduleItem(`信任机制：${reportTextZh(analysis.competitorInsight.socialProof)}`, competitorSourceIds, "fact"),
        moduleItem(`成交方式：${inline(analysis.competitorInsight.cta)}；${inline(analysis.competitorInsight.bundleStrategy)}。`, competitorSourceIds, "fact"),
        moduleItem(`价格结构：${reportTextZh(analysis.competitorInsight.pricePositioning)}`, competitorSourceIds, "fact"),
        moduleItem(`SKU 与套装结构：${reportTextZh(analysis.competitorInsight.skuSummary)}`, competitorSourceIds, "directional"),
        moduleItem(`竞品弱点：${inline(analysis.competitorInsight.reviews)}。因此不能只凭评论数量判断哪个卖点真正带来购买或复购。`, competitorSourceIds, "directional"),
        moduleItem(`当前动作：拆解竞品的首屏、证明、套装、订阅与售后五个环节；概念测试时只比较我们能否更快解释“买哪些、怎么用、什么不能混用”。`, competitorSourceIds, "hypothesis"),
        moduleItem("行动验收：至少用 3 个成熟 DTC 系统品牌和 2 个大众渠道价格锚点完成同口径对照，保留抓取时间、包装数量、一次性/订阅价格、运费与缺失字段；口径不一致时不得排竞品优劣。", competitorSourceIds, "hypothesis"),
      ],
      unknowns: ["第一轮已完成品牌官网、零售商品页和价格路径核查；各竞品 SKU 的真实销量、转化率、退货率与连续价格历史仍需平台数据或第三方付费面板。"], updatedAt: at,
    },
    {
      code: "product", title: "产品方案", question: "应该做成什么样、必要产品要求、寻源关键词、不能踩的坑。",
      conclusion: `建议先做一个边界清晰的最小产品系统：${inline(analysis.positioning.coreSellingPoint)}。优先人群是${inline(analysis.positioning.targetCustomer)}；测试价带为${inline(analysis.positioning.recommendedPriceRange)}；必须具备${analysis.positioning.differentiation.slice(0, 3).map(inline).join("、")}。不要一开始同时开发多种化学配方，也不要使用未经目标 SKU 文件支持的消毒、无毒或环保功效宣称。${decisionLabel}`,
      items: [
        moduleItem(`目标用户：${reportTextZh(analysis.positioning.targetCustomer)}`, analysis.productDecision.sourceIds, "directional"),
        moduleItem(`建议形态：工具与任务指南优先的最小起步套装；化学品只保留经用户测试和合规复核后确有必要的少数任务配方。`, analysis.productDecision.sourceIds, "hypothesis"),
        moduleItem(`测试价格：${reportTextZh(analysis.positioning.recommendedPriceRange)}`, analysis.marketOpportunity.monetization.sourceIds, "hypothesis"),
        ...analysis.positioning.differentiation.map((item) => moduleItem(`产品要求：${reportTextZh(item)}`, analysis.productDecision.sourceIds, "hypothesis")),
        moduleItem(`寻源起点：${reportTextZh(analysis.competitorInsight.skuSummary)}`, claimSourceIds("supplier"), "directional"),
        moduleItem(`寻源关键词：中文可用“厨卫清洁起步套装、分区清洁工具套装、无香清洁浓缩液、厕所专用清洁套装”；英文可用“kitchen bathroom cleaning starter kit、color-coded cleaning tool set、fragrance-free cleaning concentrate、toilet cleaning kit”。`, claimSourceIds("supplier"), "hypothesis"),
        moduleItem(`供应商必问：MOQ 与阶梯价、样品费、交期、配方权属、SDS/成分披露、标签支持、稳定性测试、包材兼容、泄漏/运输方案和批次质量控制。`, claimSourceIds("supplier"), "hypothesis"),
        moduleItem("行动验收：取得至少 3 份同口径正式报价和对应样品/文件，且目标配方、标签、SDS 与样品批次一致；任一关键文件不匹配时不升级到买样或正式 SKU。", [...claimSourceIds("supplier"), ...claimSourceIds("regulation")], "hypothesis"),
        ...claims.filter((claim) => claim.category === "regulation").map((claim) => moduleItem(`不能踩的坑：${reportTextZh(claim.statement)} ${reportTextZh(claim.evidence)}`, [claim.sourceId], claim.confidence === "High" ? "fact" : "directional")),
      ],
      unknowns: unknowns.filter((item) => /supplier|sku|model|material|moq|quote|供应|型号|材料|报价/i.test(item)).map(reportTextZh), updatedAt: at,
    },
    {
      code: "marketing", title: "营销打法", question: "核心价值主张、广告钩子、内容素材、可说与不可说。",
      conclusion: `核心价值主张不是“清洁力更强”，而是“${inline(translation?.valueProposition ?? analysis.positioning.coreSellingPoint)}”。第一批内容应围绕三类可视化证明：用户原本买得太多、分区后能快速选对工具和配方、使用地图明确哪些表面能用和不能混用。现阶段只能做概念素材测试；任何消毒、无毒、环保、宠物安全或材料兼容宣称，都必须等目标配方和文件逐条支持。`,
      items: [
        ...(translation?.messagePillars ?? []).map((item) => moduleItem(`可测试表达：${item.marketingCopy}`, item.supportingClaimIds, item.evidenceStatus === "supported" ? "fact" : item.evidenceStatus === "hypothesis" ? "hypothesis" : "directional")),
        ...(translation?.prohibitedClaims ?? []).map((item) => moduleItem(`不可说：${item.claim}。${item.reason}`, [], "unknown")),
        ...(!translation ? [
          moduleItem(`广告钩子 A：别再为每个污渍买一瓶——${reportTextZh(analysis.positioning.coreSellingPoint)}`, analysis.productDecision.sourceIds, "hypothesis"),
          moduleItem(`广告钩子 B：先告诉你什么该用、什么不能混用，再谈清洁效果。`, [...claimSourceIds("customer"), ...claimSourceIds("regulation")], "hypothesis"),
          moduleItem(`内容素材 1：拍摄杂乱清洁柜到按厨房、浴室、厕所分区收纳的前后对比。`, customerSourceIds, "hypothesis"),
          moduleItem(`内容素材 2：用五个真实清洁任务演示选择工具、查看表面边界、完成清洁和补充耗材。`, analysis.productDecision.sourceIds, "hypothesis"),
          moduleItem(`内容素材 3：公开展示使用地图、禁用清单、SDS/标签来源和补充周期，而不是只做情绪化“绿色”表达。`, claimSourceIds("regulation"), "hypothesis"),
          ...analysis.positioning.differentiation.map((item) => moduleItem(`内容方向：${reportTextZh(item)}`, analysis.productDecision.sourceIds, "hypothesis")),
          moduleItem("上线前禁用：把竞品性能、认证、评论或公开市场证据外推为目标 SKU 已验证事实。", claimSourceIds("regulation"), "unknown"),
        ] : []),
        moduleItem("行动验收：在同一流量口径下比较两套钩子与对应素材；只有主指标相对对照组改善、用户能正确理解产品边界且没有触发禁用宣称，才保留胜出表达。", [...analysis.productDecision.sourceIds, ...claimSourceIds("regulation")], "hypothesis"),
      ],
      unknowns: (translation?.usageBoundaries ?? ["当前只允许概念测试，不允许把竞品认证、性能或评论外推为目标 SKU 宣传。", "需用目标 SKU 的认证文件、安装实测和样品测试结果逐条升级 Claim。"]).map(reportTextZh), updatedAt: at,
    },
    {
      code: "validation", title: "验证方案", question: "买什么样品、测试什么、成本红线、通过和停止条件。",
      conclusion: `先过四道闸门再决定是否买样：概念闸门验证用户是否理解并愿意付费，供应闸门取得至少三份同口径报价和文件，产品闸门验证任务成功率、误用和材质安全，经济性闸门把获客、退款、补发、客服和退货全部计入。任一关键合规文件不一致、出现不可接受的误用/材料损伤，或压力情景下期望贡献利润不为正，都立即停止。${inline(analysis.actionBoundary.reason)}。`,
      items: [
        ...analysis.productDecision.rationale.map((item) => moduleItem(reportTextZh(item), analysis.productDecision.sourceIds, "directional")),
        moduleItem("行动验收：概念、供应、产品安全和经济性四道闸门必须分别留下样本、记录、文件与计算表；任何一道未通过都只允许继续补证，不升级商业状态。", [...analysis.productDecision.sourceIds, ...claimSourceIds("supplier"), ...claimSourceIds("regulation")], "hypothesis"),
        ...(translation?.validationExperiments ?? []).map((item) => moduleItem(`${item.name}：通过 ${item.passThreshold}；停止 ${item.stopCondition}`, [], "hypothesis")),
        ...(!translation ? [
          moduleItem("概念测试：招募 15 名目标用户，对比“工具与任务指南版”和“工具加少数配方版”；不解释产品，让用户完成理解、选择和价格判断。", customerSourceIds, "hypothesis"),
          moduleItem("概念通过线：至少 12/15 能正确复述产品分工，至少 9/15 能在五个任务中选对方案，至少 5/15 在目标价带表达明确购买意向；否则回到产品定义。", customerSourceIds, "hypothesis"),
          moduleItem("买样矩阵：A=最小工具版，B=核心差异化版，C=成熟竞品对照；每个候选至少比较两个独立供应来源，记录批次和文件。", claimSourceIds("supplier"), "hypothesis"),
          moduleItem("产品测试：覆盖五个高频任务、三类常见材质和厨房/浴室/厕所分区；任务完成率需达到 80%，关键误混用、交叉污染提示遗漏和材料损伤为 0。", [...customerSourceIds, ...claimSourceIds("regulation")], "hypothesis"),
          moduleItem("供应闸门：至少取得三份同口径正式报价、MOQ、样品、交期和质量文件，再决定是否买样。", claimSourceIds("supplier"), "hypothesis"),
          moduleItem("合规闸门：按目标配方、标签和拟用宣称复核监管要求；未完成前不得迁移竞品 Claim。", claimSourceIds("regulation"), "unknown"),
          moduleItem("经济性通过线：基础情景贡献毛利率目标不低于 25%；当 CAC、退款和补发成本同时恶化 20% 时，单笔期望贡献利润仍须大于 0。达不到则降复杂度、调价格或停止。", [], "hypothesis"),
          moduleItem("立即停止：供应文件与样品不一致；配方/标签无法满足适用监管；用户频繁误用或出现材料损伤；压力情景贡献利润不为正。", [...claimSourceIds("supplier"), ...claimSourceIds("regulation")], "unknown"),
        ] : []),
      ],
      unknowns: ["样品测试记录、正式报价、完整履约成本和退货假设尚未回填，因此仍不能上架或投广告。", "关键结论仍应继续跨平台、跨来源三角验证。", ...unknowns.map(reportTextZh)], updatedAt: at,
    },
  ];
};

export const syncWhiteboardFromResearch = async (
  discoveryId: string,
  evidencePackage: EvidencePackage,
  claims: ResearchClaim[],
  analysis: LiveResearchAnalysis,
  now = new Date(),
): Promise<ResearchWhiteboard> => {
  const current = await readResearchWhiteboard(discoveryId);
  const at = now.toISOString();
  const queriesPath = path.join(evidencePackage.packagePath, "search_log.json");
  const queryLog = await access(queriesPath).then(async () => {
    const parsed = JSON.parse(await readFile(queriesPath, "utf8")) as { queries?: Array<{ id?: string; query?: string; keptSourceIds?: string[] }> };
    return parsed.queries ?? [];
  }).catch(() => []);
  const laneQueryPatterns: Record<"market" | "customer" | "competitor" | "supply" | "compliance", RegExp> = {
    market: /\bmarket\b|trend|price|pricing|demand|category|市场|趋势|价格|需求/i,
    customer: /review|reddit|complaint|customer|buyer|voc|评论|用户|买家|痛点/i,
    competitor: /brand|competitor|official price|product page|home depot|品牌|竞品|商品页/i,
    supply: /supplier|manufacturer|wholesale|alibaba|factory|供应商|工厂|批发|货盘/i,
    compliance: /nsf|ansi|standard|certif|regulation|compliance|标准|认证|法规|合规/i,
  };
  const laneQueries = Object.fromEntries(Object.entries(laneQueryPatterns).map(([code, pattern]) => [
    code,
    queryLog.filter((query) => pattern.test(query.query ?? "")),
  ])) as Record<keyof typeof laneQueryPatterns, typeof queryLog>;
  const laneDataTypes: Record<keyof typeof laneQueryPatterns, string> = {
    market: "价格、品牌与品类结构",
    customer: "评论与社区 VOC",
    competitor: "商品页与成交路径",
    supply: "供应候选核查",
    compliance: "标准与官方目录",
  };
  const groups: Record<"market" | "customer" | "competitor" | "supply" | "compliance", ResearchSource[]> = {
    market: evidencePackage.sources.filter((source) => source.sourceType === "market" && !source.id.startsWith("SRC-VOC-")),
    customer: evidencePackage.sources.filter((source) =>
      source.id.includes("VOC")
      || /reddit\.com|walmart\.com\/reviews/i.test(source.url)
      || claims.some((claim) => claim.category === "customer" && claim.sourceId === source.id)),
    competitor: evidencePackage.sources.filter((source) => source.sourceType === "competitor"),
    supply: evidencePackage.sources.filter((source) => source.sourceType === "supplier"),
    compliance: evidencePackage.sources.filter((source) => source.sourceType === "regulation"),
  };
  const stages = { ...current.stages };
  for (const [code, sources] of Object.entries(groups) as Array<[keyof typeof groups, ResearchSource[]]>) {
    const effectiveRecordCount = Math.max(
      stages[code].recordCount,
      claims.filter((claim) => sources.some((source) => source.id === claim.sourceId)).length,
    );
    stages[code] = {
      ...stages[code], status: "complete", queryCount: laneQueries[code].length || (sources.length ? 1 : 0), sourceCount: sources.length,
      recordCount: effectiveRecordCount,
      summary: `本轮完成 ${laneQueries[code].length || (sources.length ? 1 : 0)} 组${code === "supply" || code === "compliance" ? "核查" : "查询"}，保留 ${sources.length} 个来源与 ${effectiveRecordCount} 条有效记录。`,
      queryLabels: (laneQueries[code].length ? laneQueries[code].map((query) => query.query).filter((item): item is string => Boolean(item)) : [laneDataTypes[code]]),
      dataType: laneDataTypes[code],
      sources: sources.map((source) => ({ id: source.id, label: source.title, url: source.url, kind: sourceKind(source), status: sourceStatus(source) })), updatedAt: at,
    };
  }
  const reportModules = buildWhiteboardReportModules(analysis, claims, now).map((module) => {
    if (module.code !== "customer") return module;
    const additionalCommunitySources = evidencePackage.sources
      .filter((source) => /reddit\.com/i.test(source.url))
      .map((source) => source.id);
    return {
      ...module,
      items: module.items.map((item) => ({
        ...item,
        sourceIds: [...new Set([...item.sourceIds, ...additionalCommunitySources])],
      })),
    };
  });
  stages.synthesis = { ...stages.synthesis, status: "complete", sourceCount: evidencePackage.sources.length, recordCount: claims.length, summary: "已把市场、用户、竞品、供应与合规证据整理为六大选品结论。", updatedAt: at };
  for (const reportModule of reportModules) {
    const code = `${reportModule.code}_report` as ResearchWhiteboardStageCode;
    stages[code] = { ...stages[code], status: "complete", sourceCount: new Set(reportModule.items.flatMap((item) => item.sourceIds)).size, recordCount: reportModule.items.length, summary: reportModule.conclusion, updatedAt: at };
  }
  stages.execution = { ...stages.execution, status: "complete", summary: "后续新增评论、价格、API 数据、供应商回复或样品结果时，以新证据批次回流并生成新版本。", updatedAt: at };
  const next = researchWhiteboardSchema.parse({
    ...current, researchRunId: evidencePackage.manifest.researchRunId, status: "completed", updatedAt: at, stages, reportModules,
    activity: [...current.activity, { id: `report-${now.getTime()}`, at, stage: "execution", status: "complete", message: "六大模块白板报告已生成，所有结论保留来源与缺口。" }].slice(-60),
  });
  await writeFile(researchWhiteboardPath(discoveryId), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
};
