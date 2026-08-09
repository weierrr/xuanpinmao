import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { buildRunReport, isResearchRunId } from "@/report/service";
import { applyValidationExecutionMutation } from "@/validation-execution/transitions";
import { writeValidationExecutionLedger } from "@/validation-execution/service";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!isResearchRunId(runId)) return NextResponse.json({ error: "Invalid research run id" }, { status: 400 });
  try {
    const report = await buildRunReport(runId);
    return NextResponse.json({ ledger: report.validationExecutionLedger });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read validation execution" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!isResearchRunId(runId)) return NextResponse.json({ error: "Invalid research run id" }, { status: 400 });
  try {
    const report = await buildRunReport(runId);
    const next = applyValidationExecutionMutation(report.validationExecutionLedger, await request.json());
    await writeValidationExecutionLedger(next);
    return NextResponse.json({ ledger: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update validation execution";
    const isClientError = error instanceof ZodError
      || error instanceof SyntaxError
      || /not found|Only a|requires|Invalid|expected|too_small|validation/i.test(message);
    return NextResponse.json({ error: message }, { status: isClientError ? 400 : 500 });
  }
}
