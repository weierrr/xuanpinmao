import { FirstPrinciplesView } from "@/first-principles/first-principles-view";
import { readFirstPrinciplesBundle } from "@/first-principles/service";
import { readVocSummary } from "@/voc/service";
import { buildPreSampleDecisionBrief } from "@/pre-sample/service";

export const dynamic = "force-dynamic";

export default async function FirstPrinciplesPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) throw new Error("Invalid research run id");
  const [bundle, vocSummary, brief] = await Promise.all([
    readFirstPrinciplesBundle(runId),
    readVocSummary(runId),
    buildPreSampleDecisionBrief(runId),
  ]);
  return <FirstPrinciplesView bundle={bundle} vocSummary={vocSummary} brief={brief} />;
}
