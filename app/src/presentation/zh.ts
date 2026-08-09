const statusLabels: Record<string, string> = {
  PROCEED_TO_SAMPLE: "进入受控买样",
  HOLD_RESEARCH: "继续调研后再决定",
  HOLD_SUPPLY: "暂缓正式供货",
  GO: "允许进入下一阶段",
  REJECT: "暂不继续",
  READY_FOR_SOURCING: "可开始供应商候选研究",
  completed: "已完成",
  succeeded: "已完成",
  running: "进行中",
  queued: "排队中",
  failed: "失败",
  verified: "已验证",
  needs_review: "待复核",
  invalid: "无效",
  accessible: "可访问",
  partial: "部分可访问",
  blocked: "访问受限",
  high: "高",
  medium: "中",
  low: "低",
  insufficient: "不足",
  supported: "已有支持",
  directional: "方向性证据",
  hypothesis: "待验证假设",
  unknown: "未知",
  existing: "现有款",
  light_customization: "轻定制",
  deep_customization: "深度定制",
  clear: "清晰",
};

const sourceTypeLabels: Record<string, string> = {
  competitor: "竞品",
  market: "市场与用户",
  regulation: "法规",
  supplier: "供应商",
};

const sourceTitleLabels: Record<string, string> = {
  "Ionix Labs Homepage": "Ionix Labs 品牌首页",
  "Ionix Sculpt 3D Lift & Smooth Leggings": "Ionix Sculpt 3D 提拉塑形紧身裤",
  "Ionix Returns & Warranty": "Ionix 退货与质保政策",
  "BRXL Scrunch Butt Lifting Leggings": "BRXL 提臀紧身裤",
  "Shopify Trending Products - Activewear": "Shopify 热门商品：运动服",
  "ASINsight Amazon US Scrunch Butt Leggings Report": "ASINsight 美国亚马逊提臀紧身裤报告",
  "TikTok Shop Search - Butt Lifting Leggings": "TikTok Shop 提臀紧身裤搜索结果",
  "Reddit - Are Butt Scrunch Leggings Cute?": "Reddit：提臀褶皱紧身裤好看吗？",
  "Reddit Activewear - Scrunch or No Scrunch": "Reddit 运动服讨论：要不要提臀褶皱？",
  "FTC Apparel and Labeling": "美国 FTC 服装与标签要求",
  "FTC Health Products Compliance Guidance": "美国 FTC 健康产品合规指南",
  "Google Trends Explore Attempt": "Google Trends 趋势探索记录",
  "Alibaba Scrunch Leggings Supplier Candidate": "阿里巴巴提臀紧身裤候选供应商",
  "Reddit OnerActive: Scrunch butt leggings yes or no": "Reddit OnerActive：是否接受提臀褶皱紧身裤",
  "Reddit Activewear: AYBL complaints and alternatives": "Reddit 运动服：AYBL 吐槽与替代选择",
  "Reddit OnerActive: recurring quality issues": "Reddit OnerActive：反复出现的质量问题",
  "Reddit OnerActive: quality counterevidence discussion": "Reddit OnerActive：质量正向与反向证据讨论",
  "Reddit OnerActive: see-through leggings experiences": "Reddit OnerActive：紧身裤透视经历",
  "DFYNE Impact Leggings customer reviews": "DFYNE Impact 紧身裤顾客评论",
  "Trustpilot Oner Active customer reviews": "Trustpilot Oner Active 顾客评论",
  "Trustpilot DFYNE customer reviews": "Trustpilot DFYNE 顾客评论",
  "Amazon scrunch leggings comment-level access attempt": "亚马逊提臀紧身裤评论级访问记录",
  "SUUKSESS public customer reviews": "SUUKSESS 公开顾客评论",
};

const productNameLabels: Record<string, string> = {
  "3d yoga pants": "3D 瑜伽裤",
  "manual dog paw cleaner cup": "手动洗爪杯",
  "narrow rolling under sink organizer caddy": "窄型水槽下滚轮收纳架",
  "magsafe compatible low profile phone grip stand": "低厚度磁吸手机握持支架",
};

export const productNameZh = (value: string): string =>
  productNameLabels[value.toLowerCase()] ?? value;

export const statusZh = (value: string): string => statusLabels[value] ?? value;

export const sourceTypeZh = (value: string): string => sourceTypeLabels[value] ?? value;

export const sourceTitleZh = (value: string): string => {
  const amazonMatch = /^Amazon customer reviews for ASIN (.+)$/u.exec(value);
  if (amazonMatch) return `亚马逊 ASIN ${amazonMatch[1]} 顾客评论`;
  return sourceTitleLabels[value] ?? value;
};

export const validationTypeZh = (value: string): string => ({
  concept_test: "产品概念测试",
  supplier_validation: "供应商能力确认",
  sample_test: "样品实测",
  pricing_test: "价格接受度测试",
  unit_economics_check: "正式成本核算",
})[value] ?? value;

export const validationBudgetZh = (value: string): string => ({
  concept_test: "250 美元",
  supplier_validation: "样品采购前 0 美元",
  sample_test: "450 美元（含样品与本地测试处理）",
  pricing_test: "150 美元",
  unit_economics_check: "分析成本 0 美元",
})[value] ?? "待确认";

export const supplyCategoryZh = (value: string): string => ({
  material: "材料",
  process: "工艺",
  structure: "结构",
  feature: "功能",
  accessory: "配件",
  packaging: "包装",
  supplier_capability: "供应商能力",
  content_asset: "内容资产",
  channel_asset: "渠道资产",
  service: "服务",
})[value] ?? value;
