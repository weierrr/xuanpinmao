import { redirect } from "next/navigation";
import { ReportView } from "@/report/report-view";
import { buildRunReport, isResearchRunId } from "@/report/service";
import type { RunReport } from "@/report/types";

export const dynamic = "force-dynamic";

export default async function RunReportPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  if (!isResearchRunId(runId)) throw new Error("Invalid research run id");

  let report: RunReport;
  try {
    report = await buildRunReport(runId);
  } catch (error) {
    // A run created from an adjacent opportunity has an evidence package but no
    // analysis yet. That is a normal state, not a failure — send the reader to
    // the setup page instead of a 500. Anything else is a real error.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      redirect(`/research/${runId}/setup`);
    }
    throw error;
  }

  return <ReportView report={report} />;
}
