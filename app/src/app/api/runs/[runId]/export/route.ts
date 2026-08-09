import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/prisma";
import { exportRunReports } from "@/infrastructure/report-export";

export async function POST(_: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const result = await exportRunReports(prisma, runId);
  return NextResponse.json(result);
}
