import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { researchPackagePath } from "../src/first-principles/service";
import { researchClaimsSchema, liveAnalysisSchema, liveResearchStatusSchema } from "../src/research/live-types";

const runId = "research-run-product-7f4ddc865607-us";
const packagePath = researchPackagePath(runId);
const now = new Date().toISOString();
const sourceIds = {
  amazon: ["SRC-VOC-017", "SRC-VOC-018", "SRC-VOC-019", "SRC-VOC-020", "SRC-VOC-021", "SRC-VOC-022", "SRC-VOC-023"],
  market: ["SRC-REF-001", "SRC-REF-007", "SRC-REF-010", "SRC-REF-015"],
  competitor: ["SRC-REF-002", "SRC-REF-003", "SRC-REF-004", "SRC-REF-005", "SRC-REF-006"],
  compliance: ["SRC-REF-008", "SRC-REF-009"],
  customer: ["SRC-REF-011", "SRC-REF-012", "SRC-REF-016"],
  supplier: ["SRC-REF-013", "SRC-REF-014"],
};
const claims = researchClaimsSchema.parse([
  { id: "CLM-RF-001", sourceId: "SRC-REF-001", statement: "OEM refrigerator filters are sold as recurring replacement products with model-specific compatibility and replacement-cycle guidance.", evidence: "Whirlpool everydrop product page lists model family, price and replacement guidance.", confidence: "High", category: "market", targetScope: "market" },
  { id: "CLM-RF-002", sourceId: "SRC-REF-007", statement: "Aftermarket multi-packs create materially lower per-filter price points than OEM single-filter offers.", evidence: "Home Depot Waterdrop 6-pack page records a low per-unit price point at capture time.", confidence: "High", category: "market", targetScope: "market" },
  { id: "CLM-RF-003", sourceId: "SRC-REF-002", statement: "Compatibility lookup is a central conversion step in refrigerator-filter purchasing.", evidence: "everydrop provides a dedicated model-to-filter finder.", confidence: "High", category: "competitor", targetScope: "competitor" },
  { id: "CLM-RF-004", sourceId: "SRC-REF-008", statement: "NSF/ANSI claims must be bound to a standard and the specific certified product; certification does not mean removal of every contaminant.", evidence: "NSF standard explainer defines distinct scopes for 42, 53 and 401.", confidence: "High", category: "regulation", targetScope: "market" },
  { id: "CLM-RF-005", sourceId: "SRC-VOC-018", statement: "In the bounded Amazon sample, compatibility and fit is the most frequent negative theme.", evidence: "197 valid Amazon observations include 43 negative or mixed compatibility-and-fit observations.", confidence: "Medium", category: "customer", targetScope: "competitor" },
  { id: "CLM-RF-006", sourceId: "SRC-VOC-019", statement: "The bounded Amazon sample contains negative observations about filtration performance and water taste or odor.", evidence: "Review-level paraphrases classify 15 filtration-performance and 10 taste-or-odor negative observations.", confidence: "Medium", category: "customer", targetScope: "competitor" },
  { id: "CLM-RF-007", sourceId: "SRC-REF-013", statement: "Public supplier listings are candidate leads only and do not establish verified certification, MOQ, capacity or quality consistency for a target SKU.", evidence: "Supplier page makes product and certification assertions without a target-sample file package.", confidence: "High", category: "supplier", targetScope: "market" },
]);
const analysis = liveAnalysisSchema.parse({
  schemaVersion: "1.0", researchRunId: runId, generatedAt: now,
  marketOpportunity: {
    demand: { score: 70, rationale: "Recurring replacement behavior and broad OEM/aftermarket presence are visible, but no market-size or sales-volume dataset is verified.", sourceIds: [...sourceIds.market, ...sourceIds.competitor] },
    competition: { score: 82, rationale: "OEM brands and scaled aftermarket sellers compete across model families, bundles, certification language and replenishment paths.", sourceIds: sourceIds.competitor },
    trend: { score: 55, rationale: "The current package shows category structure and recurring replacement logic, not a verified time-series trend.", sourceIds: sourceIds.market },
    monetization: { score: 64, rationale: "Observed public prices show room between OEM and multi-pack aftermarket offers; costs, fees and returns remain unknown.", sourceIds: ["SRC-REF-001", "SRC-REF-004", "SRC-REF-005", "SRC-REF-006", "SRC-REF-007"] },
    overall: 64, verdict: "有稳定替换需求，但竞争高、型号错误成本高。值得进入受控买样验证，不适合在真实成本和认证文件未核验前直接上架。",
  },
  competitorInsight: {
    brandPositioning: "OEM 用原厂信任与型号确定性收费，aftermarket 用兼容覆盖、套装价格与认证标签竞争。",
    targetAudience: "需要按冰箱或原厂滤芯型号快速买对替换件的美国家庭用户。",
    pricePositioning: "公开页面显示 OEM 单支约中高价，aftermarket 多件装把单支价格压低；具体价格是采集时点，不代表长期价格。",
    skuSummary: "应按明确型号族组织 SKU，不能用泛品牌兼容替代精确型号映射。",
    bundleStrategy: "OEM 单支、2-pack/3-pack/6-pack 和订阅补货共同构成成交路径。",
    discountStrategy: "多件装和订阅降低复购摩擦，价格促销是辅助而非唯一信任机制。",
    sellingPoints: ["型号查找", "认证文件透明", "安装与密封稳定", "口感与流速体验", "周期提醒"],
    materials: "具体滤材与性能必须以目标 SKU 文件和实测为准，不能从竞品页面外推。",
    sizeSystem: "按原厂型号、冰箱型号和卡口版本维护兼容关系。",
    homepageMessaging: "先确认买对，再展示认证范围、安装步骤和更换提醒。",
    cta: "输入冰箱型号，核对兼容后购买套装或订阅。",
    socialProof: "当前有 Amazon、Walmart 与 Reddit 公开反馈，但跨平台评论语料尚未达到独立来源族充分三角验证。",
    reviews: "Amazon 197 条有效观察显示兼容与过滤/口感问题是主要负面主题，同时也有大量正向兼容和体验反馈。",
    ugc: "优先收集型号核对、安装到位、冲洗和连续出水测试素材。",
    whyItSells: ["替换是刚需型周期行为", "型号错误会带来高退货和安装失败成本", "信任与价格存在明确取舍"],
    sourceIds: [...sourceIds.competitor, ...sourceIds.amazon],
  },
  customerInsight: {
    painPoints: ["买错型号或卡口不匹配", "安装后漏水或密封不稳", "出水变慢", "水有异味或口感不佳", "过滤声明和认证难判断"],
    functionalMotives: ["快速确认兼容", "装上即用", "保持可接受流速", "降低每支替换成本", "按周期自动补货"],
    emotionalMotives: ["避免漏水和返工", "避免饮水安全不确定感", "相信自己买的是有效且真实的替换件"],
    socialMotives: ["家庭成员共同使用安全饮水", "参考其他用户的安装和适配经验"],
    sourceIds: [...sourceIds.amazon, ...sourceIds.customer],
  },
  positioning: {
    targetCustomer: "美国市场中需要更换明确型号冰箱滤芯、愿意为安装确定性与文件透明付费的家庭用户。",
    recommendedPriceRange: "公开竞品可见 OEM 单支中高价、aftermarket 套装低单价；目标 SKU 可先以型号族分层测试，不把公开零售价当作利润结论。",
    coreSellingPoint: "型号核对、防错安装、密封稳定与认证文件可追溯。",
    differentiation: ["型号查找器和防错配包装", "逐 SKU 认证文件与声明边界", "安装/冲洗/漏水测试内容", "多件装与更换提醒"],
  },
  productDecision: {
    status: "HOLD_SUPPLY",
    rationale: ["需求和痛点已有公开证据支持", "竞争成熟且兼容错误成本高", "目标样品认证、成本、批次一致性和真实退货率仍未知"],
    sourceIds: [...sourceIds.amazon, ...sourceIds.compliance, ...sourceIds.supplier],
  },
  actionBoundary: { listingAllowed: false, adTestAllowed: false, reason: "当前证据足以进入受控买样，不足以证明目标 SKU 的认证、过滤性能、利润或广告可用 Claim。" },
  unknowns: ["各型号真实销量、搜索量、转化率和退货率", "目标供应商正式报价、MOQ、交期和到岸成本", "目标样品与认证文件的一致性", "跨 Amazon/Walmart/社区之外更多独立来源的评论三角验证"],
});
const status = liveResearchStatusSchema.parse({ researchRunId: runId, mode: "live", currentStage: "analyzing_market", updatedAt: now, history: [{ stage: "initializing", at: now, note: "Research artifacts rebuilt for refrigerator-filter evidence." }, { stage: "collecting_evidence", at: now, note: "Public sources and Amazon review batch collected." }, { stage: "analyzing_market", at: now, note: "Evidence is ready for decision report generation." }] });
const main = async (): Promise<void> => {
  await mkdir(path.join(packagePath), { recursive: true });
  await Promise.all([
    writeFile(path.join(packagePath, "claims.json"), `${JSON.stringify(claims, null, 2)}\n`, "utf8"),
    writeFile(path.join(packagePath, "commercial_analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`, "utf8"),
    writeFile(path.join(packagePath, "research_status.json"), `${JSON.stringify(status, null, 2)}\n`, "utf8"),
  ]);
  console.log(JSON.stringify({ claims: claims.length, analysis: true, status: status.currentStage }));
};
main().catch((error: unknown) => { console.error(error); process.exit(1); });
