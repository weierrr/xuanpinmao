import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingTranslationView } from "@/marketing-translation/marketing-translation-view";
import { readEvidencePackage } from "@/research/evidence-package";
import { readLiveResearchArtifacts } from "@/research/live-research";
import { productNameZh } from "@/presentation/zh";

export const dynamic = "force-dynamic";

export default async function MarketingTranslationPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) notFound();
  try {
    const packagePath = path.join(process.cwd(), "output", "research", runId);
    const [artifacts, evidencePackage] = await Promise.all([
      readLiveResearchArtifacts(packagePath),
      readEvidencePackage(packagePath),
    ]);
    const translation = artifacts.analysis.marketingTranslation;
    if (!translation) {
      return (
        <>
          <div className="topbar"><div><h1 className="title">营销转译</h1><p className="subtitle">{runId}</p></div></div>
          <section className="callout opportunity-boundary">
            <strong>这是可兼容读取的旧版 Research Run，尚未生成营销转译。</strong>
            <p>先完成当前运行的证据与定位，再执行 marketing:generate；原有尽调结论不会被改变。</p>
          </section>
        </>
      );
    }
    return (
      <>
        <div className="topbar">
          <div><span className="live-badge">证据约束的营销表达</span><h1 className="title">营销转译</h1><p className="subtitle">{productNameZh(evidencePackage.researchInput.productName)} · {runId}</p></div>
          <Link className="button secondary-button" href={`/api/research/${runId}/report-html`} target="_blank">查看同步报告</Link>
        </div>
        <MarketingTranslationView translation={translation} />
      </>
    );
  } catch {
    notFound();
  }
}
