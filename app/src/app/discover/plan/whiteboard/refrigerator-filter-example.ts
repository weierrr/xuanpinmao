import type { OpportunityDiscoveryPlan } from "@/opportunity-discovery/types";
import type {
  ResearchWhiteboard,
  ResearchWhiteboardReportModule,
  ResearchWhiteboardSource,
  ResearchWhiteboardStageCode,
} from "@/research-whiteboard/types";

export const refrigeratorFilterExampleDiscoveryId = "discovery-refrigerator-water-filter-demo-us";
export const legacyYogaExampleDiscoveryId = "discovery-3d-yoga-pants-999d4e8e5cc2-us";

const updatedAt = "2026-08-12T08:00:00.000Z";

export const refrigeratorFilterExamplePlan: OpportunityDiscoveryPlan = {
  schemaVersion: "1.0",
  discoveryId: refrigeratorFilterExampleDiscoveryId,
  mode: "CATEGORY_OPPORTUNITY_DISCOVERY",
  categoryKeyword: "refrigerator water filter replacement",
  targetMarket: "US",
  targetAudience: "需要为家用冰箱定期更换饮水滤芯、同时关注兼容性与认证信息的美国家庭",
  salesChannel: "independent DTC / Amazon US（演示）",
  imageUrls: [],
  competitorUrls: [
    "https://www.everydropwater.com/",
    "https://www.lg.com/us/refrigerator-filters",
  ],
  referenceUrls: [
    "https://www.nsf.org/consumer-resources/water-quality/water-filters-testing-treatment/standards-water-treatment-systems",
  ],
  coverageTargets: {
    minimumBrands: 8,
    minimumAsins: 20,
    maximumAsins: 40,
    minimumValidReviews: 300,
    minimumRedditThreads: 10,
    minimumPriceBands: 3,
  },
  queryGroups: {
    amazonCategoryDiscovery: [
      "Amazon US refrigerator water filter replacement best sellers",
      "refrigerator water filter compatibility one star reviews",
      "refrigerator filter leaking bad taste reviews",
      "OEM vs compatible refrigerator filter price comparison",
    ],
    redditDemandDiscovery: [
      "site:reddit.com refrigerator water filter replacement problems",
      "site:reddit.com OEM vs generic refrigerator filter",
      "site:reddit.com refrigerator filter bad taste leak",
      "site:reddit.com refrigerator water filter compatibility",
    ],
    independentReviewDiscovery: [
      "refrigerator water filter independent certification lookup",
      "refrigerator filter replacement compatibility complaints",
      "refrigerator water filter flow rate review",
    ],
    alternativeAndWorkaroundDiscovery: [
      "refrigerator water filter bypass alternative",
      "refrigerator filter subscription replacement reminder",
      "whole house filter vs refrigerator filter",
    ],
  },
  stages: [
    { code: "CATEGORY_MAP", title: "建立型号与兼容关系", output: "冰箱品牌、原厂型号、替代型号和价格带" },
    { code: "VOC_COLLECTION", title: "收集用户之声", output: "兼容、漏水、流速、味道与更换体验" },
    { code: "CERTIFICATION_CHECK", title: "核查认证与声明", output: "认证主体、标准范围和可使用的宣传边界" },
    { code: "NEED_CLUSTERING", title: "聚类未满足需求", output: "购买焦虑、失败成本、替代方案与反证" },
    { code: "CONCEPT_GENERATION", title: "生成候选商品概念", output: "有证据边界的型号组合与服务方案" },
    { code: "RESEARCH_HANDOFF", title: "形成买样验证计划", output: "样品、安装、流速、密封和实验室文件核验" },
  ],
  decisionGuardrails: [
    "兼容列表必须精确到冰箱或原厂滤芯型号，不能只写适配某品牌。",
    "只有可核验的认证主体、产品型号和标准范围，才能用于认证宣传。",
    "品牌页面和供应商页面不能证明目标样品的过滤性能或寿命。",
    "公开价格只能用于建立价格带，不能替代正式成本与利润核算。",
    "样品未通过安装、密封、流速与文件核验前，不得给出上架结论。",
  ],
  createdAt: updatedAt,
};

const sources: ResearchWhiteboardSource[] = [
  { id: "RF-SRC-001", label: "NSF：饮用水处理系统相关标准说明", url: "https://www.nsf.org/consumer-resources/water-quality/water-filters-testing-treatment/standards-water-treatment-systems", kind: "official", status: "verified" },
  { id: "RF-SRC-002", label: "EveryDrop 冰箱滤芯官网", url: "https://www.everydropwater.com/", kind: "competitor", status: "verified" },
  { id: "RF-SRC-003", label: "LG 美国冰箱滤芯页面", url: "https://www.lg.com/us/refrigerator-filters", kind: "competitor", status: "verified" },
  { id: "RF-SRC-004", label: "Reddit：是否必须购买原厂冰箱滤芯", url: "https://www.reddit.com/r/BuyItForLife/comments/1e2azo9/do_i_need_to_use_oem_water_filters_in_my_fridge/", kind: "community", status: "verified" },
  { id: "RF-SRC-005", label: "Reddit：第三方冰箱滤芯是否值得购买", url: "https://www.reddit.com/r/Frugal/comments/17u1625/is_it_a_bad_idea_to_buy_refrigerator_water/", kind: "community", status: "verified" },
  { id: "RF-SRC-006", label: "Reddit：冰箱饮水味道异常讨论", url: "https://www.reddit.com/r/Appliances/comments/op0thx/this_refrigerator_was_just_purchased_2_weeks_ago/", kind: "community", status: "verified" },
  { id: "RF-SRC-007", label: "Reddit：LT1000P 卡口变化与兼容问题", url: "https://www.reddit.com/r/Appliances/comments/1mcjey2/lg_changed_the_notch_design_for_lt1000p_filters/", kind: "community", status: "verified" },
  { id: "RF-SRC-008", label: "EPA：家庭饮用水基础信息", url: "https://www.epa.gov/ground-water-and-drinking-water/basic-information-about-your-drinking-water", kind: "official", status: "verified" },
  { id: "RF-SRC-009", label: "供应商候选与正式文件待核验", url: "https://www.alibaba.com/showroom/refrigerator-water-filter.html", kind: "supplier", status: "candidate" },
];

const sourceByStage: Partial<Record<ResearchWhiteboardStageCode, ResearchWhiteboardSource[]>> = {
  market: [sources[1], sources[2]],
  customer: [sources[3], sources[4], sources[5], sources[6]],
  competitor: [sources[1], sources[2]],
  supply: [sources[8]],
  compliance: [sources[0], sources[7]],
};

const stageSummary: Record<ResearchWhiteboardStageCode, string> = {
  scope: "已确认演示对象：美国市场冰箱饮水滤芯替换件。",
  market: "公开页面显示这是按型号匹配、周期性更换的成熟配件品类；当前未使用销量数据推断市场规模。",
  customer: "公开讨论主要集中在型号兼容、是否漏水、流速、异味和原厂与第三方产品的信任取舍。",
  competitor: "竞品通过型号查找、认证信息、减少物质清单和更换提醒降低购买不确定性。",
  supply: "已形成供应候选语言，但正式报价、认证文件和目标样品一致性仍待核验。",
  compliance: "过滤性能声明必须绑定可核验的认证、具体型号和适用标准，不能把供应商自述直接用于广告。",
  synthesis: "已把兼容性、体验风险、竞品路径、供应与认证边界整理为六大选品结论。",
  market_report: "有稳定替换需求，但属于成熟且高度型号化的品类；机会不在泛化宣传，而在兼容准确、文件透明和降低安装失败成本。",
  customer_report: "核心用户不是主动追新的人，而是滤芯到期、出水异常或需要降低替换成本的冰箱用户。",
  competitor_report: "成交关键是让用户先确认买对，再相信过滤声明，最后用套装、订阅或提醒减少下次购买摩擦。",
  product_report: "先聚焦少量高明确度型号，建立防错配、密封和文件核验能力，不做覆盖全品牌的泛兼容产品。",
  marketing_report: "把型号查找、安装演示、认证文件和更换提醒作为主要内容，不使用未经目标型号支持的污染物去除承诺。",
  validation_report: "可以进入受控买样，但样品必须通过卡口、密封、流速、冲洗后味道和认证文件一致性核验。",
  execution: "后续加入正式报价、样品结果和更多评论时，以新证据批次更新受影响的结论。",
};

const stageCodes: ResearchWhiteboardStageCode[] = [
  "scope", "market", "customer", "competitor", "supply", "compliance", "synthesis",
  "market_report", "customer_report", "competitor_report", "product_report", "marketing_report",
  "validation_report", "execution",
];

const exampleQueryCounts: Partial<Record<ResearchWhiteboardStageCode, number>> = {
  market: 12,
  customer: 16,
  competitor: 10,
  supply: 8,
  compliance: 9,
};

const reportModules: ResearchWhiteboardReportModule[] = [
  {
    code: "market", title: "市场与机会", question: "有没有市场、需求趋势、价格空间、竞争强度。",
    conclusion: "这是有周期性替换需求的成熟配件品类，但高度依赖型号与信任。值得继续研究的不是“再做一个通用滤芯”，而是用更准确的兼容关系、透明文件和更低的安装失败成本建立差异。",
    items: [
      { text: "原厂品牌持续维护专门的滤芯与型号页面，说明用户购买路径围绕冰箱或滤芯型号展开。", level: "fact", sourceIds: ["RF-SRC-002", "RF-SRC-003"] },
      { text: "社区讨论反复比较原厂与第三方替换件，价格与可信度之间存在明确取舍。", level: "directional", sourceIds: ["RF-SRC-004", "RF-SRC-005"] },
      { text: "先用 2–3 个型号族验证兼容与复购，再决定是否扩展型号覆盖。", level: "hypothesis", sourceIds: [] },
    ],
    unknowns: ["各型号的真实销量、转化率和退货率", "正式到岸成本、履约费用和可承受获客成本"], updatedAt,
  },
  {
    code: "customer", title: "用户画像", question: "谁在买、什么场景触发、最焦虑什么、为什么下单。",
    conclusion: "用户通常在更换提醒、出水变慢、味道变化或刚接手一台冰箱时被触发。最大的下单焦虑不是功能多少，而是型号会不会装错、装后会不会漏水，以及过滤声明是否可信。",
    items: [
      { text: "公开讨论显示，用户会主动确认是否必须购买原厂件，并担心第三方产品的质量与可信度。", level: "fact", sourceIds: ["RF-SRC-004", "RF-SRC-005"] },
      { text: "味道异常、流速变化和型号卡口变化都会触发求助或更换。", level: "directional", sourceIds: ["RF-SRC-006", "RF-SRC-007"] },
      { text: "更清晰的型号核对与安装防错提示可能比泛化的过滤口号更能降低弃购。", level: "hypothesis", sourceIds: [] },
    ],
    unknowns: ["不同型号用户的主要购买渠道", "更换提醒、套装和订阅的真实接受度"], updatedAt,
  },
  {
    code: "competitor", title: "竞品分析", question: "谁在卖、靠什么吸引点击、靠什么建立信任、靠什么成交。",
    conclusion: "成熟品牌先解决“买哪一个”，再展示认证与减少物质范围，最后通过更换周期、套装和品牌背书完成成交。型号匹配和证据展示本身就是转化链的一部分。",
    items: [
      { text: "品牌官网把产品放在明确的冰箱滤芯目录中，强化按型号选择的购买路径。", level: "fact", sourceIds: ["RF-SRC-002", "RF-SRC-003"] },
      { text: "认证标志不能只作为装饰；需要能追溯到认证主体、产品型号和具体标准。", level: "fact", sourceIds: ["RF-SRC-001"] },
      { text: "独立站可将兼容查找器、安装视频和下一次更换提醒组合为主要差异化。", level: "hypothesis", sourceIds: [] },
    ],
    unknowns: ["竞品真实广告素材和投放规模", "不同价格带的实际转化与退款表现"], updatedAt,
  },
  {
    code: "product", title: "产品方案", question: "应该做成什么样、必要产品要求、寻源关键词与风险。",
    conclusion: "产品方案应从少量明确型号族开始：卡口和尺寸完全匹配、密封稳定、流速可接受，并为每一个过滤声明准备对应文件。包装与页面必须提供防错配核对。",
    items: [
      { text: "必须建立原厂滤芯型号、冰箱型号和目标替换件之间的版本化兼容表。", level: "hypothesis", sourceIds: ["RF-SRC-007"] },
      { text: "供应商候选只能进入样品池，不能代表正式报价、认证有效或批量质量稳定。", level: "directional", sourceIds: ["RF-SRC-009"] },
      { text: "建议寻源词：refrigerator water filter replacement、compatible fridge filter、twist-in refrigerator filter。", level: "hypothesis", sourceIds: [] },
    ],
    unknowns: ["目标供应商的认证证书、产品清单与测试报告", "批次公差、密封材料、额定流量与容量"], updatedAt,
  },
  {
    code: "marketing", title: "营销打法", question: "核心价值主张、广告钩子、内容素材、可说与不可说。",
    conclusion: "核心表达应是“先确认装得上，再确认凭什么可信”。优先展示型号核对、安装过程、冲洗步骤、流速与文件追溯；没有目标型号证据时，不宣传具体污染物去除率。",
    items: [
      { text: "可直接展示：适用型号、安装方法、包装内容和更换提醒机制。", level: "hypothesis", sourceIds: [] },
      { text: "认证相关表达必须严格对应目标产品在认证数据库中的范围。", level: "fact", sourceIds: ["RF-SRC-001"] },
      { text: "“改善味道”也需要区分用户感受、标准范围与目标样品实测，不能混为确定功效。", level: "directional", sourceIds: ["RF-SRC-006"] },
    ],
    unknowns: ["目标样品可合法使用的认证与性能文案", "哪一种内容钩子能带来更高的型号查找完成率"], updatedAt,
  },
  {
    code: "validation", title: "验证方案", question: "买什么样品、测试什么、成本红线、通过和停止条件。",
    conclusion: "先买同一型号族的原厂件与 2–3 个候选替换件做对照。任何无法安装、渗漏、明显影响流速或文件与样品型号不一致的候选件都应立即淘汰。",
    items: [
      { text: "P0：核对卡口、尺寸、O 型圈和安装到位反馈，并进行静置与连续出水漏水测试。", level: "hypothesis", sourceIds: ["RF-SRC-007"] },
      { text: "P0：逐项核验认证主体、产品型号、标准和减少物质范围与供应商文件是否一致。", level: "hypothesis", sourceIds: ["RF-SRC-001"] },
      { text: "P1：记录冲洗前后味道、流速、噪音和使用体验，但不以内部体验测试替代正式性能认证。", level: "hypothesis", sourceIds: ["RF-SRC-006"] },
    ],
    unknowns: ["正式样品费、MOQ、交期和到岸成本", "第三方实验室复核方案与费用"], updatedAt,
  },
];

export const refrigeratorFilterExampleWhiteboard: ResearchWhiteboard = {
  schemaVersion: "1.0",
  discoveryId: refrigeratorFilterExampleDiscoveryId,
  researchRunId: "research-run-refrigerator-filter-demo-us",
  product: "冰箱滤芯调研报告",
  market: "US",
  channel: "独立站 / Amazon US（演示）",
  status: "completed",
  createdAt: updatedAt,
  updatedAt,
  stages: Object.fromEntries(stageCodes.map((code) => {
    const stageSources = sourceByStage[code] ?? [];
    return [code, {
      code,
      status: "complete",
      queryCount: exampleQueryCounts[code] ?? 0,
      sourceCount: stageSources.length,
      recordCount: stageSources.length,
      summary: stageSummary[code],
      sources: stageSources,
      updatedAt,
    }];
  })) as ResearchWhiteboard["stages"],
  activity: stageCodes.map((stage, index) => ({
    id: `rf-activity-${String(index + 1).padStart(2, "0")}`,
    at: new Date(Date.parse(updatedAt) + index * 60_000).toISOString(),
    stage,
    status: "complete",
    message: stageSummary[stage],
  })),
  reportModules,
};
