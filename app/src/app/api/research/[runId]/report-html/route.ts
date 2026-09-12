import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  buildPreSampleDecisionBrief,
  preSampleBriefHtml,
  readDemandFieldArtifact,
} from "@/pre-sample/service";

/**
 * Serves the primary self-contained seller report. New runs use the same
 * six-tab whiteboard/PPT layout as the live workbench; older runs fall back to
 * the localized pre-sample brief and finally the legacy analysis report.
 */
export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) return new NextResponse("Invalid research run id", { status: 400 });
  const researchRoot = path.resolve(process.cwd(), "output", "research");
  const runRoot = path.resolve(researchRoot, runId);
  if (!runRoot.startsWith(`${researchRoot}${path.sep}`)) return new NextResponse("Invalid research report path", { status: 400 });
  try {
    return new NextResponse(await readFile(path.join(runRoot, "reports", "whiteboard-report.html"), "utf8"), { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    // Runs generated before the whiteboard artifact use compatibility reports.
  }
  try {
    const [brief, demandField] = await Promise.all([
      buildPreSampleDecisionBrief(runId),
      readDemandFieldArtifact(runId),
    ]);
    return new NextResponse(preSampleBriefHtml(brief, demandField), { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    // Older runs may not have a seller-facing Chinese localization artifact.
  }
  const reportPath = path.join(runRoot, "reports", "analysis-report.html");
  try {
    return new NextResponse(await readFile(reportPath, "utf8"), { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return new NextResponse("Research report not found", { status: 404 });
  }
}
