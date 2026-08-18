import type { ResearchWhiteboardReportModule, ResearchWhiteboardSource } from "./types";

export type ReportScoreDimension = {
  label: string;
  weight: number;
  score: number;
  note: string;
  rule: string;
  fullScoreRequirement: string;
  missingToFull: string;
};

export type ReportScorecard = {
  total: number;
  grade: string;
  dimensions: ReportScoreDimension[];
  priority: string;
  formula: string;
  missingPoints: number;
};

const moduleText = (modules: ResearchWhiteboardReportModule[], code: ResearchWhiteboardReportModule["code"]): string => {
  const reportModule = modules.find((item) => item.code === code);
  return [reportModule?.conclusion, ...(reportModule?.items.map((item) => item.text) ?? []), ...(reportModule?.unknowns ?? [])].filter(Boolean).join(" ");
};

export const buildReportScorecard = (
  modules: ResearchWhiteboardReportModule[],
  sources: ResearchWhiteboardSource[],
): ReportScorecard => {
  const allText = modules.map((module) => moduleText(modules, module.code)).join(" ");
  const market = moduleText(modules, "market");
  const customer = moduleText(modules, "customer");
  const competitor = moduleText(modules, "competitor");
  const product = moduleText(modules, "product");
  const validation = moduleText(modules, "validation");
  const verifiedSources = sources.filter((source) => source.status === "verified").length;
  const sourceKinds = new Set(sources.filter((source) => source.status === "verified").map((source) => source.kind));
  const hasMarketTimeSeries = /时间序列|Google Trends.*(?:数值|指数)|同比|月度趋势/i.test(market)
    && !/待补|未取得|无法复核|没有.*时间序列/i.test(market);
  const hasEconomics = /已取得正式报价|已核验到岸成本|已完成单位经济/i.test(allText)
    && /毛利.*(?:达到|高于|为)|贡献毛利/i.test(allText)
    && !/未知|待补|尚未/i.test(allText.match(/.{0,40}(?:到岸成本|毛利|平台费).{0,70}/g)?.join(" ") ?? "");
  const hasExecutableValidation = /概念闸门|供应闸门|合规闸门|经济性闸门|通过|停止|样品/i.test(validation);
  const hasDemandProxy = /销量|订单|榜单|需求代理|评分|ratings?|货架/i.test(market);
  const hasPublicCostProxy = /阶梯.*(?:报价|成本)|供应.*成本代理|公开.*成本/i.test(allText);
  const hasProductPriority = /优先|任务架构|产品要求|SKU 与套装结构/i.test(product + competitor);
  const hasStructuredVoc = sourceKinds.has("community") && /焦虑|下单理由|痛点|动机/i.test(customer);
  const hasOfficialProductEvidence = sourceKinds.has("official") && /目标 SKU|配方|标签|宣称|认证|法规/i.test(product + validation);
  const hasCrossPlatformMatrix = /跨平台|Walmart|Target|品牌官网|零售商品页/i.test(market + competitor);
  const dimension = (
    label: string,
    weight: number,
    score: number,
    note: string,
    rule: string,
    fullScoreRequirement: string,
    missingToFull: string,
  ): ReportScoreDimension => ({ label, weight, score, note, rule, fullScoreRequirement, missingToFull });
  const dimensions: ReportScoreDimension[] = [
    dimension("决策结论质量", 15, hasProductPriority && /不能上架|不适合.*上架|受控买样|继续补证/i.test(allText) ? 13 : /不能上架|不适合.*上架|受控买样|继续补证/i.test(allText) ? 12 : 8, "是否明确回答做不做、优先验证什么、为什么以及动作边界。", "基础结论 8 分；明确动作边界 12 分；加入产品优先级 13 分。", "用正式成本、样品实测和合规一致性结果，把最终进入/停止条件闭环。", "缺正式成本、样品实测与合规一致性闭环。"),
    dimension("证据可追溯性", 15, Math.min(14, 7 + Math.floor(verifiedSources / 5) + Math.min(2, sourceKinds.size - 1)), `${verifiedSources} 个已核验来源，覆盖 ${sourceKinds.size} 类信源。`, "7 分基础分 + 每 5 个已核验来源 1 分 + 多信源类型最多 2 分；当前封顶 14 分。", "所有关键结论完成逐条 Claim–Source 映射、采集时间与反证核验。", "缺关键结论逐条映射完整性审计。"),
    dimension("市场需求与趋势", 10, hasMarketTimeSeries ? 9 : hasDemandProxy ? 7 : 5, hasMarketTimeSeries ? "已有可复核趋势序列。" : hasDemandProxy ? "已有需求与零售信号；连续趋势序列仍待补。" : "需求有方向性依据，但缺可复核的大盘与趋势序列。", "需求依据 5 分；可比较需求信号 7 分；可复核连续趋势 9 分。", "补齐同口径的完整连续趋势，并与类目大盘交叉验证。", "缺完整连续趋势与类目大盘交叉验证。"),
    dimension("竞争与价格结构", 10, hasCrossPlatformMatrix && hasDemandProxy ? 9 : hasDemandProxy && /套装|订阅|价格|补充/i.test(competitor) ? 8 : /套装|订阅|价格|补充/i.test(competitor) ? 7 : 4, hasCrossPlatformMatrix ? "已形成跨平台价格与结构对照并保留数据边界。" : hasDemandProxy ? "已覆盖竞争结构与公开需求信号。" : "已覆盖竞争路径与公开价格结构，仍缺销量代理。", "竞争路径 4 分；价格结构 7 分；需求信号 8 分；跨平台对照 9 分。", "补齐主要方案的连续价格历史、促销频率与库存变化。", "缺连续价格历史与促销/库存变化。"),
    dimension("VOC 与用户问题", 10, hasStructuredVoc ? 6 : 4, hasStructuredVoc ? "已有社区讨论和结构化痛点，但样本代表性仍有限。" : "已有基础用户问题，仍缺结构化 VOC。", "基础用户问题 4 分；跨来源结构化社区样本 6 分；可计算主题发生率 8 分。", "增加更多独立平台、时间分层和可计算的主题发生率基线。", "缺更广泛独立样本及主题发生率基线。"),
    dimension("产品机会与差异化", 10, hasProductPriority && /产品要求|任务|边界|寻源/i.test(product) ? 8 : /产品要求|任务|边界|寻源/i.test(product) ? 7 : 4, hasProductPriority ? "已形成产品验证优先级和差异化方向，目标 SKU 规格仍需样品确认。" : "差异化方向已形成，目标 SKU 规格仍需样品和文件确认。", "机会方向 4 分；产品/合规/寻源要求 7 分；验证优先级 8 分。", "用目标 SKU 样品测试确认任务适配、材料、性能与文件一致性。", "缺目标 SKU 规格和样品实测确认。"),
    dimension("商业可行性", 10, hasEconomics ? 9 : hasPublicCostProxy ? 6 : 4, hasEconomics ? "成本、毛利和风险已形成闭环。" : hasPublicCostProxy ? "已有公开阶梯成本代理，可做粗算；正式到岸经济仍未闭环。" : "正式报价、到岸成本、平台费和退货率仍未闭环。", "基础经济假设 4 分；公开成本代理 6 分；正式单位经济闭环 9 分。", "取得正式 RFQ、MOQ、运费、关税、平台费、广告成本和退货率，完成敏感性测算。", "缺正式报价及完整单位经济敏感性测算。"),
    dimension("供应链、合规与风险", 8, hasOfficialProductEvidence && hasPublicCostProxy && sourceKinds.has("supplier") ? 8 : hasPublicCostProxy && sourceKinds.has("supplier") && sourceKinds.has("official") ? 7 : sourceKinds.has("supplier") && sourceKinds.has("official") ? 6 : 4, hasOfficialProductEvidence ? "已有供应候选和官方规则，目标 SKU 文件一致性仍待核。" : "已有供应或合规线索，尚未证明目标 SKU 文件一致性。", "供应或合规单侧 4 分；两侧覆盖 6 分；成本线索 7 分；目标产品文件核验 8 分。", "目标 SKU、供应商文件、配方、标签和宣传声明逐项一致。", "缺目标 SKU 配方、标签与供应文件精确核验。"),
    dimension("未知项与反证", 5, modules.some((module) => module.unknowns.length > 0) ? 5 : 2, "关键未知项保持显式，不用分数掩盖缺口。", "显式保留未知项、反证和证据边界得 5 分；全部隐藏仅 2 分。", "持续保留未知项和反证，不把假设包装成事实。", modules.some((module) => module.unknowns.length > 0) ? "该维度已满分。" : "需要显式列出未知项与反证。"),
    dimension("下一步验证计划", 5, hasExecutableValidation && hasProductPriority ? 5 : hasExecutableValidation ? 4 : 2, hasExecutableValidation && hasProductPriority ? "已给出验证优先级、闸门和停止条件。" : hasExecutableValidation ? "已给出验证闸门和停止条件。" : "验证方向存在，但执行阈值不足。", "方向性计划 2 分；可执行闸门 4 分；加入优先级与停止条件 5 分。", "保持概念、供应、合规与经济性闸门可执行。", hasExecutableValidation && hasProductPriority ? "该维度已满分。" : "缺验证优先级或明确停止条件。"),
    dimension("时间与操作成本", 2, /预算|天|时间|成本红线/i.test(validation) ? 1 : 0, "仍需回填实际预算、等待时间和人工投入。", "出现预算、时间或成本红线得 1 分；三者均量化得 2 分。", "填写每一步预算、等待天数、人工投入和总成本红线。", "缺完整预算、周期和人工投入量化。"),
  ];
  const total = dimensions.reduce((sum, item) => sum + Math.min(item.weight, item.score), 0);
  return {
    total,
    grade: total >= 85 ? "可进入投入决策" : total >= 70 ? "可进入强化验证" : total >= 55 ? "可进入受控买样" : "继续研究",
    dimensions,
    formula: "总分 = 各维度得分之和；每个维度得分不超过该维度权重，满分共 100 分。分数只衡量报告证据与决策完整度，不预测销量或成功率。",
    missingPoints: 100 - total,
    priority: hasDemandProxy && hasPublicCostProxy
      ? "优先向目标产品的供应候选发同口径 RFQ，闭环成本与文件一致性。"
      : hasMarketTimeSeries && hasEconomics
      ? "优先完成目标 SKU 样品与认证一致性验证。"
      : "优先补齐需求趋势、价格历史与正式成本数据。",
  };
};
