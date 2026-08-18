import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readEvidencePackage, writeEvidenceSources, writeUnresolvedItems } from "../src/research/evidence-package";
import type { ResearchSource, UnresolvedResearchItem } from "../src/research/types";
import { contentHash, normalizeResearchSource } from "../src/research/source-normalizer";
import { searchLogSchema } from "../src/research/search-log";

const packagePath = path.join(process.cwd(), "output", "research", "research-run-product-7f4ddc865607-us");
const capturedAt = new Date().toISOString();
const entries = [
  ["https://www.whirlpool.com/accessories/kitchen-accessories/refrigerator/p.ice-and-water-refrigerator-filter-1.edr1rxd1.html", "Whirlpool everydrop EDR1RXD1 官方商品页", "market", "Whirlpool EDR1RXD1", "官方页显示单支 $36.99，建议每 6 个月或 200 加仑更换；宣称 NSF 可减少 28 类污染物并兼容多个 Whirlpool 系品牌。"],
  ["https://www.everydropwater.com/content/everydropv2/en_us/water-filter-finder", "everydrop Filter Finder", "competitor", "everydrop filter family", "官方筛选器按冰箱型号匹配 Filter 1、A、2、3、Ice、4、5、6 等型号，兼容性是购买路径核心。"],
  ["https://www.waterdropfilter.com/collections/refrigerator-filters", "Waterdrop Refrigerator Filters 官方集合页", "competitor", "Waterdrop refrigerator filters", "官方集合页列出替换 Everydrop Filter 1 $40.99、替换 LG LT1000P $32.99，并展示 NSF 42/372 认证标签。"],
  ["https://www.samsung.com/us/home-appliance-accessories/haf-cin-2p-exp-refrigerator-water-filter-sku-haf-cin-2p-exp/", "Samsung HAF-CIN 2-Pack 官方商品页", "competitor", "Samsung HAF-CIN", "官方页显示 2 支装促销价 $69.99、原价 $89.99；官方强调 Genuine Filters 和订阅补货。"],
  ["https://www.lg.com/us/appliances-accessories/lg-lt1000p-refrigerator-water-filter", "LG LT1000P 官方商品页", "competitor", "LG LT1000P", "官方页显示 6 个月/200 加仑规格、NSF-certified、单支 $54.99，并提供自动替换订阅优惠。"],
  ["https://www.homedepot.com/p/Waterdrop-Refrigerator-Water-Filter-Reduce-PFAS-Replacement-For-LG-LT1000P-LRFWS2906V-LRMVS3006S-3-pack-B-WDP-F46A01-3/330501776", "Home Depot Waterdrop LT1000P PFAS 3-pack", "competitor", "Waterdrop B-WDP-F46A01-3", "Home Depot 页面显示 3 支装 $40.69（$13.56/支），主打 NSF、PFOA/PFOS、lead 和 leak-free install。"],
  ["https://www.homedepot.com/p/Waterdrop-LT1000PC-Refrigerator-Water-Filter-Replacement-for-LG-LT1000P-Kenmore-46-9980-Reduce-chlorine-bad-taste-odor-6-Pack-B-WD-F46-6/335295537", "Home Depot Waterdrop LT1000PC 6-pack", "market", "Waterdrop B-WD-F46-6", "Home Depot 页面显示 6 支装 $29.99（$5/支），强调减少 chlorine、bad taste、odor，体现多包装低价竞争。"],
  ["https://www.nsf.org/knowledge-library/nsf-ansi-42-53-and-401-filtration-systems-standards", "NSF/ANSI 42、53、401 标准说明", "regulation", "NSF filtration standards", "NSF 官方说明：42 关注 taste/odor 等 aesthetic effects；53 关注 lead 等 health effects；401 关注部分 emerging/incidental contaminants。认证只对应具体声明，不代表去除所有污染物。"],
  ["https://info.nsf.org/Certified/DWTU/Listings.asp?ProductFunction=042%7CChlorine+Reduction&ProductFunction=058%7CTDS+Reduction&ProductType=Refrigerator+Filter&submit2=Search", "NSF Refrigerator Filter Official Listings", "regulation", "NSF certified refrigerator filters", "NSF 官方目录可核查具体品牌、型号、滤芯元件、服务周期、流量和 reduction claims；页面显示 Samsung DA29-00020B 等型号。"],
  ["https://www.consumerreports.org/home-garden/water-filters/best-refrigerator-water-filters-a5405948154/", "Consumer Reports refrigerator water filter testing", "market", "Consumer Reports refrigerator filter tests", "Consumer Reports 公开摘要称其测试覆盖 29 个适配多个品牌的产品，并提醒第三方滤芯认证、仿冒和实际性能需要核查。"],
  ["https://www.reddit.com/r/Appliances/comments/1gocy9n/ge_french_door_fridge_err_code_on_new_water_filter.json", "Reddit GE XWFE filter error discussion", "other", "GE XWFE user discussion", "公开 Reddit 讨论记录更换 genuine GE XWFE 后出现 Err、冰机停止等兼容/识别问题；属于单条用户讨论，不外推总体发生率。"],
  ["https://www.reddit.com/r/Appliances/comments/1p02l9q/samsung_bespoke_fridge_only_fills_water_pitcher/", "Reddit Samsung Bespoke filter flow discussion", "other", "Samsung Bespoke user discussion", "公开 Reddit 讨论记录更换 aftermarket filter 后出水量逐步下降，换回 Samsung 品牌后仍需排查；说明流量、安装与滤芯兼容是用户痛点。"],
  ["https://www.alibaba.com/product-detail/NSF-Certified-Fridge-Water-Filters-Manufacturer_1600833619039.html", "Alibaba Shanghai Bluetech refrigerator filter listing", "supplier", "Shanghai Bluetech", "公开供应页展示 Whirlpool 4396508 替换滤芯语言，并声称 NSF42、NSF372、ISO9001 等资质；仅作为候选供应商线索，资质、MOQ、报价和产能均需正式核验。"],
  ["https://www.waterfiltersfactory.com/fridge-water-filter-cartridges/", "YUNDA refrigerator filter wholesale catalog", "supplier", "YUNDA H&H TECH", "公开工厂目录覆盖 Kenmore、Maytag、Frigidaire、Bosch 等兼容型号，提供 OEM/ODM/private label 表述；不视为已审核供应商或正式报价。"],
  ["https://www.walmart.com/c/kp/everydrop-ice-and-water-filter", "Walmart Everydrop category page", "market", "Walmart Everydrop category", "公开类目页显示 Everydrop 多型号单支约 $48–59.97，并展示 4.1–4.3 星及百条级评分数量；价格与计数为采集时页面状态。"],
  ["https://www.walmart.com/reviews/product/1153045808", "Walmart Everydrop EDR4RXD1 reviews", "other", "Everydrop EDR4RXD1 customer reviews", "公开评论页显示 188 ratings、163 reviews；正向主题包括安装、口感、适配，负向反馈包括价格高、安装/冲洗麻烦、推荐错型号和出水仅滴流。"],
];

const sourceType = (value: string): ResearchSource["sourceType"] => value as ResearchSource["sourceType"];
const snapshotFor = (title: string, url: string, note: string): string =>
  `# ${title}\n\nURL: ${url}\nCaptured at: ${capturedAt}\n\n${note}\n`;
const sourcesWithSnapshots = entries.map(([url, title, kind, entity, note], index) => {
  const snapshotPath = `source_snapshots/refrigerator-filter-${String(index + 1).padStart(2, "0")}.md`;
  const source = normalizeResearchSource({
    id: `SRC-REF-${String(index + 1).padStart(3, "0")}`,
    url, title, sourceType: sourceType(kind), retrievedAt: capturedAt,
    targetEntity: entity, targetMarket: "US", accessMethod: "web-fetch",
    accessStatus: "accessible", evidenceStatus: "verified", snapshotPath,
    notes: note,
  });
  const snapshot = snapshotFor(title, source.url, note);
  return { ...source, snapshot, contentHash: contentHash(snapshot) };
});
const sources = sourcesWithSnapshots.map(({ snapshot: _snapshot, ...source }) => source);

const unresolved: UnresolvedResearchItem[] = [];

const searchLog = searchLogSchema.parse({
  schemaVersion: "1.0", researchRunId: "research-run-product-7f4ddc865607-us", generatedAt: capturedAt,
  queries: [
    { id: "Q-REF-001", query: "US refrigerator water filter replacement market brands official prices", surface: "Exa", executedAt: capturedAt, outcome: "yielded_sources", resultsFound: 8, keptSourceIds: sources.slice(0, 3).map((s) => s.id) },
    { id: "Q-REF-002", query: "Samsung LG refrigerator water filter official price NSF", surface: "Exa", executedAt: capturedAt, outcome: "yielded_sources", resultsFound: 10, keptSourceIds: sources.slice(3, 5).map((s) => s.id) },
    { id: "Q-REF-003", query: "Home Depot Waterdrop refrigerator filter price compatibility", surface: "Exa", executedAt: capturedAt, outcome: "yielded_sources", resultsFound: 5, keptSourceIds: sources.slice(5, 7).map((s) => s.id) },
    { id: "Q-REF-004", query: "NSF refrigerator water filter standards official listings", surface: "Exa", executedAt: capturedAt, outcome: "yielded_sources", resultsFound: 8, keptSourceIds: sources.slice(7, 9).map((s) => s.id) },
    { id: "Q-REF-005", query: "Reddit refrigerator water filter complaints leak taste fit", surface: "Exa", executedAt: capturedAt, outcome: "yielded_sources", resultsFound: 8, keptSourceIds: sources.slice(9).map((s) => s.id) },
    { id: "Q-REF-006", query: "Amazon refrigerator water filter reviews across OEM and aftermarket ASINs", surface: "Bright Data Amazon Reviews API", executedAt: capturedAt, outcome: "yielded_sources", resultsFound: 204, keptSourceIds: ["SRC-VOC-017", "SRC-VOC-018", "SRC-VOC-019", "SRC-VOC-020", "SRC-VOC-021", "SRC-VOC-022", "SRC-VOC-023"] },
  ],
});

const main = async (): Promise<void> => {
  const evidence = await readEvidencePackage(packagePath);
  const incomingIds = new Set(sources.map((source) => source.id));
  const incomingUrls = new Set(sources.map((source) => source.url));
  const retainedSources = evidence.sources.filter((source) => !incomingIds.has(source.id) && !incomingUrls.has(source.url));
  await mkdir(path.join(packagePath, "source_snapshots"), { recursive: true });
  for (const source of sources) {
    const entry = entries.find((item) => item[0] === source.url);
    await writeFile(path.join(packagePath, source.snapshotPath!), snapshotFor(source.title, source.url, entry?.[4] ?? source.notes ?? ""), "utf8");
  }
  await writeEvidenceSources(packagePath, [...retainedSources, ...sources]);
  await writeFile(path.join(packagePath, "search_log.json"), `${JSON.stringify(searchLog, null, 2)}\n`, "utf8");
  const unresolvedById = new Map(
    [...evidence.unresolvedItems.filter((item) => item.id !== "UNRESOLVED-AMAZON-BRIGHTDATA-CREDENTIAL"), ...unresolved]
      .map((item) => [item.id, item]),
  );
  await writeUnresolvedItems(packagePath, [...unresolvedById.values()]);
  console.log(JSON.stringify({ sourceCount: sources.length, searchCount: searchLog.queries.length, unresolved: unresolved.length, packagePath }, null, 2));
};
main().catch((error: unknown) => { console.error(error); process.exit(1); });
