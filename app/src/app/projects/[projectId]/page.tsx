import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/prisma";
import { statusZh } from "@/presentation/zh";
import { ActionCard, Metric, PageHeader } from "../../components";

const parseArray = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : [];
};

export default async function ProjectOverviewPage({ params }: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      runSpecs: { where: { isCurrent: true }, take: 1 },
      researchRuns: {
        include: {
          decision: { include: { missingDataItems: true } },
          runSpec: true,
        },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!project) {
    notFound();
  }

  const run = project.researchRuns[0];
  const runSpec = run?.runSpec ?? project.runSpecs[0];
  const decision = run?.decision;

  return (
    <>
      <PageHeader title={project.name} subtitle="RunSpec 摘要、正式状态和当前禁止动作" status={decision?.formalStatus} />
      <div className="grid cols-3">
        <Metric label="目标市场" value={project.targetMarket} />
        <Metric label="正式主状态" value={decision?.formalStatus ? statusZh(decision.formalStatus) : "未知"} />
        <Metric label="当前RunSpec" value={runSpec?.id ?? "未知"} />
      </div>
      <div className="actions-grid" style={{ marginTop: 16 }}>
        <ActionCard
          allowed={Boolean(decision?.listingAllowed)}
          reason={decision?.listingAllowed ? "当前状态允许发布。" : "暂缓正式供货状态下不允许商品上架。"}
          title="商品上架"
        />
        <ActionCard
          allowed={Boolean(decision?.adTestAllowed)}
          reason={decision?.adTestAllowed ? "当前状态允许启动测试。" : "暂缓正式供货状态下不允许启动广告测试。"}
          title="广告测试"
        />
      </div>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <section className="card">
          <h2>运行规格</h2>
          <p><strong>商品：</strong>{runSpec?.productName}</p>
          <p><strong>变体：</strong>{runSpec?.variant ?? "未知"}</p>
          <p><strong>销售方案：</strong>{runSpec?.offer ?? "未知"}</p>
          <p><strong>履约：</strong>{runSpec?.fulfillmentMode}</p>
          <p><strong>禁止条件：</strong>{runSpec ? parseArray(runSpec.prohibitedConditions).join("；") : "未知"}</p>
        </section>
        <section className="card">
          <h2>缺失数据</h2>
          <ul className="list">
            {decision?.missingDataItems.map((item) => (
              <li key={item.id}>
                <strong>{item.priority}</strong> {item.title}
              </li>
            ))}
          </ul>
        </section>
      </div>
      {run ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>最近运行</h2>
          <p>
            <Link href={`/runs/${run.id}`}>{run.id}</Link>，模型服务：{run.provider} / {run.model}
          </p>
        </div>
      ) : null}
    </>
  );
}
