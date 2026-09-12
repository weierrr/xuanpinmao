import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createReportShare } from "@/report-sharing/service";
import { readResearchWhiteboard } from "@/research-whiteboard/service";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) return NextResponse.json({ error: "Invalid research run id" }, { status: 400 });
  try {
    const root = path.join(process.cwd(), "output", "research", runId);
    const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")) as { productName?: string };
    const link = JSON.parse(await readFile(path.join(root, "discovery-link.json"), "utf8")) as { discoveryId?: string };
    if (!manifest.productName || !link.discoveryId) throw new Error("报告尚未绑定研究白板");
    const whiteboard = await readResearchWhiteboard(link.discoveryId);
    if (whiteboard.status !== "completed" || whiteboard.reportModules.length !== 6) {
      throw new Error("报告尚未生成完成");
    }
    const reportPath = path.join(root, "reports", "whiteboard-report.html");
    await readFile(reportPath, "utf8");
    const result = await createReportShare({ runId, discoveryId: link.discoveryId, product: manifest.productName, reportPath });
    return NextResponse.json({ shareUrl: result.shareUrl, token: result.record.token, createdAt: result.record.createdAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "分享链接创建失败";
    const status = /尚未|绑定/.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
