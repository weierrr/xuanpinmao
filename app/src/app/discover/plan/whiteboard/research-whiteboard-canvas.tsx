"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  ExternalLink,
  Maximize2,
  Minus,
  Plus,
  Radio,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  ResearchWhiteboard,
  ResearchWhiteboardReportModule,
  ResearchWhiteboardStageCode,
} from "@/research-whiteboard/types";
import { reportTextZh } from "@/report/report-copy";

type WhiteboardMode = "all" | "evidence" | "execution";

type ResearchWhiteboardCanvasProps = Readonly<{
  whiteboard: ResearchWhiteboard;
}>;

const canvasWidth = 1660;
const canvasHeight = 990;
const minimumZoom = 0.5;
const maximumZoom = 2.5;
const fitHorizontalGutter = 48;

const clampZoom = (value: number): number =>
  Math.min(maximumZoom, Math.max(minimumZoom, Number(value.toFixed(3))));

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

const statusLabels: Record<ResearchWhiteboard["status"], string> = {
  waiting: "等待 Agent 开始",
  researching: "正在采集证据",
  analyzing: "正在整理分析",
  reporting: "正在生成报告",
  completed: "本轮研究已完成",
  blocked: "存在阻塞项",
};

const stageStatusLabels = {
  pending: "等待处理",
  in_progress: "正在处理",
  complete: "本轮完成",
  blocked: "遇到阻塞",
} as const;

const evidenceStages = [
  "market",
  "customer",
  "competitor",
  "supply",
  "compliance",
] as const satisfies readonly ResearchWhiteboardStageCode[];

type EvidenceStageCode = (typeof evidenceStages)[number];
type AnalysisCode = "market" | "customer" | "competitor";

const evidenceLevelLabels: Record<ResearchWhiteboardReportModule["items"][number]["level"], string> = {
  fact: "已核验事实",
  directional: "方向性证据",
  hypothesis: "待验证假设",
  unknown: "仍待确认",
};

const reportOrder: ResearchWhiteboardReportModule["code"][] = [
  "market",
  "customer",
  "competitor",
  "product",
  "marketing",
  "validation",
];

const sourceCardTitles: Record<EvidenceStageCode, string> = {
  market: "市场、价格与趋势资料",
  customer: "评论与社区讨论",
  competitor: "品牌、商品页与成交路径",
  supply: "供应商与公开货盘",
  compliance: "官方规则与宣传边界",
};

const sourceSiteSummary = (sources: ResearchWhiteboard["stages"][ResearchWhiteboardStageCode]["sources"]): string => {
  const sites = [...new Set(sources.map((source) => {
    try {
      return new URL(source.url).hostname.replace(/^www\./, "").replace(/^uk\./, "");
    } catch {
      return "未知站点";
    }
  }))];
  if (sites.length === 0) return "本轮尚未保留可追溯信源。";
  const visibleSites = sites.slice(0, 3).join("、");
  return sites.length > 3 ? `来自 ${visibleSites} 等 ${sites.length} 个站点。` : `来自 ${visibleSites}。`;
};

const shortText = (value: string, limit = 86): string =>
  value.length > limit ? `${value.slice(0, limit)}…` : value;

const moduleByCode = (
  modules: ResearchWhiteboardReportModule[],
  code: ResearchWhiteboardReportModule["code"],
) => modules.find((item) => item.code === code);

export function ResearchWhiteboardCanvas({
  whiteboard,
}: ResearchWhiteboardCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(0.72);
  const [mode, setMode] = useState<WhiteboardMode>("all");
  const [zoom, setZoom] = useState(0.72);
  const [openSourceStage, setOpenSourceStage] = useState<EvidenceStageCode | null>(null);
  const [openAnalysisCode, setOpenAnalysisCode] = useState<AnalysisCode | null>(null);

  const setCanvasZoom = useCallback((value: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    const currentZoom = zoomRef.current;
    const nextZoom = clampZoom(value);
    if (!viewport || nextZoom === currentZoom) return;

    const rect = viewport.getBoundingClientRect();
    const anchorX = clientX === undefined ? viewport.clientWidth / 2 : clientX - rect.left;
    const anchorY = clientY === undefined ? viewport.clientHeight / 2 : clientY - rect.top;
    const currentCanvasOffsetX = Math.max(0, (viewport.clientWidth - canvasWidth * currentZoom) / 2);
    const canvasX = (viewport.scrollLeft + anchorX - currentCanvasOffsetX) / currentZoom;
    const canvasY = (viewport.scrollTop + anchorY) / currentZoom;
    const nextCanvasOffsetX = Math.max(0, (viewport.clientWidth - canvasWidth * nextZoom) / 2);

    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    window.requestAnimationFrame(() => {
      viewport.scrollTo({
        left: Math.max(0, canvasX * nextZoom + nextCanvasOffsetX - anchorX),
        top: Math.max(0, canvasY * nextZoom - anchorY),
      });
    });
  }, []);

  const fitCanvas = useCallback(() => {
    const width = viewportRef.current?.clientWidth ?? canvasWidth;
    const nextZoom = Math.min(1, Math.max(minimumZoom, (width - fitHorizontalGutter) / canvasWidth));
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    viewportRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    fitCanvas();
    window.addEventListener("resize", fitCanvas);
    return () => window.removeEventListener("resize", fitCanvas);
  }, [fitCanvas]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handlePinch = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const scaleFactor = Math.exp(-event.deltaY * 0.008);
      setCanvasZoom(zoomRef.current * scaleFactor, event.clientX, event.clientY);
    };
    viewport.addEventListener("wheel", handlePinch, { passive: false });
    return () => viewport.removeEventListener("wheel", handlePinch);
  }, [setCanvasZoom]);

  useEffect(() => {
    if (!openSourceStage && !openAnalysisCode) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenSourceStage(null);
        setOpenAnalysisCode(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [openAnalysisCode, openSourceStage]);

  const changeZoom = (delta: number) => {
    setCanvasZoom(zoomRef.current + delta);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await frameRef.current?.requestFullscreen();
    else await document.exitFullscreen();
    window.setTimeout(fitCanvas, 120);
  };

  const analysisCards = useMemo(() => [
    {
      code: "market" as const,
      title: "价格、趋势与竞争强度",
      module: moduleByCode(whiteboard.reportModules, "market"),
      tag: "市场结构",
    },
    {
      code: "customer" as const,
      title: "购买人群与真实焦虑",
      module: moduleByCode(whiteboard.reportModules, "customer"),
      tag: "用户动机",
    },
    {
      code: "competitor" as const,
      title: "竞品路径与机会缺口",
      module: moduleByCode(whiteboard.reportModules, "competitor"),
      tag: "竞争机会",
    },
  ].map((card) => ({
    ...card,
    summary: reportTextZh(card.module?.conclusion ?? (card.code === "market"
      ? whiteboard.stages.synthesis.summary
      : card.code === "customer"
        ? "等待用户证据形成可追溯洞察。"
        : "等待竞品证据形成点击、信任与成交路径。")),
  })), [whiteboard]);

  const executionCards = reportOrder.slice(3).map((code) => {
    const reportModule = moduleByCode(whiteboard.reportModules, code);
    return {
      code,
      title: reportModule?.title ?? ({ product: "产品方案", marketing: "营销打法", validation: "验证方案" } as const)[code as "product" | "marketing" | "validation"],
      conclusion: reportTextZh(reportModule?.conclusion ?? whiteboard.stages[`${code}_report` as ResearchWhiteboardStageCode].summary),
    };
  });
  const drawerStage = openSourceStage ? whiteboard.stages[openSourceStage] : null;
  const drawerAnalysis = openAnalysisCode
    ? analysisCards.find((card) => card.code === openAnalysisCode) ?? null
    : null;

  return (
    <section className="whiteboard-canvas-frame" ref={frameRef}>
      <header className="whiteboard-canvas-toolbar">
        <nav aria-label="白板视角">
          {([
            ["all", "全流程"],
            ["evidence", "证据链"],
            ["execution", "执行视角"],
          ] as const).map(([value, label]) => (
            <button className={mode === value ? "active" : ""} key={value} onClick={() => setMode(value)} type="button">
              {label}
            </button>
          ))}
        </nav>
        <div className="whiteboard-canvas-controls">
          <button type="button" onClick={() => changeZoom(-0.1)} aria-label="缩小白板" disabled={zoom <= minimumZoom}><Minus size={15} /></button>
          <output>{Math.round(zoom * 100)}%</output>
          <button type="button" onClick={() => changeZoom(0.1)} aria-label="放大白板" disabled={zoom >= maximumZoom}><Plus size={15} /></button>
          <button type="button" onClick={fitCanvas}>适应画布</button>
          <button type="button" onClick={toggleFullscreen}><Maximize2 size={14} />全屏</button>
        </div>
      </header>

      <div
        className="whiteboard-canvas-viewport"
        ref={viewportRef}
        style={{
          "--whiteboard-dot-grid": `${18 * zoom}px`,
          "--whiteboard-major-grid": `${72 * zoom}px`,
          "--whiteboard-dot-radius": `${zoom}px`,
          "--whiteboard-dot-fade": `${1.4 * zoom}px`,
          "--whiteboard-grid-line": `${zoom}px`,
          "--whiteboard-scaled-height": `${canvasHeight * zoom}px`,
        } as CSSProperties}
      >
        <div className="whiteboard-canvas-stage" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}>
          <div
            className={`whiteboard-canvas mode-${mode}`}
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${zoom})`,
          }}
          >
          <svg className="whiteboard-connectors" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} aria-hidden="true">
            {[152, 306, 460, 614, 768].map((y) => <path key={`source-${y}`} className="line-evidence" d={`M 286 ${y} C 305 ${y}, 306 ${y}, 326 ${y}`} />)}
            <path className="line-analysis" d="M 588 152 C 630 152, 622 196, 665 196" />
            <path className="line-analysis" d="M 588 306 C 632 306, 625 196, 665 196" />
            <path className="line-analysis" d="M 588 460 C 632 460, 625 462, 665 462" />
            <path className="line-analysis" d="M 588 614 C 632 614, 625 726, 665 726" />
            <path className="line-analysis" d="M 588 768 C 632 768, 625 726, 665 726" />
            {[196, 462, 726].map((y) => <path key={`analysis-${y}`} className="line-report" d={`M 915 ${y} C 952 ${y}, 948 480, 986 480`} />)}
            {[168, 352, 536, 720].map((y) => <path key={`execution-${y}`} className="line-execution" d={`M 1242 480 C 1274 480, 1264 ${y}, 1302 ${y}`} />)}
            <path className="line-feedback" d="M 1578 814 C 1578 930, 1480 940, 1235 940 L 145 940 C 58 940, 48 874, 48 822" />
          </svg>

          <div className="whiteboard-lane-label lane-source"><span>01</span>数据来源</div>
          <div className="whiteboard-lane-label lane-collection"><span>02</span>Agent 采集记录</div>
          <div className="whiteboard-lane-label lane-analysis"><span>03</span>整理分析</div>
          <div className="whiteboard-lane-label lane-report"><span>04</span>生成报告</div>
          <div className="whiteboard-lane-label lane-execution"><span>05</span>执行方案</div>

          <section className="whiteboard-node-stack source-stack" data-lane="evidence">
            {evidenceStages.map((code) => {
              const stage = whiteboard.stages[code];
              const verifiedCount = stage.sources.filter((source) => source.status === "verified").length;
              const blockedCount = stage.sources.filter((source) => source.status === "blocked").length;
              return (
                <article className={`whiteboard-node source-card status-${stage.status}`} key={code}>
                  <header><span>{stageLabels[code]}来源</span><b>{stageStatusLabels[stage.status]}</b></header>
                  <h3>{sourceCardTitles[code]}</h3>
                  <p>{sourceSiteSummary(stage.sources)}</p>
                  <div className="whiteboard-node-chips">
                    <span>{stage.sources.length} 个信源</span>
                    <span>{verifiedCount} 个已核验</span>
                    {blockedCount > 0 ? <span>{blockedCount} 个受阻</span> : null}
                  </div>
                  {stage.sources.length > 0 ? (
                    <button
                      type="button"
                      className="whiteboard-source-card-hitarea"
                      aria-label={`查看${stageLabels[code]}的全部 ${stage.sources.length} 个信源`}
                      aria-expanded={openSourceStage === code}
                      aria-controls="whiteboard-source-drawer"
                      onClick={() => {
                        setOpenAnalysisCode(null);
                        setOpenSourceStage(code);
                      }}
                    />
                  ) : null}
                </article>
              );
            })}
          </section>

          <section className="whiteboard-node-stack collection-stack" data-lane="evidence">
            {evidenceStages.map((code) => {
              const stage = whiteboard.stages[code];
              return (
                <article className={`whiteboard-node collection-card status-${stage.status}`} key={code}>
                  <header><span>{stageLabels[code]}处理</span><b>{stage.updatedAt.slice(0, 10)}</b></header>
                  <h3>{stage.queryCount} 次检索与核查</h3>
                  <p>完成检索、筛选、去重和有效性判断，形成可用于本轮分析的证据记录。</p>
                  <div className="whiteboard-node-chips">
                    <span>保留 {stage.sourceCount} 个来源</span>
                    <span>形成 {stage.recordCount} 条判断</span>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="analysis-stack" data-lane="analysis">
            {analysisCards.map((card) => (
              <article className="whiteboard-node analysis-card" key={card.title}>
                <header><span>{card.tag}</span><b>证据 + 本次</b></header>
                <h3>{card.title}</h3>
                <span className="analysis-card-action">查看完整分析 <ArrowRight size={14} aria-hidden="true" /></span>
                <button
                  type="button"
                  className="whiteboard-analysis-card-hitarea"
                  aria-label={`查看${card.title}的完整分析`}
                  aria-expanded={openAnalysisCode === card.code}
                  aria-controls="whiteboard-analysis-drawer"
                  onClick={() => {
                    setOpenSourceStage(null);
                    setOpenAnalysisCode(card.code);
                  }}
                />
              </article>
            ))}
          </section>

          <section className="whiteboard-report-node" data-lane="report">
            <header><span>选品猫研究报告</span><b>{whiteboard.reportModules.length === 6 ? "可追溯输出" : "生成中"}</b></header>
            <h2>把证据转成一份可读报告</h2>
            <p>每个结论保留来源、证据等级、反向证据和待补缺口。</p>
            <ol>
              {reportOrder.map((code, index) => {
                const reportModule = moduleByCode(whiteboard.reportModules, code);
                return (
                  <li key={code}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <a href={`#whiteboard-report-${code}`}>
                      {reportModule?.title ?? stageLabels[`${code}_report` as ResearchWhiteboardStageCode]}
                      <ArrowRight size={14} aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ol>
            <div className={`whiteboard-report-status status-${whiteboard.status}`}>
              {whiteboard.status === "completed" ? <ShieldCheck size={15} /> : <Radio size={15} />}
              {statusLabels[whiteboard.status]}
            </div>
          </section>

          <section className="execution-stack" data-lane="execution">
            {executionCards.map((card) => (
              <article className="whiteboard-node execution-card" key={card.code}>
                <header><span>{card.title}</span><b>可继续执行</b></header>
                <h3>{shortText(card.conclusion, 38)}</h3>
                <a href={`#whiteboard-report-${card.code}`}>查看完整模块 <ExternalLink size={11} /></a>
              </article>
            ))}
            <article className="whiteboard-node execution-card feedback-card">
              <header><span>新证据回流</span><b>形成新版本</b></header>
              <h3>新增评论、价格、API 数据或样品结果</h3>
              <p>{shortText(whiteboard.stages.execution.summary, 76)}</p>
            </article>
          </section>
          </div>
        </div>
      </div>

      {drawerStage && openSourceStage ? (
        <>
          <button
            type="button"
            className="whiteboard-source-drawer-backdrop"
            aria-label="关闭信源抽屉"
            onClick={() => setOpenSourceStage(null)}
          />
          <aside
            id="whiteboard-source-drawer"
            className="whiteboard-source-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whiteboard-source-drawer-title"
          >
            <header>
              <div>
                <span>全部信源</span>
                <h2 id="whiteboard-source-drawer-title">{stageLabels[openSourceStage]}</h2>
                <p>
                  {drawerStage.sources.length} 个保留信源 · {drawerStage.sources.filter((source) => source.status === "verified").length} 个已核验
                  {drawerStage.sources.some((source) => source.status === "blocked")
                    ? ` · ${drawerStage.sources.filter((source) => source.status === "blocked").length} 个访问受阻`
                    : ""}
                </p>
              </div>
              <button type="button" aria-label="关闭信源抽屉" onClick={() => setOpenSourceStage(null)}><X size={18} /></button>
            </header>
            <div className="whiteboard-source-drawer-list">
              {drawerStage.sources.map((source, index) => (
                <a href={source.url} key={source.id} target="_blank" rel="noreferrer">
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <span><strong>{source.label}</strong><small>{source.url}</small></span>
                  <em className={`status-${source.status}`}>
                    {source.status === "verified"
                      ? "已核验"
                      : source.status === "blocked"
                        ? "访问受阻"
                        : "候选"}
                  </em>
                  <ExternalLink size={13} />
                </a>
              ))}
            </div>
          </aside>
        </>
      ) : null}

      {drawerAnalysis && openAnalysisCode ? (
        <>
          <button
            type="button"
            className="whiteboard-source-drawer-backdrop"
            aria-label="关闭分析抽屉"
            onClick={() => setOpenAnalysisCode(null)}
          />
          <aside
            id="whiteboard-analysis-drawer"
            className="whiteboard-source-drawer whiteboard-analysis-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whiteboard-analysis-drawer-title"
          >
            <header>
              <div>
                <span>完整分析</span>
                <h2 id="whiteboard-analysis-drawer-title">{drawerAnalysis.title}</h2>
                <p>{drawerAnalysis.tag} · 基于本轮保留证据整理</p>
              </div>
              <button type="button" aria-label="关闭分析抽屉" onClick={() => setOpenAnalysisCode(null)}><X size={18} /></button>
            </header>
            <div className="whiteboard-analysis-drawer-body">
              <section className="whiteboard-analysis-conclusion">
                <span>核心结论</span>
                <p>{drawerAnalysis.summary}</p>
              </section>
              {drawerAnalysis.module?.items.length ? (
                <section>
                  <h3>支持判断</h3>
                  <ul>
                    {drawerAnalysis.module.items.map((item, index) => (
                      <li key={`${item.text}-${index}`}>
                        <div><span>{evidenceLevelLabels[item.level]}</span><em>{item.sourceIds.length} 个来源</em></div>
                        <p>{reportTextZh(item.text)}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {drawerAnalysis.module?.unknowns.length ? (
                <section className="whiteboard-analysis-unknowns">
                  <h3>尚未证明</h3>
                  <ul>
                    {drawerAnalysis.module.unknowns.map((unknown) => <li key={unknown}>{reportTextZh(unknown)}</li>)}
                  </ul>
                </section>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}
