import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { researchInputRecordSchema } from "./types";

export type PendingRun = {
  runId: string;
  productName: string;
  targetMarket: string;
  createdAt: string;
  /** Where this run came from, when it was spawned by another run. */
  description: string;
};

/**
 * Research runs that exist on disk but have not been imported into the
 * database yet.
 *
 * A run created from an adjacent opportunity only gets an evidence-package
 * skeleton — no analysis, no database row. Without listing these, a seller who
 * spawns a run has no way back to it: the project list is database-backed and
 * would silently omit it.
 */
export const readPendingRuns = async (
  knownRunIds: ReadonlySet<string>,
  options: {
    outputRoot?: string;
    excludedRunIds?: ReadonlySet<string>;
  } = {},
): Promise<PendingRun[]> => {
  const outputRoot = options.outputRoot ?? path.join(process.cwd(), "output", "research");
  const excludedRunIds = options.excludedRunIds ?? new Set<string>();
  let entries: string[];
  try {
    entries = await readdir(outputRoot);
  } catch {
    return [];
  }

  const pending = await Promise.all(
    entries
      .filter((runId) => !knownRunIds.has(runId) && !excludedRunIds.has(runId))
      .map(async (runId): Promise<PendingRun | null> => {
        try {
          const raw = await readFile(path.join(outputRoot, runId, "research_input.json"), "utf8");
          const input = researchInputRecordSchema.parse(JSON.parse(raw));
          return {
            runId,
            productName: input.productName,
            targetMarket: input.targetMarket,
            createdAt: input.createdAt,
            description: input.description ?? "",
          };
        } catch {
          // Not a readable run package — skip rather than fail the whole list.
          return null;
        }
      }),
  );

  return pending
    .filter((run): run is PendingRun => run !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};
