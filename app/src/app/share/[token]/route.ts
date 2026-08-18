import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { readReportShare } from "@/report-sharing/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token === "refrigerator-water-filter-latest") {
    return NextResponse.redirect(new URL("/discover/plan/whiteboard?discoveryId=discovery-category-9ff30cf30ef8-us", request.url));
  }
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return new NextResponse("Not found", { status: 404 });
  const record = await readReportShare(token);
  if (!record) return new NextResponse("Share link not found", { status: 404 });
  try {
    const html = await readFile(record.reportPath, "utf8");
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch {
    return new NextResponse("Shared report is unavailable", { status: 404 });
  }
}
