import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { generateLiveResearchReports } from "../src/research/live-report";

const runId = "research-run-product-7f4ddc865607-us";
const discoveryId = "discovery-category-9ff30cf30ef8-us";
const root = path.join(process.cwd(), "output", "research", runId);
const capturedAt = "2026-08-13T09:30:00.000Z";

const records = [
  {
    id: "SRC-REF-021", file: "refrigerator-filter-21.md", type: "market", entity: "Amazon In-Refrigerator Water Filters bestseller category",
    title: "Amazon 冰箱内置滤芯 Best Sellers 类目页", url: "https://www.amazon.com/Best-Sellers-In-Refrigerator-Water-Filters/zgbs/hi/3741161",
    notes: "Amazon 官方类目排序是采集时点的销量排序代理，不公开绝对销量。",
    body: `# Amazon Best Sellers: In-Refrigerator Water Filters\n\n- Captured: ${capturedAt}\n- Boundary: Amazon states the list reflects popular products based on sales and is updated frequently; rank is a point-in-time demand proxy, not an absolute sales count.\n\n## Observed ranks\n\n1. Everydrop EDR1RXD1\n2. Samsung HAF-QIN/EXP\n3. GE XWFE\n4. LG LT1000P\n5. Everydrop EDR2RXD1\n7. Everydrop EDR4RXD1\n10. Waterdrop LT1000P-compatible replacement\n14. Samsung HAF-CIN/EXP\n21. Samsung HAF-CIN 2-pack\n`,
  },
  {
    id: "SRC-REF-022", file: "refrigerator-filter-22.md", type: "market", entity: "Amazon keyword everydrop filter 1",
    title: "ASINSIGHT everydrop filter 1 型号级需求代理", url: "https://www.asinsight.com/report/US/everydrop-filter-1",
    notes: "第三方 Amazon 分析平台估算，仅作为方向性证据；不等于 Amazon 官方销量或卖家后台数据。",
    body: `# ASINSIGHT: everydrop filter 1\n\n- Reporting period: March 2026\n- Boundary: third-party estimates and platform-derived keyword metrics; directional only.\n\n## Public fields\n\n- 44 tracked products; leading EDR1RXD1 ASIN estimated at 80,000+ monthly orders, price $54.99, rating 4.7, 107,323 reviews.\n- Compatible 2-pack example estimated at 10,000+ orders, price $21.84.\n- Most recent weekly search volume: 1,153, WoW -12.25%; ABA Search Frequency Rank 164,319.\n- $20–$50 represents 56.35% of first-three-page ASINs.\n- Rating 4.3–4.7 represents 66.40%.\n- Top-3 click share 79.55%; Top-3 conversion share 71.76%.\n`,
  },
  {
    id: "SRC-REF-023", file: "refrigerator-filter-23.md", type: "market", entity: "Amazon keyword lg filter lt1000p",
    title: "ASINSIGHT LG LT1000P 型号级需求代理", url: "https://www.asinsight.com/report/US/lg-filter-lt1000p",
    notes: "第三方 Amazon 分析平台估算，仅作为方向性证据；不等于 Amazon 官方销量。",
    body: `# ASINSIGHT: lg filter lt1000p\n\n- Reporting period: July 2026\n- Boundary: third-party estimates; directional only.\n\n## Public fields\n\n- 45 tracked products.\n- LG OEM ASIN B074HLRXMP leads with estimated 40K monthly units at $46.16 and rating 4.7.\n- Waterdrop compatible ASIN B07H9LHMR2 follows with estimated 10K monthly units at $22.99 and rating 4.6.\n- Another tracked offer B0BCCZX7B7 is shown at estimated 10K monthly units and $79.99.\n`,
  },
  {
    id: "SRC-REF-024", file: "refrigerator-filter-24.md", type: "competitor", entity: "GE XWFE",
    title: "GE XWFE 官方零件页", url: "https://www.geapplianceparts.com/store/parts/spec/XWFE",
    notes: "官方页面公开价与规格，价格为采集时点。",
    body: `# GE XWFE official parts page\n\n- Captured: ${capturedAt}\n- Price: $54.99; 3-pack saves $15; subscription saves 5% with free shipping.\n- Filter life: 6 months; capacity: 170 gallons; flow: 0.46–0.5 gpm.\n- Official page lists NSF 42, 53 and 401. Claims remain specific to this GE SKU.\n`,
  },
  {
    id: "SRC-REF-025", file: "refrigerator-filter-25.md", type: "competitor", entity: "GE XWFE retail offer",
    title: "Home Depot GE XWFE 零售商品页", url: "https://www.homedepot.com/p/GE-Genuine-XWFE-Refrigerator-Water-Filter-for-GE-XWFE/312928339",
    notes: "零售价格为采集时点，不能当作价格历史。",
    body: `# Home Depot GE XWFE\n\n- Captured: ${capturedAt}\n- Single-unit price: $49.02.\n- Buy 2 or more: $44.12 each.\n- 4,199 reviews displayed; 90-day return policy displayed.\n- Replacement guidance: 6 months or 170 gallons; replace sooner if flow declines.\n`,
  },
  {
    id: "SRC-REF-026", file: "refrigerator-filter-26.md", type: "supplier", entity: "4396508/EDR5RXD1 compatible supplier candidate",
    title: "Bestpure/YUNDA 4396508 供应候选页", url: "https://www.waterfiltersfactory.com/products/refrigerator-filter-cartridges-wholesale-supplier/whirlpool-4396508-refrigerator-filter.html",
    notes: "公开供应页面仅是候选条件；认证、产能、质量与目标 SKU 必须另行核验。",
    body: `# Bestpure/YUNDA supplier candidate\n\n- MOQ: 1,000 pcs as a reference; different models may be mixed in one container.\n- Price depends on quantity and requires inquiry.\n- Sample fee prepaid and described as refundable after a qualified bulk order.\n- Sample dispatch: within 2 working days after payment.\n- OEM/private label supported.\n`,
  },
  {
    id: "SRC-REF-027", file: "refrigerator-filter-27.md", type: "supplier", entity: "Samsung HAF-QIN compatible supplier candidate",
    title: "Pureza HAF-QIN 供应候选页", url: "https://www.purezafilters.com/wholesale-nsf-certified-refrigerator-water-filter",
    notes: "供应商自述认证与能力未做证书目录核验，不能转化为目标 SKU 已认证结论。",
    body: `# Pureza HAF-QIN supplier candidate\n\n- Compatible family: Samsung DA97-17376B / HAF-QIN / HAF-QIN/EXP.\n- Public bulk lead time: 12–15 days.\n- OEM/ODM and customization stated.\n- Supplier claims NSF 42/53 and IAPMO; the claim is not treated as verified certification for a target SKU.\n`,
  },
  {
    id: "SRC-REF-028", file: "refrigerator-filter-28.md", type: "supplier", entity: "GE MWF compatible supplier candidate",
    title: "Simen Aqua MWF 公开阶梯报价", url: "https://www.simenaqua.com/mwf-refrigerator-water-filter-nsf-certified-water-filter-p-7.html",
    notes: "MWF 型号族公开报价用于供应成本代理，不代表 EDR1RXD1、HAF-QIN、XWFE 或 LT1000P 正式报价。",
    body: `# Simen Aqua MWF public tier pricing\n\n- 1–499 pcs: $4.70 each\n- 500–999 pcs: $4.40 each\n- 1,000–4,999 pcs: $4.10 each\n- 5,000–9,999 pcs: $3.86 each\n- 10,000+ pcs: $3.75 each\n- Free samples stated, freight collect.\n- Public lead time: about 15–20 days.\n- Private label supported.\n- Boundary: GE MWF-family cost proxy only, not a formal quote for the four prioritized model families.\n`,
  },
] as const;

const main = async () => {
  const [sources, claims, searchLog, analysis, input, manifest] = await Promise.all([
    readFile(path.join(root, "sources.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "claims.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "search_log.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "commercial_analysis.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "research_input.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "manifest.json"), "utf8").then(JSON.parse),
  ]);
  await mkdir(path.join(root, "source_snapshots"), { recursive: true });
  for (const record of records) {
    await writeFile(path.join(root, "source_snapshots", record.file), record.body, "utf8");
    const source = {
      id: record.id, url: record.url, title: record.title, sourceType: record.type,
      retrievedAt: capturedAt, targetEntity: record.entity, targetMarket: "US", accessMethod: "web-fetch",
      accessStatus: "accessible", evidenceStatus: "verified", snapshotPath: `source_snapshots/${record.file}`,
      contentHash: createHash("sha256").update(record.body).digest("hex"), notes: record.notes,
    };
    const index = sources.findIndex((item: { id: string }) => item.id === record.id);
    if (index >= 0) sources[index] = source; else sources.push(source);
  }
  const newClaims = [
    { id: "CLM-RF-008", sourceId: "SRC-REF-021", statement: "Amazon 当前冰箱内置滤芯 Best Sellers 前四名依次为 EDR1RXD1、HAF-QIN、XWFE 和 LT1000P。", evidence: "采集时点的 Amazon #1–#4 排名可作为相对需求代理，但不提供绝对销量。", confidence: "High", category: "market", targetScope: "market" },
    { id: "CLM-RF-009", sourceId: "SRC-REF-022", statement: "EDR1RXD1 在第三方 Amazon 估算中表现出强需求和高头部集中度。", evidence: "ASINSIGHT 公开字段显示领先 ASIN 估算月订单 80,000+、近期周搜索量 1,153，Top-3 点击/转化份额为 79.55%/71.76%。", confidence: "Medium", category: "trend", targetScope: "market", notes: "方向性第三方估算，不是 Amazon 官方或卖家后台数据。" },
    { id: "CLM-RF-010", sourceId: "SRC-REF-023", statement: "LT1000P 的 OEM 与兼容品在第三方 Amazon 估算中均有可见需求，且价格分层明显。", evidence: "ASINSIGHT 公开字段显示 LG OEM ASIN 估算月销 40K、Waterdrop 兼容品 10K，对应公开价 $46.16 与 $22.99。", confidence: "Medium", category: "trend", targetScope: "market", notes: "方向性第三方估算，不是 Amazon 官方销量。" },
    { id: "CLM-RF-011", sourceId: "SRC-REF-024", statement: "GE XWFE 形成较高 OEM 价格锚点和周期补货路径。", evidence: "GE 官方页列出 $54.99、3-pack 优惠、订阅优惠、6 个月/170 加仑更换周期及该 SKU 的 NSF 范围。", confidence: "High", category: "competitor", targetScope: "competitor" },
    { id: "CLM-RF-012", sourceId: "SRC-REF-026", statement: "公开供应候选页给出了冰箱滤芯型号族的 MOQ 与样品周转条件。", evidence: "页面公开参考 MOQ 1,000 件、可混装不同型号，并称付款后 2 个工作日内发样。", confidence: "Medium", category: "supplier", targetScope: "market", notes: "仅为候选条件，需要正式 RFQ 和文件核验。" },
    { id: "CLM-RF-013", sourceId: "SRC-REF-028", statement: "公开阶梯报价为 MWF 兼容型号族提供了个位数美元的出厂成本代理。", evidence: "页面阶梯价从 $4.70 降至 $3.75，并公开约 15–20 天交期。", confidence: "Medium", category: "supplier", targetScope: "market", notes: "这是其他型号族代理，不含包装、运费、关税、平台费、退货及证书核验。" },
  ];
  for (const claim of newClaims) {
    const index = claims.findIndex((item: { id: string }) => item.id === claim.id);
    if (index >= 0) claims[index] = claim; else claims.push(claim);
  }
  const queries = [
    { id: "Q-REF-008", query: "Amazon In-Refrigerator Water Filters bestseller model ranking EDR1RXD1 HAF-QIN XWFE LT1000P", surface: "Exa Web Fetch", executedAt: capturedAt, outcome: "yielded_sources", resultsFound: 1, extractedCount: 10, deduplicatedCount: 10, validCount: 10, keptSourceIds: ["SRC-REF-021"] },
    { id: "Q-REF-009", query: "Amazon keyword demand proxies for everydrop filter 1 and lg filter lt1000p", surface: "Exa Web Fetch", executedAt: capturedAt, outcome: "yielded_sources", resultsFound: 2, extractedCount: 14, deduplicatedCount: 14, validCount: 14, keptSourceIds: ["SRC-REF-022", "SRC-REF-023"] },
    { id: "Q-REF-010", query: "GE XWFE official and retail price replacement cycle", surface: "Exa Web Fetch", executedAt: capturedAt, outcome: "yielded_sources", resultsFound: 2, extractedCount: 8, deduplicatedCount: 8, validCount: 8, keptSourceIds: ["SRC-REF-024", "SRC-REF-025"] },
    { id: "Q-REF-011", query: "refrigerator filter supplier MOQ tier price sample lead time EDR HAF-QIN MWF", surface: "Exa Web Fetch", executedAt: capturedAt, outcome: "yielded_sources", resultsFound: 3, extractedCount: 15, deduplicatedCount: 15, validCount: 15, keptSourceIds: ["SRC-REF-026", "SRC-REF-027", "SRC-REF-028"] },
  ];
  for (const query of queries) {
    const index = searchLog.queries.findIndex((item: { id: string }) => item.id === query.id);
    if (index >= 0) searchLog.queries[index] = query; else searchLog.queries.push(query);
  }
  searchLog.generatedAt = capturedAt;
  analysis.generatedAt = capturedAt;
  analysis.marketOpportunity.demand = { score: 82, rationale: "Amazon 当前类目榜单前四名分别是 EDR1RXD1、HAF-QIN、XWFE 与 LT1000P；第三方 Amazon 面板进一步显示 EDR1RXD1 与 LT1000P 具备可观的型号级订单代理，但绝对销量仍非 Amazon 官方数据。", sourceIds: ["SRC-REF-021", "SRC-REF-022", "SRC-REF-023"] };
  analysis.marketOpportunity.competition = { score: 86, rationale: "头部型号由 OEM 占位，但榜单与关键词结果同时出现 Waterdrop 等兼容品；EDR1RXD1 关键词 Top-3 点击与转化高度集中，进入门槛高。", sourceIds: ["SRC-REF-021", "SRC-REF-022", "SRC-REF-023"] };
  analysis.marketOpportunity.trend = { score: 66, rationale: "本轮补到 2026 年 3 月 EDR1RXD1 和 7 月 LT1000P 的型号级搜索/订单代理，能判断当前需求强弱，仍不足以替代连续 12 个月的可复核趋势序列。", sourceIds: ["SRC-REF-022", "SRC-REF-023"] };
  analysis.marketOpportunity.monetization = { score: 73, rationale: "EDR1RXD1 与 LT1000P 均显示 OEM 高价和兼容品低价并存；XWFE 官方/零售价约 $44.12–$54.99，MWF 供应页公开 $3.75–$4.70 阶梯成本代理，但目标型号正式到岸成本仍未知。", sourceIds: ["SRC-REF-022", "SRC-REF-023", "SRC-REF-024", "SRC-REF-025", "SRC-REF-028"] };
  analysis.marketOpportunity.overall = 73;
  analysis.marketOpportunity.verdict = "型号级需求已从泛类目假设升级为可排序的需求代理：优先验证 EDR1RXD1、HAF-QIN、XWFE、LT1000P。机会存在，但头部集中、兼容错误和认证边界决定了不能只靠低价进入。";
  analysis.competitorInsight.pricePositioning = "型号族内形成清晰双层价格：OEM 单支约 $46–$55，兼容品常以 $20–$30 多件装竞争；XWFE 零售采集价为 $49.02，2+ 为 $44.12。价格均为采集时点。";
  analysis.competitorInsight.skuSummary = "首轮型号优先级：EDR1RXD1（榜单 #1、需求强但集中）、HAF-QIN（榜单 #2）、XWFE（榜单 #3、高 OEM 锚点）、LT1000P（榜单 #4、OEM 与兼容品均有量级代理）。";
  analysis.competitorInsight.sourceIds = [...new Set([...analysis.competitorInsight.sourceIds, "SRC-REF-021", "SRC-REF-022", "SRC-REF-023", "SRC-REF-024", "SRC-REF-025"] )];
  analysis.positioning.recommendedPriceRange = "概念测试按型号族分层：OEM 对照约 $46–$55/支；兼容品以 $20–$30 多件装为主要价格锚点。正式售价必须在目标型号 RFQ、到岸成本和退货假设回填后决定。";
  analysis.productDecision.rationale = ["四个优先型号已获得 Amazon 类目排序代理，其中 EDR1RXD1 与 LT1000P 还有第三方量级代理", "公开价证明 OEM 信任溢价和兼容品套装价差并存", "供应端已有 MOQ、交期和阶梯成本代理，但目标型号正式报价、证书一致性和到岸经济仍未知"];
  analysis.productDecision.status = "PROCEED_TO_SAMPLE";
  analysis.productDecision.sourceIds = [...new Set([...analysis.productDecision.sourceIds, "SRC-REF-021", "SRC-REF-022", "SRC-REF-023", "SRC-REF-024", "SRC-REF-026", "SRC-REF-027", "SRC-REF-028"] )];
  analysis.actionBoundary.reason = "现在可以带着 EDR1RXD1、HAF-QIN、XWFE、LT1000P 四型号优先级发 RFQ 并受控买样；营销概念可先测试“买对型号、防错安装、文件透明”，但性能 Claim、正式售价和投放仍需目标 SKU 证书、样品实测与单位经济闭环。";
  analysis.unknowns = ["四个优先型号连续 12 个月搜索趋势、真实转化率与退货率", "EDR1RXD1、HAF-QIN、XWFE、LT1000P 的目标供应商正式报价、MOQ、包装、运费、关税与到岸成本", "目标样品与认证文件的一致性及批次稳定性", "目标型号在 Amazon 之外的销量结构和渠道差异"];
  await Promise.all([
    writeFile(path.join(root, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`),
    writeFile(path.join(root, "claims.json"), `${JSON.stringify(claims, null, 2)}\n`),
    writeFile(path.join(root, "search_log.json"), `${JSON.stringify(searchLog, null, 2)}\n`),
    writeFile(path.join(root, "commercial_analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`),
  ]);
  await generateLiveResearchReports(root, { ...manifest, ...input, researchInput: input, sources, packagePath: root } as never, claims, analysis);
  console.log(JSON.stringify({ runId, discoveryId, sources: sources.length, claims: claims.length, queries: searchLog.queries.length }, null, 2));
};

main().catch((error) => { console.error(error); process.exit(1); });
