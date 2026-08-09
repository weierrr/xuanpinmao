import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { readConclusionGovernance } from "@/conclusion-governance/service";
import { buildConclusionPublicationPreview } from "@/conclusion-publication/builder";
import { publishApprovedConclusionProposal } from "@/conclusion-publication/service";
import { conclusionPublicationDraftSchema } from "@/conclusion-publication/types";
import { buildRunReport, isResearchRunId } from "@/report/service";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  action: z.enum(["preview", "publish"]),
  recordId: z.string().trim().min(6),
  drafts: z.array(conclusionPublicationDraftSchema).min(1),
  expectedGovernanceGeneratedAt: z.iso.datetime().optional(),
  confirmationPhrase: z.string().optional(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!isResearchRunId(runId)) return NextResponse.json({ error: "Invalid research run id" }, { status: 400 });
  try {
    const input = requestSchema.parse(await request.json());
    const report = await buildRunReport(runId);
    const artifact = await readConclusionGovernance(runId, { product: report.product, market: report.market });
    if (!artifact) throw new Error("Current report has no conclusion governance registry");
    if (input.action === "preview") {
      const result = buildConclusionPublicationPreview({
        artifact,
        ledger: report.validationExecutionLedger,
        recordId: input.recordId,
        drafts: input.drafts,
      });
      return NextResponse.json({ preview: result.preview });
    }
    if (!input.expectedGovernanceGeneratedAt || !input.confirmationPhrase) {
      throw new Error("Publication requires preview version and confirmation phrase");
    }
    const result = await publishApprovedConclusionProposal({
      artifact,
      ledger: report.validationExecutionLedger,
      recordId: input.recordId,
      drafts: input.drafts,
      expectedGovernanceGeneratedAt: input.expectedGovernanceGeneratedAt,
      confirmationPhrase: input.confirmationPhrase,
    });
    return NextResponse.json({ preview: result.preview, ledger: result.nextLedger });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to publish conclusion proposal";
    const clientError = error instanceof ZodError || /requires|approved|already|changed|match|cover|current|no conclusion|Invalid/i.test(message);
    return NextResponse.json({ error: message }, { status: clientError ? 400 : 500 });
  }
}

