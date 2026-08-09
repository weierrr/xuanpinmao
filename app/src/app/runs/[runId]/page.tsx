import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/prisma";
import { statusZh } from "@/presentation/zh";
import { Metric, PageHeader } from "../../components";

const stageZh = (value: string): string => ({
  initializing: "初始化",
  searching_web: "联网研究",
  collecting_evidence: "整理证据",
  analyzing_market: "分析市场",
  generating_decision: "生成决策",
  completed: "已完成",
})[value] ?? value;

export default async function RunDetailPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: {
      decision: true,
      workflowStageRuns: { orderBy: [{ createdAt: "asc" }, { attempt: "asc" }] },
      modelCalls: true,
    },
  });

  if (!run) {
    notFound();
  }

  return (
    <>
      <PageHeader title="运行详情" subtitle={run.id} status={run.decision?.formalStatus} />
      <div className="grid cols-3">
        <Metric label="运行状态" value={statusZh(run.status)} />
        <Metric label="模型服务" value={run.provider} />
        <Metric label="模型调用" value={run.modelCalls.length} />
      </div>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>阶段</th>
              <th>状态</th>
              <th>尝试次数</th>
              <th>开始</th>
              <th>结束</th>
              <th>错误</th>
              <th>日志</th>
            </tr>
          </thead>
          <tbody>
            {run.workflowStageRuns.map((stage) => (
              <tr key={stage.id}>
                <td>{stageZh(stage.stageCode)}</td>
                <td>{statusZh(stage.status)}</td>
                <td>{stage.attempt}</td>
                <td>{stage.startedAt.toLocaleString("zh-CN")}</td>
                <td>{stage.completedAt?.toLocaleString("zh-CN") ?? "未完成"}</td>
                <td>{stage.errorCode ?? ""}</td>
                <td className="mono">{stage.log}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
