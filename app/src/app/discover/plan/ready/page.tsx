import { access } from "node:fs/promises";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { opportunityDiscoveryPaths } from "@/opportunity-discovery/service";

const firstParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function DiscoveryPlanReadyPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const query = await searchParams;
  const discoveryId = firstParam(query.discoveryId);
  if (!/^discovery-[a-z0-9-]+$/.test(discoveryId)) notFound();

  try {
    await access(opportunityDiscoveryPaths(discoveryId).plan);
  } catch {
    notFound();
  }

  redirect(`/discover/plan/whiteboard?discoveryId=${encodeURIComponent(discoveryId)}`);
}
