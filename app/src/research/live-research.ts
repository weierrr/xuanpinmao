import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { readEvidencePackage, validateEvidencePackage } from "./evidence-package";
import { generateLiveResearchReports } from "./live-report";
import { syncWhiteboardFromResearch, updateResearchWhiteboard } from "../research-whiteboard/service";
import {
  liveAnalysisSchema,
  liveResearchStatusSchema,
  researchClaimsSchema,
  type LiveResearchAnalysis,
  type LiveResearchStatus,
  type ResearchClaim,
} from "./live-types";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const liveResearchPaths = (packagePath: string) => ({
  status: path.join(packagePath, "research_status.json"),
  claims: path.join(packagePath, "claims.json"),
  analysis: path.join(packagePath, "commercial_analysis.json"),
  markdownReport: path.join(packagePath, "reports", "decision-report.md"),
  htmlReport: path.join(packagePath, "reports", "analysis-report.html"),
  discoveryLink: path.join(packagePath, "discovery-link.json"),
});

export const linkResearchToDiscovery = async (
  packagePath: string,
  discoveryId: string,
  researchRunId: string,
  now = new Date(),
): Promise<void> => {
  await writeFile(liveResearchPaths(packagePath).discoveryLink, json({
    schemaVersion: "1.0", discoveryId, researchRunId, linkedAt: now.toISOString(),
  }), "utf8");
  await updateResearchWhiteboard(discoveryId, {
    stage: "market",
    status: "in_progress",
    message: "Research Run 已绑定，正在开始采集市场、用户、竞品、供应与合规证据。",
    researchRunId,
  }, now);
};

const linkedDiscoveryId = async (packagePath: string): Promise<string | undefined> => {
  try {
    const raw = JSON.parse(await readFile(liveResearchPaths(packagePath).discoveryLink, "utf8")) as { discoveryId?: string };
    return raw.discoveryId;
  } catch {
    return undefined;
  }
};

const errorMessage = (error: unknown): string => {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
  }
  return error instanceof Error ? error.message : "unknown error";
};

export const initializeLiveResearchStatus = async (packagePath: string, researchRunId: string, now = new Date()): Promise<LiveResearchStatus> => {
  const at = now.toISOString();
  const status = liveResearchStatusSchema.parse({
    researchRunId,
    mode: "live",
    currentStage: "initializing",
    updatedAt: at,
    history: [{ stage: "initializing", at, note: "Live Evidence Package initialized; awaiting Codex web-access execution." }],
  });
  await writeFile(liveResearchPaths(packagePath).status, json(status), "utf8");
  return status;
};

export const updateLiveResearchStatus = async (
  packagePath: string,
  stage: LiveResearchStatus["currentStage"],
  note: string,
  now = new Date(),
): Promise<LiveResearchStatus> => {
  const paths = liveResearchPaths(packagePath);
  const current = liveResearchStatusSchema.parse(JSON.parse(await readFile(paths.status, "utf8")));
  const at = now.toISOString();
  const next = liveResearchStatusSchema.parse({
    ...current,
    currentStage: stage,
    updatedAt: at,
    history: [...current.history, { stage, at, note }],
  });
  await writeFile(paths.status, json(next), "utf8");
  const discoveryId = await linkedDiscoveryId(packagePath);
  if (discoveryId) {
    const mapped = stage === "failed"
      ? { stage: "execution" as const, status: "blocked" as const }
      : stage === "analyzing_market"
        ? { stage: "synthesis" as const, status: "in_progress" as const }
        : stage === "generating_decision"
          ? { stage: "market_report" as const, status: "in_progress" as const }
          : stage === "completed"
            ? { stage: "execution" as const, status: "complete" as const }
            : { stage: "market" as const, status: "in_progress" as const };
    await updateResearchWhiteboard(discoveryId, { ...mapped, message: note, researchRunId: current.researchRunId }, now);
  }
  return next;
};

export const readLiveResearchArtifacts = async (
  packagePath: string,
): Promise<{ status: LiveResearchStatus; claims: ResearchClaim[]; analysis: LiveResearchAnalysis }> => {
  const paths = liveResearchPaths(packagePath);
  const [statusRaw, claimsRaw, analysisRaw] = await Promise.all([
    readFile(paths.status, "utf8"),
    readFile(paths.claims, "utf8"),
    readFile(paths.analysis, "utf8"),
  ]);
  return {
    status: liveResearchStatusSchema.parse(JSON.parse(statusRaw)),
    claims: researchClaimsSchema.parse(JSON.parse(claimsRaw)),
    analysis: liveAnalysisSchema.parse(JSON.parse(analysisRaw)),
  };
};

export const finalizeLiveResearch = async (
  packagePath: string,
): Promise<{
  researchRunId: string;
  sourceCount: number;
  claimCount: number;
  mappingErrors: string[];
  productDecision: LiveResearchAnalysis["productDecision"]["status"];
  markdownPath: string;
  htmlPath: string;
  whiteboardHtmlPath: string;
}> => {
  await updateLiveResearchStatus(packagePath, "analyzing_market", "Validating evidence, claim mappings, and commercial analysis.");
  const validation = await validateEvidencePackage(packagePath);
  if (!validation.valid) {
    await updateLiveResearchStatus(packagePath, "failed", `Evidence Package validation failed: ${validation.errors.map((item) => item.code).join(", ")}`);
    throw new Error(`Evidence Package validation failed: ${validation.errors.map((item) => `${item.code}: ${item.message}`).join("; ")}`);
  }

  let artifacts: Awaited<ReturnType<typeof readLiveResearchArtifacts>>;
  try {
    artifacts = await readLiveResearchArtifacts(packagePath);
  } catch (error) {
    await updateLiveResearchStatus(packagePath, "failed", `Live analysis artifacts are invalid: ${errorMessage(error)}`);
    throw new Error(`Live analysis artifacts are invalid: ${errorMessage(error)}`);
  }

  const evidencePackage = await readEvidencePackage(packagePath);
  if (artifacts.analysis.researchRunId !== evidencePackage.manifest.researchRunId) {
    throw new Error("commercial_analysis.json researchRunId does not match the Evidence Package");
  }

  const sourceById = new Map(evidencePackage.sources.map((source) => [source.id, source]));
  const referencedSourceIds = new Set<string>([
    ...artifacts.claims.map((claim) => claim.sourceId),
    ...artifacts.analysis.marketOpportunity.demand.sourceIds,
    ...artifacts.analysis.marketOpportunity.competition.sourceIds,
    ...artifacts.analysis.marketOpportunity.trend.sourceIds,
    ...artifacts.analysis.marketOpportunity.monetization.sourceIds,
    ...artifacts.analysis.competitorInsight.sourceIds,
    ...artifacts.analysis.customerInsight.sourceIds,
    ...artifacts.analysis.productDecision.sourceIds,
  ]);
  const mappingErrors = [...referencedSourceIds].filter((sourceId) => !sourceById.has(sourceId));

  for (const claim of artifacts.claims) {
    const source = sourceById.get(claim.sourceId);
    if (claim.targetScope === "target_product" && source?.sourceType === "competitor") {
      mappingErrors.push(`${claim.id}: competitor evidence cannot be mapped as a target_product fact`);
    }
  }
  if (mappingErrors.length > 0) {
    await updateLiveResearchStatus(packagePath, "failed", `Source mapping validation failed with ${mappingErrors.length} error(s).`);
    throw new Error(`Source mapping validation failed: ${mappingErrors.join("; ")}`);
  }

  await updateLiveResearchStatus(packagePath, "generating_decision", "Generating Markdown and HTML decision reports from validated live evidence.");
  const reports = await generateLiveResearchReports(packagePath, evidencePackage, artifacts.claims, artifacts.analysis);
  const discoveryId = await linkedDiscoveryId(packagePath);
  if (!discoveryId) {
    throw new Error("This Research Run is not linked to a confirmed discovery plan and whiteboard.");
  }
  await syncWhiteboardFromResearch(discoveryId, evidencePackage, artifacts.claims, artifacts.analysis);
  await updateLiveResearchStatus(packagePath, "completed", "Live Web Research, evidence validation, commercial analysis, and report generation completed.");

  return {
    researchRunId: evidencePackage.manifest.researchRunId,
    sourceCount: evidencePackage.sources.length,
    claimCount: artifacts.claims.length,
    mappingErrors,
    productDecision: artifacts.analysis.productDecision.status,
    markdownPath: reports.markdownPath,
    htmlPath: reports.htmlPath,
    whiteboardHtmlPath: reports.whiteboardHtmlPath,
  };
};
