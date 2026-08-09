import { sourcingStarterSchema, type SourcingStarter } from "./types";

const yogaReportRunId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

const yogaSourcingStarter = sourcingStarterSchema.parse({
  schemaVersion: "1.0",
  runId: yogaReportRunId,
  title: "拿着这些词去找货",
  notice: "当前方向可从现货或轻定制款开始找样；真实成本、实现难度与产品效果需取得供应商报价和样品后确认。",
  coreKeywords: [
    "视觉磨皮瑜伽裤",
    "隐藏橘皮瑜伽裤",
    "无前缝自然提臀瑜伽裤",
    "高腰无痕塑形瑜伽裤",
    "哑光防透运动紧身裤",
    "裸感高弹提臀裤",
  ],
  combinationQueries: [
    "无前缝 + 高腰 + 自然提臀 + 防透瑜伽裤",
    "哑光高密面料 + 隐藏橘皮 + 塑形打底裤",
    "裸感面料 + 臀腿分区 + 无尴尬线瑜伽裤",
    "宽腰头 + 不卷腰 + 高弹锦纶 + 提臀瑜伽裤",
  ],
  supplierBrief:
    "想找一款面向欧美女性的高腰塑形瑜伽裤，重点不是夸张提臀，而是平滑皮肤凹凸、自然修饰臀腿轮廓。需要无前缝、防透、不卷腰、高弹哑光面料，最好支持调整克重、压缩分区和尺码范围。请提供现有相似款、面料参数、尺码表、起订量、样品费和交期。",
  exclusions: [
    "不要医用压力裤",
    "不要治疗炎症或改善循环等医疗宣称",
    "不要夸张提臀缝或过强蜂窝纹",
    "不要未经深蹲防透测试的低克重面料",
  ],
});

export const sourcingStarterFor = (runId: string): SourcingStarter | null => (
  runId === yogaReportRunId ? yogaSourcingStarter : null
);

export const sourcingCopyText = (starter: SourcingStarter): string => [
  "核心搜索词",
  ...starter.coreKeywords.map((keyword) => `- ${keyword}`),
  "",
  "1688 组合搜索",
  ...starter.combinationQueries.map((query) => `- ${query}`),
  "",
  "发给工厂的话",
  starter.supplierBrief,
  "",
  "排除条件",
  ...starter.exclusions.map((item) => `- ${item}`),
].join("\n");
