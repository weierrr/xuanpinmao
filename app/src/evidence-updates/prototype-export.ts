import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { conclusionGovernancePath } from "../conclusion-governance/service";
import { conclusionGovernanceArtifactSchema } from "../conclusion-governance/types";
import { readConclusionVersionHistory } from "../conclusion-publication/history";
import type { EvidenceAnalysisBundle } from "./recompute";
import { buildEvidenceConclusionReviewProposal } from "./review";
import type { EvidenceUpdateRegistry } from "./types";

export const writeEvidenceRegistryPrototypeData = async (
  registry: EvidenceUpdateRegistry,
  filePath = path.join(process.cwd(), "docs", "generated", "yoga-pants-evidence-registry.js"),
  analysis: EvidenceAnalysisBundle | null = null,
): Promise<string> => {
  const governance = await (async () => {
    try {
      return conclusionGovernanceArtifactSchema.parse(JSON.parse(await readFile(conclusionGovernancePath(registry.runId), "utf8")) as unknown);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  })();
  const reviewProposal = governance && analysis ? buildEvidenceConclusionReviewProposal({ artifact: governance, analysis }) : null;
  const publicationHistory = governance ? await readConclusionVersionHistory({ runId: registry.runId, currentArtifact: governance }) : null;
  const payload = {
    schemaVersion: registry.schemaVersion,
    runId: registry.runId,
    version: registry.version,
    updatedAt: registry.updatedAt,
    totals: registry.totals,
    batches: registry.batches.map((batch) => ({
      batchId: batch.batchId,
      providerLabel: batch.providerLabel,
      channel: batch.channel,
      fidelity: batch.fidelity,
      completedAt: batch.completedAt,
      counts: batch.counts,
      impactedChapterIds: batch.impactedChapterIds,
      boundary: batch.boundary,
    })),
    analysis,
    reviewProposal,
    publicationHistory,
  };
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${Date.now()}.tmp`;
  await writeFile(
    temporary,
    `window.__XUANPINMAO_EVIDENCE_REGISTRY__ = ${JSON.stringify(payload, null, 2)};\n`,
    "utf8",
  );
  await rename(temporary, filePath);
  return filePath;
};
