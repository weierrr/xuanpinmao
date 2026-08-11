"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
  keyword: string;
  imageCount: number;
  competitorUrlCount: number;
}>;

const canvasWidth = 1660;
const canvasHeight = 990;
const minimumZoom = 0.35;
const maximumZoom = 2.5;

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

const evidenceStages: ResearchWhiteboardStageCode[] = [
  "market",
  "customer",
  "competitor",
  "supply",
  "compliance",
];

const reportOrder: ResearchWhiteboardReportModule["code"][] = [
  "market",
  "customer",
  "competitor",
  "product",
  "marketing",
  "validation",
];

const shortText = (value: string, limit = 86): string =>
  value.length > limit ? `${value.slice(0, limit)}…` : value;

const moduleByCode = (
  modules: ResearchWhiteboardReportModule[],
  code: ResearchWhiteboardReportModule["code"],
) => modules.find((item) => item.code === code);

export function ResearchWhiteboardCanvas({
  whiteboard,
  keyword,
  imageCount,
  competitorUrlCount,
}: ResearchWhiteboardCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(0.72);
  const [mode, setMode] = useState<WhiteboardMode>("all");
  const [zoom, setZoom] = useState(0.72);
  const [openSourceStage, setOpenSourceStage] = useState<ResearchWhiteboardStageCode | null>(null);

  const setCanvasZoom = useCallback((value: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    const currentZoom = zoomRef.current;
    const nextZoom = clampZoom(value);
    if (!viewport || nextZoom === currentZoom) return;

    const rect = viewport.getBoundingClientRect();
    const anchorX = clientX === undefined ? viewport.clientWidth / 2 : clientX - rect.left;
    const anchorY = clientY === undefined ? viewport.clientHeight / 2 : clientY - rect.top;
    const canvasX = (viewport.scrollLeft + anchorX) / currentZoom;
    const canvasY = (viewport.scrollTop + anchorY) / currentZoom;

    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    window.requestAnimationFrame(() => {
      viewport.scrollTo({
        left: Math.max(0, canvasX * nextZoom - anchorX),
        top: Math.max(0, canvasY * nextZoom - anchorY),
      });
    });
  }, []);

  const fitCanvas = useCallback(() => {
    const width = viewportRef.current?.clientWidth ?? canvasWidth;
    const nextZoom = Math.min(1, Math.max(0.5, (width - 34) / canvasWidth));
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
    if (!openSourceStage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenSourceStage(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [openSourceStage]);

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
      title: "价格、趋势与竞争强度",
      summary: reportTextZh(moduleByCode(whiteboard.reportModules, "market")?.conclusion
        ?? whiteboard.stages.synthesis.summary),
      tag: "市场结构",
    },
    {
      title: "购买人群与真实焦虑",
      summary: reportTextZh(moduleByCode(whiteboard.reportModules, "customer")?.conclusion
        ?? "等待用户证据形成可追溯洞察。"),
      tag: "用户动机",
    },
    {
      title: "竞品路径与机会缺口",
      summary: reportTextZh(moduleByCode(whiteboard.reportModules, "competitor")?.conclusion
        ?? "等待竞品证据形成点击、信任与成交路径。"),
      tag: "竞争机会",
    },
  ], [whiteboard]);

  const executionCards = reportOrder.slice(3).map((code) => {
    const reportModule = moduleByCode(whiteboard.reportModules, code);
    return {
      code,
      title: reportModule?.title ?? ({ product: "产品方案", marketing: "营销打法", validation: "验证方案" } as const)[code as "product" | "marketing" | "validation"],
      conclusion: reportTextZh(reportModule?.conclusion ?? whiteboard.stages[`${code}_report` as ResearchWhiteboardStageCode].summary),
    };
  });
  const drawerStage = openSourceStage ? whiteboard.stages[openSourceStage] : null;

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
          <button type="button" onClick={() => changeZoom(-0.1)} aria-label="缩小白板"><Minus size={15} /></button>
          <output>{Math.round(zoom * 100)}%</output>
          <button type="button" onClick={() => changeZoom(0.1)} aria-label="放大白板"><Plus size={15} /></button>
          <button type="button" onClick={fitCanvas}>适应画布</button>
          <button type="button" onClick={toggleFullscreen}><Maximize2 size={14} />全屏</button>
        </div>
      </header>

      <div className="whiteboard-canvas-viewport" ref={viewportRef}>
        <div
          className={`whiteboard-canvas mode-${mode}`}
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${zoom})`,
            marginRight: canvasWidth * (zoom - 1),
            marginBottom: canvasHeight * (zoom - 1),
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
            <article className="whiteboard-node source-card scope-card">
              <header><span>市场与商品入口</span><b>当前调研版本</b></header>
              <h3>{keyword}</h3>
              <p>{whiteboard.market} · {whiteboard.channel ?? "渠道待确认"} · 图片 {imageCount} 条 · 链接 {competitorUrlCount} 条</p>
              <div className="whiteboard-node-chips"><span>{whiteboard.stages.market.sourceCount} 个市场来源</span><span>{whiteboard.researchRunId ? "已建立证据档案" : "准备建立证据档案"}</span></div>
            </article>
            {evidenceStages.filter((code) => code !== "market").map((code) => {
              const stage = whiteboard.stages[code];
              return (
                <article className={`whiteboard-node source-card status-${stage.status}`} key={code}>
                  <header><span>{stageLabels[code]}入口</span><b>{stageStatusLabels[stage.status]}</b></header>
                  <h3>{stageLabels[code]}</h3>
                  <p>{shortText(stage.summary, 70)}</p>
                  <div className="whiteboard-node-chips"><span>{stage.sourceCount} 个来源</span><span>{stage.recordCount} 条判断</span></div>
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
                  <h3>{stage.queryCount} 次检索 → {stage.sourceCount} 个来源</h3>
                  <p>{shortText(stage.summary, 76)}</p>
                  <div className="whiteboard-node-chips">
                    <span>有效记录 {stage.recordCount}</span>
                    {stage.sources.length > 0 ? (
                      <button
                        type="button"
                        className="whiteboard-source-trigger"
                        aria-expanded={openSourceStage === code}
                        aria-controls="whiteboard-source-drawer"
                        onClick={() => setOpenSourceStage(code)}
                      >
                        全部 {stage.sources.length} 个信源
                      </button>
                    ) : (
                      <span>暂无信源</span>
                    )}
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
                <p>{shortText(card.summary, 110)}</p>
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
                    <a href={`#whiteboard-report-${code}`}>{reportModule?.title ?? stageLabels[`${code}_report` as ResearchWhiteboardStageCode]}</a>
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
                <p>{drawerStage.queryCount} 次检索 · {drawerStage.sources.length} 个保留信源 · {drawerStage.recordCount} 条有效判断</p>
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
    </section>
  );
}
