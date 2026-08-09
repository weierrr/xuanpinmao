import { buildRunReport } from "../report/service";
import { buildDiscoveryNetworkFromReports } from "./builder";
import type { DiscoveryNetwork } from "./types";
import { buildDiscoveryThemeIndex } from "./theme-index-builder";
import type { DiscoveryThemeIndex } from "./theme-index-types";
import { buildDiscoveryRunRegistryFromReports } from "./run-registry";
import type { DiscoveryRunRegistry } from "./run-registry-types";
import { buildDiscoveryOpportunityQueue } from "./opportunity-queue-builder";
import type { DiscoveryOpportunityQueue } from "./opportunity-queue-types";

export type CurrentDiscoverySystem = {
  registry: DiscoveryRunRegistry;
  network: DiscoveryNetwork;
  themeIndex: DiscoveryThemeIndex;
  opportunityQueue: DiscoveryOpportunityQueue;
};

export const primaryDiscoveryRunId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

export const buildCurrentDiscoverySystem = async (): Promise<CurrentDiscoverySystem> => {
  const report = await buildRunReport(primaryDiscoveryRunId);
  const registry = buildDiscoveryRunRegistryFromReports([report]);
  const network = buildDiscoveryNetworkFromReports([report]);
  const themeIndex = buildDiscoveryThemeIndex(network);
  const opportunityQueue = buildDiscoveryOpportunityQueue(themeIndex);
  return { registry, network, themeIndex, opportunityQueue };
};

export const buildCurrentDiscoveryNetwork = async (): Promise<DiscoveryNetwork> => {
  return (await buildCurrentDiscoverySystem()).network;
};

export const buildCurrentDiscoveryThemeIndex = async (): Promise<DiscoveryThemeIndex> =>
  (await buildCurrentDiscoverySystem()).themeIndex;

export const buildCurrentDiscoveryOpportunityQueue = async (): Promise<DiscoveryOpportunityQueue> =>
  (await buildCurrentDiscoverySystem()).opportunityQueue;
