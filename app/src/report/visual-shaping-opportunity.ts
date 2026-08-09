export type MacroMetric = {
  value: string;
  label: string;
  interpretation: string;
  evidenceType: "公开数据" | "推算" | "行业估算" | "品类参照";
  sourceLabel: string;
  sourceUrl: string;
};

export type AnxietyAngle = {
  priority: number;
  anxiety: string;
  visibleOutcome: string;
  productDirection: string;
  usableExpression: string;
  risk: "高" | "中" | "低";
};

export type BreakoutScoreFactor = {
  key: string;
  label: string;
  score: number;
  status: "已成立" | "方向成立" | "待验证" | "薄弱项";
  rationale: string;
  nextAction: string;
};

export type BreakoutScore = {
  overall: number;
  verdict: string;
  method: string;
  factors: BreakoutScoreFactor[];
};

export type VisualShapingOpportunity = {
  auditRunId: string;
  direction: string;
  thesis: string;
  directionReconciliation: string;
  recommendation: {
    coreValue: string;
    targetCustomer: string;
    targetScenario: string;
    productConcept: string;
    evidenceStrength: string;
    whyFirst: string;
  };
  macroMetrics: MacroMetric[];
  sizingScenarios: Array<{ penetration: string; buyers: string; annualRevenue: string }>;
  sizingBoundary: string;
  breakoutScore: BreakoutScore;
  anxietyAngles: AnxietyAngle[];
  validation: {
    title: string;
    method: string;
    sample: string;
    pass: string;
    fail: string;
  };
};

const composedReportRunId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

export const calculateBreakoutScore = (factors: BreakoutScoreFactor[]): number => {
  if (factors.length === 0) return 0;

  const scores = factors.map((factor) => factor.score);
  const geometricMean = Math.round(
    Math.exp(scores.reduce((sum, score) => sum + Math.log(Math.max(score, 1)), 0) / scores.length),
  );
  const weakLinkCap = Math.min(...scores) + 25;

  return Math.min(geometricMean, weakLinkCap);
};

const breakoutFactors: BreakoutScoreFactor[] = [
  {
    key: "anxiety",
    label: "高频或高强度焦虑",
    score: 78,
    status: "已成立",
    rationale: "橘皮、腰腹和臀腿外观困扰覆盖面广，699 条用户反馈也反复出现塑形、不透与体型焦虑。",
    nextAction: "继续按体型与场景拆分焦虑，确认哪一种最能驱动付费。",
  },
  {
    key: "trigger",
    label: "明确触发场景",
    score: 76,
    status: "已成立",
    rationale: "健身房侧光、试衣镜、拍照、深蹲和穿浅色紧身裤，都会直接放大用户对外观的担忧。",
    nextAction: "用同一产品测试侧光、镜前、运动和日常四类素材场景。",
  },
  {
    key: "visible-result",
    label: "可感知效果",
    score: 58,
    status: "待验证",
    rationale: "视觉磨皮和轮廓连贯容易展示，但目前没有目标样裤证明普通用户也能稳定看出差异。",
    nextAction: "完成同光线、同姿势盲测，证明效果不是拍摄、姿势或修图造成。",
  },
  {
    key: "comprehension",
    label: "低理解成本",
    score: 84,
    status: "已成立",
    rationale: "“穿上像给臀腿开了一层视觉磨皮”能在三秒内讲清用户问题和期望结果。",
    nextAction: "用三版一句话表达做无提示复述测试，保留理解最一致的一版。",
  },
  {
    key: "proof",
    label: "可信证明",
    score: 35,
    status: "薄弱项",
    rationale: "当前主要是竞品表达、历史用户反馈和方向推理，缺少目标样裤的实拍、盲测与长期穿着证据。",
    nextAction: "先补同条件对比、第三方盲选和未经修图的用户实拍，再讨论广告表达。",
  },
  {
    key: "channel",
    label: "渠道可放大性",
    score: 62,
    status: "方向成立",
    rationale: "前后视觉差异适合短视频和信息流，但“去橘皮”等功效表达存在广告审核与合规风险。",
    nextAction: "分别测试低风险视觉表达与竞品边缘抓手，记录审核、点击和转化差异。",
  },
  {
    key: "delivery",
    label: "交付可持续性",
    score: 30,
    status: "薄弱项",
    rationale: "尚无正式供应商、目标样裤、不同体型表现、退货率和完整单位经济数据。",
    nextAction: "取得两家可比供应商方案，完成样品测试、成本核算和体型覆盖验证。",
  },
];

const opportunity: VisualShapingOpportunity = {
  auditRunId: "research-run-visual-smoothing-sculpting-leggings-fd0a8e63e2a6-us",
  direction: "视觉磨皮与自然轮廓管理款",
  thesis:
    "不再把压力当成消费者购买理由，而是解决普通紧身裤会放大橘皮凹凸、腰腹断层和臀腿轮廓的问题；压力、针织密度、光泽和剪裁只是内部实现手段。",
  directionReconciliation:
    "此前的“证据优先自然塑形款”已经合并到本方向：它不再是并列产品结论，而是负责证明视觉平滑效果的测试体系，包括不透、舒适、尺码、洗后表现和真实体型实穿。",
  recommendation: {
    coreValue:
      "先解决侧光下臀腿凹凸、腰腹断层和轮廓不连贯，再用目标样品的不透、舒适与多体型实穿证明效果可信。",
    targetCustomer:
      "在健身房侧光、试衣镜或拍照时容易注意到橘皮、腰腹和臀腿轮廓，但又排斥夸张提臀造型的美国女性。",
    targetScenario:
      "健身房侧光、镜前试穿、深蹲训练、拍照和训练后继续日常穿着。",
    productConcept:
      "以高密哑光面料、隐藏式轮廓结构和稳定高腰实现视觉平滑；不透、无尴尬前缝、洗后回弹和真实体型记录作为证明体系。",
    evidenceStrength:
      "焦虑和触发场景已有方向性证据；目标样裤能否稳定产生肉眼可见差异仍待盲测。",
    whyFirst:
      "它把最新广告抓手、用户外观焦虑和可视化产品效果串成同一条链路；相比把不透、舒适或压力单独当卖点，更容易解释用户为什么停下、相信并购买。",
  },
  macroMetrics: [
    {
      value: "80%–90%",
      label: "成年女性可能出现橘皮纹",
      interpretation: "医学综述给出的常见发生率区间，主要集中在大腿、臀部与髋部。",
      evidenceType: "公开数据",
      sourceLabel: "查看医学综述",
      sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10324940/",
    },
    {
      value: "约 1.016 亿",
      label: "美国 18–64 岁女性",
      interpretation: "根据美国人口普查局 2024 年 ACS 五年表中各女性年龄段求和。",
      evidenceType: "公开数据",
      sourceLabel: "查看人口表",
      sourceUrl: "https://data.census.gov/table/ACSDT5Y2024.B01001",
    },
    {
      value: "约 8100万–9100万",
      label: "可能存在橘皮困扰的人群映射",
      interpretation: "用人口数乘以 80%–90% 得出；只说明焦虑覆盖面，不代表购买意愿。",
      evidenceType: "推算",
      sourceLabel: "查看计算底表",
      sourceUrl: "https://data.census.gov/table/ACSDT5Y2024.B01001",
    },
    {
      value: "约 9.0 亿美元",
      label: "美国塑身服市场 2024 年估算",
      interpretation: "Spherical Insights 的公开行业估算；是邻近付费市场，不是本产品直接市场。",
      evidenceType: "行业估算",
      sourceLabel: "查看行业估算",
      sourceUrl: "https://www.sphericalinsights.com/reports/united-states-shapewear-market",
    },
  ],
  sizingScenarios: [
    { penetration: "0.5%", buyers: "40.6万–45.7万人", annualRevenue: "1790万–2010万美元" },
    { penetration: "1%", buyers: "81.3万–91.4万人", annualRevenue: "3580万–4020万美元" },
    { penetration: "2%", buyers: "162.6万–182.9万人", annualRevenue: "7150万–8050万美元" },
  ],
  sizingBoundary:
    "以上按单价 44 美元、每人每年购买 1 条计算，只是帮助判断数量级的情景测算，不是销量预测，也没有扣除退货、折扣、获客和履约成本。",
  breakoutScore: {
    overall: calculateBreakoutScore(breakoutFactors),
    verdict: "值得继续验证，但可信证明与交付稳定性尚不足以支持放量。",
    method:
      "七项按乘法逻辑计算几何平均，并由最低项加 25 分设置上限；这样高分不能掩盖会让整条链路失效的薄弱项。",
    factors: breakoutFactors,
  },
  anxietyAngles: [
    {
      priority: 1,
      anxiety: "橘皮纹、皮肤凹凸",
      visibleOutcome: "侧光下臀腿表面看起来更平滑",
      productDirection: "高密哑光面料、表面纹理与局部结构，减少面料贴出皮肤凹凸",
      usableExpression: "穿上后，臀腿皮肤看起来更平滑",
      risk: "高",
    },
    {
      priority: 2,
      anxiety: "小腹松、腰侧肉",
      visibleOutcome: "坐下和侧身时腰腹轮廓更连贯",
      productDirection: "双层高腰、宽腰头与不切肉的边缘结构",
      usableExpression: "减少腰头切肉，让腰腹线条看起来更利落",
      risk: "中",
    },
    {
      priority: 3,
      anxiety: "臀线下垂、扁平",
      visibleOutcome: "臀线更完整，但看不出夸张提臀缝",
      productDirection: "隐藏式提臀结构、弧形剪裁与臀下承托线",
      usableExpression: "自然修饰臀线，不靠夸张提臀缝",
      risk: "中",
    },
    {
      priority: 4,
      anxiety: "大腿外侧与马鞍肉明显",
      visibleOutcome: "大腿外侧和臀腿连接看起来更顺",
      productDirection: "侧片剪裁、明暗控制与高密面料",
      usableExpression: "让臀腿轮廓看起来更连贯",
      risk: "中",
    },
    {
      priority: 5,
      anxiety: "透、汗渍和公共场合尴尬",
      visibleOutcome: "强光、深蹲和出汗后仍保持体面",
      productDirection: "不透、汗渍弱显色、哑光面料与无尴尬前缝",
      usableExpression: "经得住健身房顶灯、深蹲和出汗测试",
      risk: "低",
    },
  ],
  validation: {
    title: "同光线、同姿势的视觉盲测",
    method:
      "同一位用户在相同侧光、机位和姿势下，分别穿普通紧身裤与候选样裤；不告诉观察者哪条是目标款，只问哪一条看起来更平滑、更利落。",
    sample: "先用 10 位有橘皮或腰腹困扰的美国女性，每人至少比较 2 条候选样裤。",
    pass: "至少 60% 的盲选判断指向同一候选样裤，并且用户能说出具体可见差异；舒适度不能明显低于普通紧身裤。",
    fail: "选择接近随机、只有拍摄者能看出差异，或视觉改善依赖过强压力并造成明显不适。",
  },
};

export const visualShapingOpportunityFor = (
  runId: string,
): VisualShapingOpportunity | null => (runId === composedReportRunId ? opportunity : null);
