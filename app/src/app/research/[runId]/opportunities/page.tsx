import { readFile } from "node:fs/promises";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Share2 } from "lucide-react";
import { DemandFieldView } from "@/demand-field/demand-field-view";
import { demandFieldPaths } from "@/demand-field/service";
import { demandFieldArtifactSchema } from "@/demand-field/types";
import { productNameZh } from "@/presentation/zh";
import { ResearchRunner } from "@/research/research-runner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "连续选品机会｜选品猫",
  description: "从当前商品用户需求与任务链延伸出的相邻产品研究方向。",
};

export default async function OpportunityDiscoveryPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  if (!/^[a-z0-9_-]+$/i.test(runId)) notFound();
  try {
    const artifact = demandFieldArtifactSchema.parse(JSON.parse(await readFile(demandFieldPaths(runId).artifact, "utf8")));
    const createResearchRunAction = async (formData: FormData) => {
      "use server";
      const current = demandFieldArtifactSchema.parse(JSON.parse(await readFile(demandFieldPaths(runId).artifact, "utf8")));
      const rawOpportunityId = formData.get("opportunityId");
      const opportunityId = typeof rawOpportunityId === "string" ? rawOpportunityId : "";
      const opportunity = current.adjacent_opportunities.find((item) => item.id === opportunityId);
      if (!opportunity) throw new Error("Unknown adjacent opportunity");
      const audience = current.audience_clusters.find((item) => opportunity.audience_cluster_ids.includes(item.id));
      const result = await ResearchRunner.run({
        mode: "live",
        productName: opportunity.candidate_category,
        targetMarket: current.market,
        targetAudience: audience?.label,
        description: `Independent Research Run created from ${current.run_id} opportunity ${opportunity.id}. ${opportunity.rationale}`,
        competitors: [],
      }, { resume: true });
      redirect(`/research/${result.researchRunId}/setup`);
    };
    const product = productNameZh(artifact.product);
    const market = artifact.market === "US" ? "美国市场" : `${artifact.market} 市场`;
    return (
      <div className="opportunity-share-page">
        <header className="opportunity-share-header">
          <nav className="opportunity-share-nav" aria-label="连续选品页面导航">
            <Link href={`/research/${runId}/report#chapter-positioning`}>
              <ArrowLeft size={16} />返回完整选品报告
            </Link>
            <span><Share2 size={15} />可独立分享的阅读页</span>
          </nav>
          <span className="opportunity-share-kicker">连续选品机会</span>
          <h1>围绕“{product}”用户，还能研究哪些商品？</h1>
          <p>
            从同一批用户的使用场景、前后任务和未满足需求出发，整理可继续调查的相邻产品方向。
            这些是研究候选，不是已经批准采购的选品结论。
          </p>
          <div className="opportunity-share-meta">
            <span>{market}</span>
            <span>{artifact.adjacent_opportunities.length} 个候选方向</span>
            <span>复制本页地址即可分享</span>
          </div>
        </header>

        <main className="opportunity-share-body">
          <DemandFieldView artifact={artifact} createResearchRunAction={createResearchRunAction} />
        </main>

        <footer className="opportunity-share-footer">
          <p>想查看这些方向为什么从原商品中推导出来？</p>
          <Link href={`/research/${runId}/report#chapter-positioning`}>
            返回完整选品报告 <ArrowRight size={16} />
          </Link>
        </footer>
      </div>
    );
  } catch {
    notFound();
  }
}
