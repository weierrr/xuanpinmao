import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { readConclusionGovernance } from "@/conclusion-governance/service";
import {
  buildConclusionRollbackPreview,
  readConclusionVersionHistory,
  rollbackConclusionPublication,
} from "@/conclusion-publication/history";
import { buildRunReport, isResearchRunId } from "@/report/service";

export const dynamic = "force-dynamic";

const rollbackRequestSchema = z.object({
  action: z.enum(["preview_rollback", "rollback"]),
  publicationId: z.string().trim().min(6),
  confirmationPhrase: z.string().optional(),
}).strict();

const loadCurrent = async (runId: string) => {
  const report = await buildRunReport(runId);
  const artifact = await readConclusionGovernance(runId, { product: report.product, market: report.market });
  if (!artifact) throw new Error("Current report has no conclusion governance registry");
  return { report, artifact };
};

export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!isResearchRunId(runId)) return NextResponse.json({ error: "Invalid research run id" }, { status: 400 });
  try {
    const { artifact } = await loadCurrent(runId);
    return NextResponse.json({ history: await readConclusionVersionHistory({ runId, currentArtifact: artifact }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read conclusion versions" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!isResearchRunId(runId)) return NextResponse.json({ error: "Invalid research run id" }, { status: 400 });
  try {
    const input = rollbackRequestSchema.parse(await request.json());
    const { report, artifact } = await loadCurrent(runId);
    if (input.action === "preview_rollback") {
      const result = await buildConclusionRollbackPreview({
        runId,
        publicationId: input.publicationId,
        currentArtifact: artifact,
        ledger: report.validationExecutionLedger,
      });
      return NextResponse.json({ preview: result.preview });
    }
    if (!input.confirmationPhrase) throw new Error("Rollback requires confirmation phrase");
    const result = await rollbackConclusionPublication({
      runId,
      publicationId: input.publicationId,
      currentArtifact: artifact,
      ledger: report.validationExecutionLedger,
      confirmationPhrase: input.confirmationPhrase,
    });
    return NextResponse.json({ preview: result.preview, ledger: result.nextLedger });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to rollback conclusion publication";
    const clientError = error instanceof ZodError || /requires|current|latest|match|applied|registry|not found|Invalid/i.test(message);
    return NextResponse.json({ error: message }, { status: clientError ? 400 : 500 });
  }
}
