import { PreSampleBriefView } from "@/pre-sample/pre-sample-brief-view";
import { buildPreSampleDecisionBrief } from "@/pre-sample/service";

export const dynamic = "force-dynamic";

export default async function PreSampleBriefPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) throw new Error("Invalid research run id");
  return <PreSampleBriefView brief={await buildPreSampleDecisionBrief(runId)} />;
}
