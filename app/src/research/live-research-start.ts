import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { opportunityDiscoveryPaths } from "@/opportunity-discovery/service";
import { opportunityDiscoveryPlanSchema } from "@/opportunity-discovery/types";
import { readResearchWhiteboard } from "@/research-whiteboard/service";
import { liveResearchInputFromDiscovery } from "./confirmed-discovery";
import { linkResearchToDiscovery } from "./live-research";
import { ResearchRunner } from "./research-runner";

const inFlight = new Map<string, Promise<StartLiveResearchResult>>();

export type StartLiveResearchResult = {
  status: "started" | "already_started";
  discoveryId: string;
  researchRunId: string;
  packagePath: string;
  nextAction: string;
};

const readSavedRun = async (discoveryId: string): Promise<StartLiveResearchResult | undefined> => {
  const whiteboard = await readResearchWhiteboard(discoveryId);
  if (!whiteboard.researchRunId) return undefined;
  const packagePath = path.join(process.cwd(), "output", "research", whiteboard.researchRunId);
  if (!await access(packagePath).then(() => true).catch(() => false)) return undefined;
  return {
    status: "already_started",
    discoveryId,
    researchRunId: whiteboard.researchRunId,
    packagePath,
    nextAction: "Research Run 已存在，继续使用当前白板采集证据。",
  };
};

export const startLiveResearchForDiscovery = (discoveryId: string): Promise<StartLiveResearchResult> => {
  const existing = inFlight.get(discoveryId);
  if (existing) return existing;

  const task = (async (): Promise<StartLiveResearchResult> => {
    const saved = await readSavedRun(discoveryId);
    if (saved) return saved;
    const plan = opportunityDiscoveryPlanSchema.parse(JSON.parse(
      await readFile(opportunityDiscoveryPaths(discoveryId).plan, "utf8"),
    ));
    const result = await ResearchRunner.run(liveResearchInputFromDiscovery(plan, {}));
    await linkResearchToDiscovery(result.packagePath, discoveryId, result.researchRunId);
    return {
      status: "started",
      discoveryId,
      researchRunId: result.researchRunId,
      packagePath: result.packagePath,
      nextAction: result.nextAction,
    };
  })();
  inFlight.set(discoveryId, task);
  void task.finally(() => inFlight.delete(discoveryId));
  return task;
};
