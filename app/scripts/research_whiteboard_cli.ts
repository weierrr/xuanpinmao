import { initializeResearchWhiteboard, updateResearchWhiteboard } from "../src/research-whiteboard/service";
import { syncWhiteboardFromResearch } from "../src/research-whiteboard/service";
import {
  researchWhiteboardSourceKindSchema,
  researchWhiteboardSourceStatusSchema,
  researchWhiteboardStageCodeSchema,
  researchWhiteboardStageStatusSchema,
} from "../src/research-whiteboard/types";
import { opportunityDiscoveryPaths, writeOpportunityDiscoveryPlan } from "../src/opportunity-discovery/service";
import { opportunityDiscoveryPlanSchema } from "../src/opportunity-discovery/types";
import { readFile } from "node:fs/promises";
import { readEvidencePackage } from "../src/research/evidence-package";
import { readLiveResearchArtifacts, linkResearchToDiscovery } from "../src/research/live-research";

const command = process.argv[2];
const readOption = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const numberOption = (name: string): number | undefined => {
  const value = readOption(name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`--${name} must be a non-negative integer`);
  return parsed;
};
const required = (name: string): string => {
  const value = readOption(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
};

const main = async () => {
  if (command === "backfill") {
    const packagePath = required("package");
    const [evidencePackage, artifacts] = await Promise.all([
      readEvidencePackage(packagePath),
      readLiveResearchArtifacts(packagePath),
    ]);
    const result = await writeOpportunityDiscoveryPlan({
      categoryKeyword: evidencePackage.researchInput.productName,
      targetMarket: evidencePackage.researchInput.targetMarket,
      targetAudience: evidencePackage.researchInput.targetAudience,
      imageUrls: (evidencePackage.researchInput.imagePaths ?? []).filter((item) => /^https?:\/\//.test(item)),
      competitorUrls: evidencePackage.researchInput.competitors,
      referenceUrls: [],
    });
    await initializeResearchWhiteboard(result.plan);
    await linkResearchToDiscovery(packagePath, result.plan.discoveryId, evidencePackage.manifest.researchRunId);
    const whiteboard = await syncWhiteboardFromResearch(result.plan.discoveryId, evidencePackage, artifacts.claims, artifacts.analysis);
    console.log(JSON.stringify({ status: "backfilled", discoveryId: result.plan.discoveryId, researchRunId: whiteboard.researchRunId }, null, 2));
    return;
  }
  const discoveryId = required("discovery");
  if (command === "sync") {
    const packagePath = required("package");
    const [evidencePackage, artifacts] = await Promise.all([
      readEvidencePackage(packagePath),
      readLiveResearchArtifacts(packagePath),
    ]);
    console.log(JSON.stringify(await syncWhiteboardFromResearch(discoveryId, evidencePackage, artifacts.claims, artifacts.analysis), null, 2));
    return;
  }
  if (command === "init") {
    const raw = await readFile(opportunityDiscoveryPaths(discoveryId).plan, "utf8");
    const plan = opportunityDiscoveryPlanSchema.parse(JSON.parse(raw));
    console.log(JSON.stringify(await initializeResearchWhiteboard(plan), null, 2));
    return;
  }
  if (command !== "update") {
    throw new Error("Usage: npm run research:whiteboard -- <init|sync|update> --discovery <id> [...options], or backfill --package <path>");
  }
  const sourceUrl = readOption("source-url");
  const sourceLabel = readOption("source-label");
  const source = sourceUrl && sourceLabel ? {
    id: `source-${Buffer.from(sourceUrl).toString("base64url").slice(0, 12)}`,
    label: sourceLabel,
    url: sourceUrl,
    kind: researchWhiteboardSourceKindSchema.parse(readOption("source-kind") ?? "other"),
    status: researchWhiteboardSourceStatusSchema.parse(readOption("source-status") ?? "candidate"),
  } : undefined;
  console.log(JSON.stringify(await updateResearchWhiteboard(discoveryId, {
    stage: researchWhiteboardStageCodeSchema.parse(required("stage")),
    status: researchWhiteboardStageStatusSchema.parse(required("status")),
    message: required("message"),
    queryCount: numberOption("query-count"),
    sourceCount: numberOption("source-count"),
    recordCount: numberOption("record-count"),
    researchRunId: readOption("run"),
    source,
  }), null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
