import { sellerDecisionCardSchema, type SellerDecisionCard } from "./types";

const yogaReportRunId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

const yogaDecision = sellerDecisionCardSchema.parse({
  schemaVersion: "1.0",
  runId: yogaReportRunId,
  primaryVerdict: "值得找样验证，不值得直接备货",
  statusLabel: "继续验证",
  signals: [
    {
      key: "market",
      question: "有没有市场",
      verdict: "有明确需求",
      detail: "塑形、遮盖皮肤凹凸和日常穿搭需求反复出现，但需求规模与真实购买强度仍需行为数据验证。",
      evidenceLevel: "supported",
      evidenceLabel: "已有用户证据",
    },
    {
      key: "competition",
      question: "竞争大不大",
      verdict: "竞争偏高",
      detail: "这是成熟瑜伽裤市场，公开样本中已有多种塑形产品；精确竞争强度仍需实时商品与销量数据。",
      evidenceLevel: "preliminary",
      evidenceLabel: "初步判断",
    },
    {
      key: "crowding",
      question: "卷不卷",
      verdict: "比较卷",
      detail: "高腰、提臀、防透和无痕已经接近基础配置，继续用通用卖点容易进入价格与内容同质化竞争。",
      evidenceLevel: "directional",
      evidenceLabel: "方向性证据",
    },
    {
      key: "whitespace",
      question: "还有没有机会",
      verdict: "有差异化窗口",
      detail: "机会不在普通提臀裤，而在视觉平滑皮肤凹凸、自然修饰轮廓，并用真实样裤证明效果。",
      evidenceLevel: "directional",
      evidenceLabel: "方向性证据",
    },
  ],
  nextAction: "先按寻源关键词找到 2–3 家可比供应商，取得样裤后做同光线、同姿势视觉盲测。",
  boundary: "这里回答的是是否值得继续投入验证，不代表目标供应商、样品效果、利润空间或广告投放已经通过。",
});

export const sellerDecisionFor = (runId: string): SellerDecisionCard | null => (
  runId === yogaReportRunId ? yogaDecision : null
);
