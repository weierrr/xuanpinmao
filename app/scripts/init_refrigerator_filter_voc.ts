import { mkdir, writeFile } from "node:fs/promises";
import { vocCorpusSchema } from "../src/voc/types";
import { vocPaths } from "../src/voc/service";

const main = async (): Promise<void> => {
const runId = "research-run-product-7f4ddc865607-us";
const paths = vocPaths(runId);
const now = new Date().toISOString();
const corpus = vocCorpusSchema.parse({
  schema_version: "1.0",
  run_id: runId,
  product: "冰箱滤芯",
  market: "US",
  generated_at: now,
  methodology: "VOICE_OF_CUSTOMER_RESEARCH_STANDARD_V1",
  denominator_definition: "当前运行中经过去重并保留来源的公开评论级观察数量，不代表美国市场总体发生率。",
  source_pages: [{
    source_id: "SRC-REF-014",
    url: "https://www.waterfiltersfactory.com/fridge-water-filter-cartridges",
    title: "YUNDA refrigerator filter wholesale catalog",
    platform: "YUNDA",
    source_family: "specialist",
    captured_at: now,
    access_status: "accessible",
    snapshot_path: "source_snapshots/refrigerator-filter-14.md",
    product_scope: "category",
    access_notes: "Supplier catalog retained as a source-family baseline; it does not contribute customer-review observations.",
  }],
  observations: [],
  amazon_comment_level_evidence: false,
  limitations: ["Current corpus is an expanding bounded sample and is not representative of all purchasers."],
});
await mkdir(paths.root, { recursive: true });
await writeFile(paths.corpus, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
console.log(paths.corpus);
};
main().catch((error: unknown) => { console.error(error); process.exit(1); });
