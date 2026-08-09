import { readFile } from "node:fs/promises";
import path from "node:path";
import { demandFieldPaths } from "../demand-field/service";
import { demandFieldArtifactSchema, type DemandFieldArtifact } from "../demand-field/types";
import { readEvidencePackage } from "../research/evidence-package";
import type { LiveResearchAnalysis, ResearchClaim } from "../research/live-types";
import { readLiveResearchArtifacts } from "../research/live-research";
import type { EvidencePackage } from "../research/types";
import { readVocSummary } from "../voc/service";
import type { VocSummary } from "../voc/types";

export type LiveEvidenceCenter = {
  evidencePackage: EvidencePackage;
  claims: ResearchClaim[];
  analysis: LiveResearchAnalysis;
  vocSummary: VocSummary | null;
  demandField: DemandFieldArtifact | null;
  claimCountBySource: Map<string, number>;
  missingClaimSourceIds: string[];
};

const readDemandField = async (runId: string): Promise<DemandFieldArtifact | null> => {
  try {
    return demandFieldArtifactSchema.parse(JSON.parse(await readFile(demandFieldPaths(runId).artifact, "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
};

export const loadLiveEvidenceCenter = async (runId: string): Promise<LiveEvidenceCenter | null> => {
  const packagePath = path.join(process.cwd(), "output", "research", runId);
  try {
    const [evidencePackage, artifacts, vocSummary, demandField] = await Promise.all([
      readEvidencePackage(packagePath),
      readLiveResearchArtifacts(packagePath),
      readVocSummary(runId),
      readDemandField(runId),
    ]);
    const sourceIds = new Set(evidencePackage.sources.map((source) => source.id));
    const claimCountBySource = new Map<string, number>();
    for (const claim of artifacts.claims) {
      claimCountBySource.set(claim.sourceId, (claimCountBySource.get(claim.sourceId) ?? 0) + 1);
    }
    return {
      evidencePackage,
      claims: artifacts.claims,
      analysis: artifacts.analysis,
      vocSummary,
      demandField,
      claimCountBySource,
      missingClaimSourceIds: [...new Set(artifacts.claims
        .filter((claim) => !sourceIds.has(claim.sourceId))
        .map((claim) => claim.sourceId))],
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
};
