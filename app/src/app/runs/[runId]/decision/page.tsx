import { notFound, redirect } from "next/navigation";
import { readFirstPrinciplesBundle } from "@/first-principles/service";
import { prisma } from "@/infrastructure/prisma";
import { statusZh } from "@/presentation/zh";
import { ExportButton } from "../../../actions/ExportButton";
import { ActionCard, Metric, PageHeader } from "../../../components";

const parseArray = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
};

export default async function DecisionPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: {
      decision: { include: { missingDataItems: true } },
      reports: { orderBy: { generatedAt: "desc" } },
    },
  });
  if (!run) {
    notFound();
  }
  if (!run.decision) {
    try {
      await readFirstPrinciplesBundle(runId);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") notFound();
      throw error;
    }
    redirect(`/research/${runId}/decision`);
  }

  return (
    <>
      <PageHeader title="决策与报告" subtitle="正式状态、动作边界和导出" status={run.decision.formalStatus} />
      <div className="grid cols-3">
        <Metric label="正式主状态" value={statusZh(run.decision.formalStatus)} />
        <Metric label="适用RunSpec" value={run.decision.applicableRunSpecId} />
        <Metric label="补证项" value={run.decision.missingDataItems.length} />
      </div>
      <div className="actions-grid" style={{ marginTop: 16 }}>
        <ActionCard
          allowed={run.decision.listingAllowed}
          reason={run.decision.listingAllowed ? "当前状态允许发布。" : "暂缓正式供货状态下不允许商品上架。"}
          title="商品上架"
        />
        <ActionCard
          allowed={run.decision.adTestAllowed}
          reason={run.decision.adTestAllowed ? "当前状态允许启动测试。" : "暂缓正式供货状态下不允许启动广告测试。"}
          title="广告测试"
        />
      </div>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <section className="card">
          <h2>决定证据</h2>
          <p>{run.decision.rationale}</p>
          <p className="mono">结论编号：{parseArray(run.decision.determiningClaimIds).join(", ")}</p>
          <p>适用RunSpec：{run.decision.applicableRunSpecId}</p>
        </section>
        <section className="card">
          <h2>导出</h2>
          <ExportButton runId={run.id} />
        </section>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>最小补证清单</h2>
        <ul className="list">
          {run.decision.missingDataItems.map((item) => (
            <li key={item.id}>
              <strong>{item.priority} {item.title}</strong>：{item.minimumCaptureScope}
            </li>
          ))}
        </ul>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>已导出报告</h2>
        <ul className="list">
          {run.reports.map((report) => (
            <li className="mono" key={report.id}>{report.format} v{report.version}: {report.filePath}</li>
          ))}
          {run.reports.length === 0 ? <li>尚未导出</li> : null}
        </ul>
      </section>
    </>
  );
}
