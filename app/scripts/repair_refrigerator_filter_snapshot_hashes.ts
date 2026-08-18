import { readFile } from "node:fs/promises";
import path from "node:path";
import { readEvidencePackage, writeEvidenceSources } from "../src/research/evidence-package";
import { contentHash } from "../src/research/source-normalizer";

const packagePath = path.join(process.cwd(), "output", "research", "research-run-product-7f4ddc865607-us");

const main = async (): Promise<void> => {
  const evidence = await readEvidencePackage(packagePath);
  const repaired = await Promise.all(evidence.sources.map(async (source) => {
    if (!source.snapshotPath) return source;
    const snapshot = await readFile(path.join(packagePath, source.snapshotPath), "utf8");
    return { ...source, contentHash: contentHash(snapshot) };
  }));
  await writeEvidenceSources(packagePath, repaired);
  console.log(JSON.stringify({ repaired: repaired.length, packagePath }));
};

main().catch((error: unknown) => { console.error(error); process.exit(1); });
