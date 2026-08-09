import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/prisma";
import { Metric, PageHeader } from "../../../components";

export default async function RiskPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: {
      decision: true,
      riskModules: { orderBy: { moduleCode: "asc" } },
    },
  });
  if (!run) {
    notFound();
  }

  return (
    <>
      <PageHeader title="风险模块" subtitle="15模块完整路由与证据充分性" status={run.decision?.formalStatus} />
      <div className="grid cols-3">
        <Metric label="模块总数" value={run.riskModules.length} />
        <Metric label="基线模块" value={run.riskModules.filter((module) => module.moduleType === "baseline").length} />
        <Metric label="条件模块" value={run.riskModules.filter((module) => module.moduleType === "conditional").length} />
      </div>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr><th>模块</th><th>名称</th><th>相关性</th><th>执行状态</th><th>证据充分性</th><th>决策可用性</th><th>主责/协同</th><th>下一动作</th></tr>
          </thead>
          <tbody>
            {run.riskModules.map((module) => (
              <tr key={module.id}>
                <td>{module.moduleCode}</td>
                <td>{module.moduleName}</td>
                <td>{module.relevance}</td>
                <td>{module.executionStatus}</td>
                <td>{module.evidenceSufficiency}</td>
                <td>{module.decisionUsability}</td>
                <td>{module.ownerRole}</td>
                <td>{module.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
