import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/prisma";
import { Metric, PageHeader } from "../../../components";

const displayMoney = (value: { toString(): string } | null): string => value?.toString() ?? "未知";

export default async function EconomicsPage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: {
      decision: true,
      economicsScenarios: { orderBy: { quantity: "asc" } },
    },
  });
  if (!run) {
    notFound();
  }

  return (
    <>
      <PageHeader title="单位经济" subtitle="1件、2件、3件；正式CM1正确停止" status={run.decision?.formalStatus} />
      <div className="grid cols-3">
        <Metric label="情景数" value={run.economicsScenarios.length} />
        <Metric label="正式CM1" value="未完成" />
        <Metric label="CPA/ROAS" value="不适用" />
      </div>
      <div className="callout" style={{ marginTop: 16 }}>
        未知成本保留为“未知”，不得默认为0；固定成本不得进入CM1。
      </div>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr><th>件数</th><th>收入</th><th>采购情景</th><th>国际物流</th><th>落地成本</th><th>CM1</th><th>盈亏平衡CPA</th><th>盈亏平衡ROAS</th><th>缺失字段</th></tr>
          </thead>
          <tbody>
            {run.economicsScenarios.map((scenario) => (
              <tr key={scenario.id}>
                <td>{scenario.quantity}</td>
                <td>{displayMoney(scenario.netRevenue)}</td>
                <td>{displayMoney(scenario.supplierCost)}</td>
                <td>{displayMoney(scenario.internationalShipping)}</td>
                <td>{displayMoney(scenario.landedCost)}</td>
                <td>{displayMoney(scenario.cm1)}</td>
                <td>{displayMoney(scenario.breakEvenCpa) === "未知" ? "不适用" : displayMoney(scenario.breakEvenCpa)}</td>
                <td>{displayMoney(scenario.breakEvenRoas) === "未知" ? "不适用" : displayMoney(scenario.breakEvenRoas)}</td>
                <td className="mono">{scenario.missingFields}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
