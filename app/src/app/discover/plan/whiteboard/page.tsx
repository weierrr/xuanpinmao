import { readFile } from "node:fs/promises";
import { ExternalLink, LoaderCircle, Radio, Search, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { opportunityDiscoveryPaths } from "@/opportunity-discovery/service";
import { opportunityDiscoveryPlanSchema } from "@/opportunity-discovery/types";
import { readResearchWhiteboard } from "@/research-whiteboard/service";
import type { ResearchWhiteboard, ResearchWhiteboardStageCode } from "@/research-whiteboard/types";
import { WorkbenchShell } from "../../../workbench-shell";
import { WhiteboardAutoRefresh } from "./whiteboard-auto-refresh";

export const dynamic = "force-dynamic";

const firstParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

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

const columns: ReadonlyArray<{
  eyebrow: string;
  title: string;
  description: string;
  stages: readonly ResearchWhiteboardStageCode[];
}> = [
  { eyebrow: "01 · SCOPE", title: "输入与范围", description: "先确认到底研究什么，避免相邻品类和错误链接混入。", stages: ["scope"] },
  { eyebrow: "02 · SOURCES", title: "数据来源", description: "按市场、用户、竞品、供应和合规分开采集。", stages: ["market", "customer", "competitor", "supply", "compliance"] },
  { eyebrow: "03 · COLLECTION", title: "Agent 采集记录", description: "实时显示检索次数、来源数量和有效记录。", stages: ["market", "customer", "competitor", "supply", "compliance"] },
  { eyebrow: "04 · ANALYSIS", title: "整理分析", description: "把原始材料整理成价格、趋势、需求、竞争与证据缺口。", stages: ["synthesis"] },
  { eyebrow: "05 · OUTPUT", title: "报告与执行", description: "输出六个卖家问题，并允许后续新证据持续回流。", stages: ["market_report", "customer_report", "competitor_report", "product_report", "marketing_report", "validation_report", "execution"] },
];

const inputSummary = (items: string[], empty: string) => items.length > 0 ? `${items.length} 条` : empty;
const evidenceLevelLabel = {
  fact: "事实证据",
  directional: "方向性证据",
  hypothesis: "待验证假设",
  unknown: "未知 / 缺口",
} as const;

export default async function ResearchWhiteboardPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const query = await searchParams;
  const discoveryId = firstParam(query.discoveryId);
  if (!/^discovery-[a-z0-9-]+$/.test(discoveryId)) notFound();

  try {
    const [rawPlan, whiteboard] = await Promise.all([
      readFile(opportunityDiscoveryPaths(discoveryId).plan, "utf8"),
      readResearchWhiteboard(discoveryId),
    ]);
    const plan = opportunityDiscoveryPlanSchema.parse(JSON.parse(rawPlan));
    const latestActivity = [...whiteboard.activity].reverse();

    return (
      <WorkbenchShell active="discover">
        <WhiteboardAutoRefresh status={whiteboard.status} />
        <section className="research-whiteboard">
          <header className="research-whiteboard-head">
            <div>
              <span>LIVE RESEARCH WHITEBOARD</span>
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
            <div><dt>Research Run</dt><dd>{whiteboard.researchRunId ?? "创建后将在这里绑定"}</dd></div>
          </dl>

          <div className="research-whiteboard-board" aria-label="实时调研流程白板">
            {columns.map((column, columnIndex) => (
              <section className="research-whiteboard-column" key={column.title}>
                <header>
                  <span>{column.eyebrow}</span>
                  <h3>{column.title}</h3>
                  <p>{column.description}</p>
                </header>
                <div className="research-whiteboard-column-body">
                  {column.stages.map((code) => {
                    const stage = whiteboard.stages[code];
                    const collectionView = columnIndex === 2;
                    return (
                      <article className={`research-whiteboard-stage status-${stage.status}`} key={`${columnIndex}-${code}`}>
                        <header>
                          <span>{stageLabels[code]}</span>
                          <b>{stage.status === "in_progress" ? <LoaderCircle size={13} className="research-whiteboard-spin" /> : stage.status}</b>
                        </header>
                        <p>{stage.summary}</p>
                        {(collectionView || stage.queryCount + stage.sourceCount + stage.recordCount > 0) ? (
                          <dl>
                            <div><dt>检索</dt><dd>{stage.queryCount}</dd></div>
                            <div><dt>来源</dt><dd>{stage.sourceCount}</dd></div>
                            <div><dt>有效记录</dt><dd>{stage.recordCount}</dd></div>
                          </dl>
                        ) : null}
                        {stage.sources.length > 0 ? (
                          <div className="research-whiteboard-sources">
                            {stage.sources.slice(-4).map((source) => (
                              <a href={source.url} key={source.id} target="_blank" rel="noreferrer">
                                <Search size={11} /><span>{source.label}</span><ExternalLink size={10} />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                {columnIndex < columns.length - 1 ? <span className="research-whiteboard-arrow" aria-hidden="true">→</span> : null}
              </section>
            ))}
          </div>

          {whiteboard.reportModules.length > 0 ? (
            <section className="research-whiteboard-report" aria-label="六大卖家问题报告">
              <header>
                <span>SELLER REPORT</span>
                <h3>六大卖家问题</h3>
                <p>先看每个模块的核心结论；需要核查时，再展开证据、来源和仍未解决的问题。</p>
              </header>
              <div className="research-whiteboard-report-grid">
                {whiteboard.reportModules.map((module, index) => (
                  <article key={module.code} id={`whiteboard-report-${module.code}`}>
                    <header><span>{String(index + 1).padStart(2, "0")}</span><div><h4>{module.title}</h4><p>{module.question}</p></div></header>
                    <strong>{module.conclusion}</strong>
                    <details>
                      <summary>展开证据与缺口</summary>
                      <ul>
                        {module.items.map((item, itemIndex) => (
                          <li key={`${module.code}-${itemIndex}`}>
                            <b className={`level-${item.level}`}>{evidenceLevelLabel[item.level]}</b>
                            <span>{item.text}</span>
                            {item.sourceIds.length > 0 ? <small>来源：{item.sourceIds.join("、")}</small> : null}
                          </li>
                        ))}
                      </ul>
                      {module.unknowns.length > 0 ? (
                        <div className="research-whiteboard-unknowns"><b>仍需补证</b><ul>{module.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></div>
                      ) : null}
                    </details>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="research-whiteboard-activity">
            <header><span>AGENT ACTIVITY</span><h3>最近发生了什么</h3><small>页面每 4 秒自动刷新</small></header>
            <ol>
              {latestActivity.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <time>{new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date(item.at))}</time>
                  <b>{stageLabels[item.stage]}</b>
                  <span>{item.message}</span>
                </li>
              ))}
            </ol>
          </section>
        </section>
      </WorkbenchShell>
    );
  } catch {
    notFound();
  }
}
