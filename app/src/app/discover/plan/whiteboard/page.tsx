import { readFile } from "node:fs/promises";
import { Radio, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { opportunityDiscoveryPaths } from "@/opportunity-discovery/service";
import { opportunityDiscoveryPlanSchema } from "@/opportunity-discovery/types";
import { readResearchWhiteboard } from "@/research-whiteboard/service";
import {
  researchWhiteboardSchema,
  type ResearchWhiteboard,
  type ResearchWhiteboardStageCode,
} from "@/research-whiteboard/types";
import { WorkbenchShell } from "../../../workbench-shell";
import { ResearchWhiteboardCanvas } from "./research-whiteboard-canvas";
import { ResearchWhiteboardReport } from "./research-whiteboard-report";
import { WhiteboardAutoRefresh } from "./whiteboard-auto-refresh";
import {
  legacyYogaExampleDiscoveryId,
  refrigeratorFilterExampleDiscoveryId,
  refrigeratorFilterExamplePlan,
  refrigeratorFilterExampleWhiteboard,
} from "./refrigerator-filter-example";

export const dynamic = "force-dynamic";

const firstParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

const exampleDiscoveryIds = new Set([
  refrigeratorFilterExampleDiscoveryId,
  legacyYogaExampleDiscoveryId,
]);

const statusLabels: Record<ResearchWhiteboard["status"], string> = {
  waiting: "等待 Agent 开始",
  researching: "正在采集证据",
  analyzing: "正在整理分析",
  reporting: "正在生成报告",
  completed: "本轮研究已完成",
  blocked: "存在阻塞项",
};

const stageLabels: Record<ResearchWhiteboardStageCode, string> = {
  scope: "研究对象确认",
  market: "市场证据",
  customer: "用户证据",
  competitor: "竞品证据",
  supply: "供应证据",
  compliance: "合规证据",
  synthesis: "整理分析",
  market_report: "市场与机会",
  customer_report: "用户画像",
  competitor_report: "竞品分析",
  product_report: "产品方案",
  marketing_report: "营销打法",
  validation_report: "验证方案",
  execution: "执行与新证据回流",
};

const inputSummary = (items: string[], empty: string) => items.length > 0 ? `${items.length} 条` : empty;
const versionDate = (value: string): string => new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  timeZone: "Asia/Shanghai",
}).format(new Date(value));
export default async function ResearchWhiteboardPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const query = await searchParams;
  const discoveryId = firstParam(query.discoveryId);
  if (!/^discovery-[a-z0-9-]+$/.test(discoveryId)) notFound();
  if (discoveryId === legacyYogaExampleDiscoveryId) {
    redirect(`/discover/plan/whiteboard?discoveryId=${refrigeratorFilterExampleDiscoveryId}`);
  }

  try {
    const isPublicExample = exampleDiscoveryIds.has(discoveryId);
    const [plan, whiteboard] = isPublicExample
      ? [
          opportunityDiscoveryPlanSchema.parse(refrigeratorFilterExamplePlan),
          researchWhiteboardSchema.parse(refrigeratorFilterExampleWhiteboard),
        ]
      : await Promise.all([
          readFile(opportunityDiscoveryPaths(discoveryId).plan, "utf8")
            .then((rawPlan) => opportunityDiscoveryPlanSchema.parse(JSON.parse(rawPlan))),
          readResearchWhiteboard(discoveryId),
        ]);
    const latestActivity = [...whiteboard.activity].reverse();
    const reportSources = [...new Map(
      Object.values(whiteboard.stages).flatMap((stage) => stage.sources).map((source) => [source.id, source]),
    ).values()];

    return (
      <WorkbenchShell active="discover" hideTitle>
        <WhiteboardAutoRefresh status={whiteboard.status} />
        <section className="research-whiteboard">
          <header className="research-whiteboard-head">
            <div>
              <span>实时调研白板</span>
              <h2>{whiteboard.product}</h2>
              <p>这张白板会随着 Agent 的检索、采集、去重、分析和报告生成持续更新。当前只展示本次研究任务的数据。</p>
            </div>
            <aside className={`research-whiteboard-live status-${whiteboard.status}`}>
              {whiteboard.status === "completed" ? <ShieldCheck size={19} /> : <Radio size={19} />}
              <span><small>当前状态</small><strong>{statusLabels[whiteboard.status]}</strong></span>
            </aside>
          </header>

          <dl className="research-whiteboard-scope">
            <div><dt>目标市场</dt><dd>{whiteboard.market}</dd></div>
            <div><dt>销售渠道</dt><dd>{whiteboard.channel ?? "待研究确认"}</dd></div>
            <div><dt>关键词</dt><dd>{plan.categoryKeyword}</dd></div>
            <div><dt>图片线索</dt><dd>{inputSummary(plan.imageUrls, "未提供")}</dd></div>
            <div><dt>商品链接</dt><dd>{inputSummary(plan.competitorUrls, "未提供")}</dd></div>
            <div>
              <dt>当前调研版本</dt>
              <dd>{whiteboard.researchRunId ? `${versionDate(whiteboard.updatedAt)}更新` : "研究开始后自动建立"}</dd>
            </div>
          </dl>

          <ResearchWhiteboardCanvas whiteboard={whiteboard} />

          {whiteboard.reportModules.length > 0 ? (
            <ResearchWhiteboardReport modules={whiteboard.reportModules} sources={reportSources} />
          ) : null}

          <details className="research-whiteboard-activity">
            <summary>
              <span><small>调研过程</small><strong>查看完整调研日志</strong></span>
              <b>{latestActivity.length} 条记录 · 检索、采集、分析与报告生成</b>
            </summary>
            <ol>
              {latestActivity.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <time>{new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(item.at))}</time>
                  <b>{stageLabels[item.stage]}</b>
                  <span>{item.message}</span>
                </li>
              ))}
            </ol>
          </details>
        </section>
      </WorkbenchShell>
    );
  } catch {
    notFound();
  }
}
