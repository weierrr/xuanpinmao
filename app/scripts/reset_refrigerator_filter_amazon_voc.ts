import { readFile, writeFile } from "node:fs/promises";
import { researchPackagePath } from "../src/first-principles/service";
import { evidencePackagePaths } from "../src/research/evidence-package";
import { researchSourcesSchema } from "../src/research/types";

const main = async (): Promise<void> => {
  const runId = "research-run-product-7f4ddc865607-us";
  const paths = evidencePackagePaths(researchPackagePath(runId));
  const sources = researchSourcesSchema.parse(JSON.parse(await readFile(paths.sources, "utf8")));
  const retained = sources.filter((source) => !source.id.startsWith("SRC-VOC-"));
  await writeFile(paths.sources, `${JSON.stringify(retained, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ removed: sources.length - retained.length, retained: retained.length }));
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
