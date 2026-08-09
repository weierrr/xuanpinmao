import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { CheckCircle2, Globe2 } from "lucide-react";
import { researchInputRecordSchema } from "@/research/types";

export const dynamic = "force-dynamic";

export default async function ResearchRunSetupPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) notFound();
  const packagePath = path.join(process.cwd(), "output", "research", runId);
  try {
    const input = researchInputRecordSchema.parse(JSON.parse(await readFile(path.join(packagePath, "research_input.json"), "utf8")));
    return (
      <>
        <div className="topbar">
          <div>
            <span className="fixture-badge">尚未开始联网研究</span>
            <h1 className="title">{input.productName}</h1>
            <p className="subtitle">{input.targetMarket} · {runId}</p>
          </div>
          <Globe2 size={24} />
        </div>
        <section className="callout opportunity-boundary">
          <strong>独立 Research Run 已创建，但还没有商品结论。</strong>
          <p>必须在 Codex 中完成真实联网研究、Evidence Package 校验和导入，才能进入单品尽调与营销转译。</p>
        </section>
        <div className="grid cols-3">
          <div className="card"><CheckCircle2 size={18} /><h3>来源机会</h3><p>{input.description}</p></div>
          <div className="card"><CheckCircle2 size={18} /><h3>目标人群</h3><p>{input.targetAudience ?? "待研究"}</p></div>
          <div className="card"><CheckCircle2 size={18} /><h3>Evidence Package</h3><p className="mono">{path.relative(process.cwd(), packagePath)}</p></div>
        </div>
        <section className="section-stack">
          <h2>下一步</h2>
          <ol className="list">
            <li>在 Codex 中启用 web-access，对此新运行执行公开网页研究。</li>
            <li>补充竞品、VOC、合规、供应候选与反证，不能复用旧商品结论。</li>
            <li>运行 Research 校验、导入、第一性原理、Demand Field 与营销转译。</li>
          </ol>
        </section>
      </>
    );
  } catch {
    notFound();
  }
}
