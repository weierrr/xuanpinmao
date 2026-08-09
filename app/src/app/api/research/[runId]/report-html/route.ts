import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  buildPreSampleDecisionBrief,
  preSampleBriefHtml,
  readDemandFieldArtifact,
} from "@/pre-sample/service";

/**
 * Serves the self-contained HTML report so a seller can hand it to someone
 * outside this app. Prefers the Chinese seller-facing brief and falls back to
 * the analysis report for runs generated before that artifact existed.
 *
 * This used to live at /research/[runId]/report; that path now renders the
 * eight-chapter report page instead.
 */
export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) return new NextResponse("Invalid research run id", { status: 400 });
  try {
    const [brief, demandField] = await Promise.all([
      buildPreSampleDecisionBrief(runId),
      readDemandFieldArtifact(runId),
    ]);
    return new NextResponse(preSampleBriefHtml(brief, demandField), { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    // Older runs may not have a seller-facing Chinese localization artifact.
  }
  const researchRoot = path.resolve(process.cwd(), "output", "research");
  const reportPath = path.resolve(researchRoot, runId, "reports", "analysis-report.html");
  if (!reportPath.startsWith(`${researchRoot}${path.sep}`)) return new NextResponse("Invalid research report path", { status: 400 });
  try {
    return new NextResponse(await readFile(reportPath, "utf8"), { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return new NextResponse("Research report not found", { status: 404 });
  }
}
