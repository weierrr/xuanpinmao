import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { writeOpportunityDiscoveryPlan } from "../src/opportunity-discovery/service";
import { liveAnalysisSchema, researchClaimsSchema } from "../src/research/live-types";
import {
  initializeResearchWhiteboard,
  researchWhiteboardPath,
  syncWhiteboardFromResearch,
} from "../src/research-whiteboard/service";
import { researchWhiteboardSchema, type ResearchWhiteboardStageCode } from "../src/research-whiteboard/types";
import type { EvidencePackage } from "../src/research/types";

const sourceArgument = process.argv.find((item) => item.startsWith("--source="));
if (!sourceArgument) throw new Error("Missing --source=<historical research run directory>.");

const sourceRoot = path.resolve(sourceArgument.slice("--source=".length));
const readJson = async <T>(name: string): Promise<T> =>
  JSON.parse(await readFile(path.join(sourceRoot, name), "utf8")) as T;

const chineseCopy = new Map<string, string>([
  ["Generic leggings flatten or sag rather than contour.", "普通紧身裤容易把臀腿压平或出现松垮，无法形成自然轮廓。"],
  ["Visible scrunch seams can feel too revealing or aesthetically extreme.", "明显的提臀褶皱线可能过于暴露，视觉效果也容易显得夸张。"],
  ["Customers fear see-through fabric, waistband roll, poor fit, chafing, and wash failure.", "用户担心面料透、腰头卷边、版型不合身、摩擦不适，以及洗后变形失效。"],
  ["Some buyers feel self-conscious about leg or glute appearance.", "部分用户会因腿部或臀部外观而感到不自信。"],
  ["Comfortable high-waist support for gym and daily wear.", "高腰支撑舒适，既能运动也能日常穿着。"],
  ["Squat opacity and fabric recovery.", "深蹲时不透，面料拉伸后能恢复。"],
  ["A flattering shape without constant adjustment.", "无需频繁整理，也能保持自然修饰效果。"],
  ["Inclusive and reliable sizing.", "尺码覆盖更广，选码结果更稳定。"],
  ["Feeling more confident in fitted activewear.", "穿紧身运动服时更自信。"],
  ["Reducing anxiety about appearance and garment failure.", "降低对身材暴露和衣物失效的焦虑。"],
  ["Getting a noticeable look without invasive procedures.", "无需侵入式手段，也能获得肉眼可见的修饰效果。"],
  ["Demand and emotional motivation are sufficient for a bounded sample test.", "现有需求与情绪动机足以支持一次小范围、设有边界的买样测试。"],
  ["DTC price anchors support a possible premium over marketplace commodity offers.", "独立站价格锚点说明，相比平台通货存在一定溢价空间。"],
  ["Polarized styling creates differentiation space for a subtler, proof-led design.", "夸张提臀风格评价两极，为更克制、以实测证明为主的设计留下差异化空间。"],
  ["Supplier candidates exist, but no final SKU, quote, landed economics, or quality evidence is verified.", "已有供应商候选，但最终款式、正式报价、落地成本和质量证据都尚未核实。"],
  ["Health, clinical, patent, cellulite, circulation, swelling, and permanent-body-change claims must remain excluded.", "现阶段必须排除健康、临床、专利、消除橘皮、改善循环或肿胀、永久改变身形等宣传。"],
  ["Final supplier and exact target SKU", "最终供应商与准确目标款式"],
  ["Formal quote, MOQ, packaging, production lead time, and quality terms", "正式报价、起订量、包装、生产周期与质量条款"],
  ["Landed cost, duty, fulfillment cost, return reserve, CM1, break-even CPA, and ROAS", "落地成本、关税、履约费用、退货准备金、单件贡献毛利、盈亏平衡获客成本与广告回报率"],
  ["Physical opacity, seam durability, wash recovery, waistband roll, chafing, camel-toe, and fit performance", "实物不透性、缝线耐久、洗后恢复、腰头卷边、摩擦不适、卡裆与版型表现"],
  ["Target-product fiber/care/country-of-origin labels", "目标商品的纤维成分、洗护与原产国标签"],
  ["Product-specific evidence for any health, circulation, cellulite, compression-performance, clinical, or patent claim", "健康、循环、橘皮、压力性能、临床或专利宣传所需的目标商品专项证据"],
  ["Reliable current Google Trends time series and first-party marketplace sales data", "可靠的当前 Google Trends 时间序列与平台一方销售数据"],
]);

const localizeReportText = (text: string): string => {
  let localized = text;
  for (const [english, chinese] of chineseCopy) localized = localized.replaceAll(english, chinese);
  return localized.replaceAll("。；", "；").replaceAll("。。", "。");
};

const main = async (): Promise<void> => {
const now = new Date();
const { plan, paths } = await writeOpportunityDiscoveryPlan({
  categoryKeyword: "3D yoga pants 示例报告",
  targetMarket: "US",
  targetAudience: "希望运动裤兼顾自然塑形、舒适和日常穿着的美国女性（示例画像）",
  salesChannel: "independent_dtc / TikTok Shop",
  imageUrls: [],
  competitorUrls: ["https://getionix.com/"],
  referenceUrls: ["https://getionix.com/"],
});

await initializeResearchWhiteboard(plan, now);

const manifest = await readJson<EvidencePackage["manifest"]>("manifest.json");
const researchInput = await readJson<EvidencePackage["researchInput"]>("research_input.json");
const researchPlan = await readJson<EvidencePackage["researchPlan"]>("research_plan.json");
const sources = await readJson<EvidencePackage["sources"]>("sources.json");
const unresolvedItems = await readJson<EvidencePackage["unresolvedItems"]>("unresolved_items.json");
const claims = researchClaimsSchema.parse(await readJson<unknown>("claims.json"));
const analysis = liveAnalysisSchema.parse(await readJson<unknown>("commercial_analysis.json"));

const evidencePackage: EvidencePackage = {
  manifest,
  researchInput,
  researchPlan,
  sources,
  unresolvedItems,
  packagePath: sourceRoot,
};

const synced = await syncWhiteboardFromResearch(plan.discoveryId, evidencePackage, claims, analysis, now);
const reportModules = synced.reportModules.map((reportModule) => ({
  ...reportModule,
  conclusion: localizeReportText(reportModule.conclusion),
  items: reportModule.items.map((item) => ({ ...item, text: localizeReportText(item.text) })),
  unknowns: reportModule.unknowns.map(localizeReportText),
}));
const evidenceStageCodes: ResearchWhiteboardStageCode[] = ["market", "customer", "competitor", "supply", "compliance"];
const stages = { ...synced.stages };
for (const code of evidenceStageCodes) stages[code] = { ...stages[code], queryCount: 10 };
for (const reportModule of reportModules) {
  const stageCode = `${reportModule.code}_report` as ResearchWhiteboardStageCode;
  stages[stageCode] = { ...stages[stageCode], summary: reportModule.conclusion };
}

const activitySeeds: Array<[ResearchWhiteboardStageCode, string]> = [
  ["scope", "已确认示例对象：美国市场 3D 塑形瑜伽裤。"],
  ["market", "核对运动服需求、公开价格带和趋势边界。"],
  ["market", "保留 Shopify、Amazon 代理数据和 Google Trends 受阻记录。"],
  ["customer", "整理 Reddit 与公开用户反馈中的外观、舒适和耐穿焦虑。"],
  ["customer", "区分真实用户表达与推断画像。"],
  ["competitor", "拆解 Ionix、BRXL 等竞品的点击钩子、信任证明和成交方式。"],
  ["competitor", "保留商家自述边界，不把竞品效果迁移到目标商品。"],
  ["supply", "记录公开供应商候选与寻源语言，未将公开页面视为正式报价。"],
  ["compliance", "核对 FTC 服装标签和健康宣传边界。"],
  ["synthesis", "把 29 个来源和 22 条原子判断整理为价格、用户、竞品与机会结论。"],
  ["market_report", "生成市场与机会结论。"],
  ["customer_report", "生成用户画像结论。"],
  ["competitor_report", "生成竞品分析结论。"],
  ["product_report", "生成产品方案与中英文寻源起点。"],
  ["marketing_report", "生成可测试营销表达和禁用宣传边界。"],
  ["validation_report", "生成买样、测试、通过与停止条件。"],
  ["execution", "示例报告已按最新白板 UI 重新排版。"],
];
const startAt = now.getTime() - activitySeeds.length * 60_000;
const activity = activitySeeds.map(([stage, message], index) => ({
  id: `example-${String(index + 1).padStart(2, "0")}`,
  at: new Date(startAt + index * 60_000).toISOString(),
  stage,
  status: "complete" as const,
  message,
}));

const example = researchWhiteboardSchema.parse({
  ...synced,
  product: "3D 瑜伽裤示例报告",
  channel: "独立站 / TikTok Shop（示例）",
  stages,
  activity,
  reportModules,
});
await mkdir(path.dirname(researchWhiteboardPath(plan.discoveryId)), { recursive: true });
await writeFile(researchWhiteboardPath(plan.discoveryId), `${JSON.stringify(example, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: "created",
  discoveryId: plan.discoveryId,
  planPath: paths.plan,
  whiteboardPath: researchWhiteboardPath(plan.discoveryId),
  reportUrl: `/discover/plan/whiteboard?discoveryId=${plan.discoveryId}`,
  sourceCount: sources.length,
  claimCount: claims.length,
}, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
