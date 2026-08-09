import { PrismaClient } from "@prisma/client";
import {
  exportFirstPrinciplesRun,
  finalizeFirstPrinciplesRun,
  firstPrinciplesPaths,
  firstPrinciplesUrls,
  importFirstPrinciples,
  prepareFirstPrinciples,
  selectCurrentResearchRun,
  validateFirstPrinciplesFile,
  writeFirstPrinciplesSummary,
} from "../src/first-principles/service";
import { writePreSampleDecisionBrief } from "../src/pre-sample/service";
import {
  importVoc,
  prepareVocResearch,
  validateVocFile,
  writeVocSummary,
} from "../src/voc/service";
import { collectAndAppendBrightDataAmazonVoc } from "../src/voc/amazon-reviews";
import { collectAndAppendJudgeMeVoc } from "../src/voc/judgeme-reviews";
import {
  prepareDemandField,
  validateDemandFieldFile,
  writeDemandFieldSummary,
} from "../src/demand-field/service";
import {
  prepareConsumerPsychology,
  validateConsumerPsychologyFile,
  writeConsumerPsychologySummary,
} from "../src/consumer-psychology/service";
import { validateConclusionGovernanceFile } from "../src/conclusion-governance/service";

process.env.DATABASE_URL ??= "file:./dev.db";

const command = process.argv[2];
const args = process.argv.slice(3);
const hasFlag = (name: string): boolean => args.includes(`--${name}`);
const readOption = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const selectedRunId = async (): Promise<string> => {
  const explicit = readOption("run");
  if (explicit) return explicit;
  if (hasFlag("current")) return (await selectCurrentResearchRun()).researchRunId;
  throw new Error("Use --current or provide --run <research-run-id>");
};

const output = (value: unknown): void => {
  if (typeof value === "string" && !hasFlag("json")) {
    console.log(value);
    return;
  }
  console.log(JSON.stringify(value, null, 2));
};

const requireFile = (): string => {
  const file = readOption("file");
  if (!file) throw new Error("Missing required --file <artifact.json>");
  return file;
};

const main = async (): Promise<void> => {
  const prisma = new PrismaClient();
  try {
    const runId = await selectedRunId();
    if (command === "prepare-first-principles") {
      output(await prepareFirstPrinciples(prisma, runId));
      return;
    }
    if (command === "validate-first-principles") {
      const result = await validateFirstPrinciplesFile(prisma, runId, requireFile());
      output(result);
      if (!result.valid) process.exitCode = 1;
      return;
    }
    if (command === "import-first-principles") {
      output(await importFirstPrinciples(prisma, runId, requireFile()));
      return;
    }
    if (command === "first-principles-summary") {
      const result = await writeFirstPrinciplesSummary(runId);
      output(readOption("format") === "markdown" ? result.markdown : result);
      return;
    }
    if (command === "prepare-voc") {
      output(await prepareVocResearch(runId));
      return;
    }
    if (command === "fetch-amazon-voc") {
      const provider = readOption("provider") ?? "brightdata";
      if (provider !== "brightdata") throw new Error("Only --provider brightdata is currently supported");
      const asins = (readOption("asin") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      const maxReviewsPerAsin = Number(readOption("max-reviews") ?? "100");
      output(await collectAndAppendBrightDataAmazonVoc({
        runId,
        token: process.env.BRIGHTDATA_API_TOKEN ?? "",
        asins,
        maxReviewsPerAsin,
        amazonDomain: readOption("amazon-domain") ?? "amazon.com",
      }));
      return;
    }
    if (command === "fetch-judgeme-voc") {
      const productUrl = readOption("url");
      const shopDomain = readOption("shop-domain");
      const productId = readOption("product-id");
      const platform = readOption("platform");
      if (!productUrl || !shopDomain || !productId || !platform) {
        throw new Error("fetch-judgeme-voc requires --url, --shop-domain, --product-id and --platform");
      }
      output(await collectAndAppendJudgeMeVoc({
        runId,
        productUrl,
        shopDomain,
        productId,
        platform,
        maxPages: Number(readOption("max-pages") ?? "50"),
      }));
      return;
    }
    if (command === "validate-voc") {
      const result = await validateVocFile(runId, requireFile());
      output(result);
      if (!result.valid) process.exitCode = 1;
      return;
    }
    if (command === "import-voc") {
      output(await importVoc(prisma, runId, requireFile()));
      return;
    }
    if (command === "voc-summary") {
      const result = await writeVocSummary(runId);
      output(readOption("format") === "markdown" ? result.markdown : result);
      return;
    }
    if (command === "prepare-demand-field") {
      output(await prepareDemandField(runId));
      return;
    }
    if (command === "validate-demand-field") {
      const result = await validateDemandFieldFile(runId, requireFile());
      output(result);
      if (!result.valid) process.exitCode = 1;
      return;
    }
    if (command === "demand-field-summary") {
      const result = await writeDemandFieldSummary(runId);
      output(readOption("format") === "markdown" ? result.markdown : result);
      return;
    }
    if (command === "prepare-consumer-psychology") {
      output(await prepareConsumerPsychology(runId));
      return;
    }
    if (command === "validate-consumer-psychology") {
      const result = await validateConsumerPsychologyFile(runId, requireFile());
      output(result);
      if (!result.valid) process.exitCode = 1;
      return;
    }
    if (command === "consumer-psychology-summary") {
      const result = await writeConsumerPsychologySummary(runId);
      output(readOption("format") === "markdown" ? result.markdown : result);
      return;
    }
    if (command === "validate-report-conclusions") {
      const result = await validateConclusionGovernanceFile(runId, requireFile());
      output(result);
      if (!result.valid) process.exitCode = 1;
      return;
    }
    if (command === "pre-sample-brief") {
      output(await writePreSampleDecisionBrief(runId));
      return;
    }
    if (command === "finalize") {
      output(await finalizeFirstPrinciplesRun(prisma, runId));
      return;
    }
    if (command === "export") {
      output(await exportFirstPrinciplesRun(runId));
      return;
    }
    if (command === "urls") {
      output({ status: "ready", runId, urls: firstPrinciplesUrls(runId), files: firstPrinciplesPaths(runId) });
      return;
    }
    throw new Error(
      "Usage: npm run workbench -- <prepare-first-principles|validate-first-principles|import-first-principles|first-principles-summary|prepare-voc|fetch-amazon-voc|fetch-judgeme-voc|validate-voc|import-voc|voc-summary|prepare-demand-field|validate-demand-field|demand-field-summary|prepare-consumer-psychology|validate-consumer-psychology|consumer-psychology-summary|validate-report-conclusions|pre-sample-brief|finalize|export|urls> --current [options]",
    );
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: "error", message: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
});
