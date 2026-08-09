import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  conclusionGovernanceArtifactSchema,
  type ConclusionGovernanceArtifact,
  type ConclusionGovernanceValidationResult,
  type ConclusionTopic,
  type GovernedConclusion,
} from "./types";
import { validateConclusionGovernance } from "./validation";

export const conclusionGovernancePath = (runId: string, root = process.cwd()): string =>
  path.join(root, "config", "report-conclusions", `${runId}.json`);

export const validateConclusionGovernanceFile = async (
  runId: string,
  filePath: string,
  expected?: { product: string; market: string },
): Promise<ConclusionGovernanceValidationResult> => {
  const payload = JSON.parse(await readFile(path.resolve(filePath), "utf8")) as unknown;
  const parsed = conclusionGovernanceArtifactSchema.safeParse(payload);
  const product = expected?.product ?? (parsed.success ? parsed.data.product : "unknown");
  const market = expected?.market ?? (parsed.success ? parsed.data.market : "unknown");
  return validateConclusionGovernance(payload, { reportRunId: runId, product, market });
};

export const readConclusionGovernance = async (
  runId: string,
  expected: { product: string; market: string },
): Promise<ConclusionGovernanceArtifact | null> => {
  const filePath = conclusionGovernancePath(runId);
  try {
    const payload = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    const validation = validateConclusionGovernance(payload, {
      reportRunId: runId,
      product: expected.product,
      market: expected.market,
    });
    if (!validation.valid) {
      throw new Error(`Conclusion governance validation failed for ${runId}: ${validation.errors.map((item) => item.code).join(", ")}`);
    }
    return conclusionGovernanceArtifactSchema.parse(payload);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

export const currentConclusionsByTopic = (
  artifact: ConclusionGovernanceArtifact,
): Partial<Record<ConclusionTopic, GovernedConclusion[]>> => {
  const result: Partial<Record<ConclusionTopic, GovernedConclusion[]>> = {};
  for (const conclusion of artifact.conclusions.filter((item) => item.status === "current")) {
    result[conclusion.topic] = [...(result[conclusion.topic] ?? []), conclusion];
  }
  return result;
};
