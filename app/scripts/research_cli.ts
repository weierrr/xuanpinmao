import { PrismaClient } from "@prisma/client";
import { linkResearchToDiscovery, finalizeLiveResearch } from "../src/research/live-research";
import { ResearchRunner, initializeResearchPackage, importResearchRunPackage, validateResearchPackage } from "../src/research/research-runner";
import { opportunityDiscoveryPaths } from "../src/opportunity-discovery/service";
import { opportunityDiscoveryPlanSchema } from "../src/opportunity-discovery/types";
import { readFile } from "node:fs/promises";

const readOption = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const readOptions = (name: string): string[] =>
  process.argv.flatMap((arg, index) => (arg === `--${name}` && process.argv[index + 1] ? [process.argv[index + 1]] : []));

const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);

const readPositiveInteger = (name: string): number | undefined => {
  const value = readOption(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} must be a positive integer`);
  return parsed;
};

const resourceOptions = () => ({
  budget: readOption("budget"),
  availableTime: readOption("available-time"),
  teamSize: readPositiveInteger("team-size"),
  currentSupplierResources: readOptions("supplier-resource"),
  currentChannelAssets: readOptions("channel-asset"),
  currentContentAssets: readOptions("content-asset"),
  acceptableMoq: readOption("acceptable-moq"),
  targetMargin: readOption("target-margin"),
  unacceptableRisks: readOptions("unacceptable-risk"),
  preferredBusinessModel: readOption("business-model"),
  validationGoal: readOption("validation-goal"),
});

const command = process.argv[2];

process.env.DATABASE_URL ??= "file:./dev.db";

const main = async (): Promise<void> => {
  if (command === "live") {
    const packagePath = readOption("package");
    if (packagePath && hasFlag("finalize")) {
      const result = await finalizeLiveResearch(packagePath);
      console.log(JSON.stringify({ status: "completed", mode: "live", ...result }, null, 2));
      return;
    }

    const discoveryId = readOption("discovery");
    if (!discoveryId) {
      throw new Error("New live research must start from the confirmed page. Pass --discovery <id> from /discover/plan/whiteboard.");
    }
    const discoveryPlan = opportunityDiscoveryPlanSchema.parse(JSON.parse(
      await readFile(opportunityDiscoveryPaths(discoveryId).plan, "utf8"),
    ));
    const productName = discoveryPlan.categoryKeyword;
    const targetMarket = discoveryPlan.targetMarket;
    const description = readOption("description");
    const currency = readOption("currency");
    const targetAudience = discoveryPlan.targetAudience;
    const imagePaths = discoveryPlan.imageUrls;
    const competitors = discoveryPlan.competitorUrls.length > 0
      ? discoveryPlan.competitorUrls
      : discoveryPlan.referenceUrls.filter((url) => !discoveryPlan.imageUrls.includes(url));
    const resume = hasFlag("resume");
    if (competitors.length === 0) {
      throw new Error("The confirmed discovery plan needs at least one product or competitor URL before creating a live Research Run.");
    }
    const result = await ResearchRunner.run(
      { mode: "live", productName, targetMarket, description, currency, targetAudience, imagePaths, competitors, ...resourceOptions() },
      { resume },
    );
    await linkResearchToDiscovery(result.packagePath, discoveryId, result.researchRunId);
    console.log(JSON.stringify({ status: "awaiting_web_access", ...result }, null, 2));
    return;
  }

  if (command === "init") {
    const productName = readOption("product");
    const targetMarket = readOption("market");
    const description = readOption("description");
    const currency = readOption("currency");
    const imagePaths = readOptions("image");
    const resume = hasFlag("resume");
    if (!productName || !targetMarket) {
      throw new Error('Usage: npm run research:init -- --product "portable jewelry organizer" --market "US" [--currency USD] [--image /path/to/image.png] [--resume]');
    }
    const result = await initializeResearchPackage(
      { productName, targetMarket, description, currency, imagePaths, ...resourceOptions() },
      undefined,
      undefined,
      { resume },
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "validate") {
    const packagePath = readOption("package");
    if (!packagePath) {
      throw new Error("Usage: npm run research:validate -- --package output/research/<research-run-id>");
    }
    const result = await validateResearchPackage(packagePath);
    console.log(JSON.stringify({ status: result.valid ? "valid" : "invalid", ...result }, null, 2));
    if (!result.valid) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "import") {
    const packagePath = readOption("package");
    if (!packagePath) {
      throw new Error("Usage: npm run research:import -- --package output/research/<research-run-id>");
    }
    const prisma = new PrismaClient();
    try {
      const result = await importResearchRunPackage(prisma, packagePath);
      console.log(JSON.stringify({ status: "imported", ...result }, null, 2));
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  throw new Error("Usage: tsx scripts/research_cli.ts <init|live|validate|import> [options]");
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
