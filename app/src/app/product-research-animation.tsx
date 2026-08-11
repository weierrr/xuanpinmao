"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  CirclePause,
  CirclePlay,
  Database,
  FileText,
  Image as ImageIcon,
  Link2,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

const stages = [
  { number: "01", label: "研究对象", caption: "确认输入与研究边界" },
  { number: "02", label: "数据来源", caption: "建立可追溯证据池" },
  { number: "03", label: "Agent 采集", caption: "检索、筛选与去重" },
  { number: "04", label: "整理分析", caption: "把事实变成判断" },
  { number: "05", label: "六份报告", caption: "生成可执行结论" },
] as const;

const reportRows = ["市场与机会", "用户画像", "竞品分析", "产品方案", "营销打法", "验证方案"];

function StageBody({ index }: Readonly<{ index: number }>) {
  if (index === 0) {
    return (
      <div className="research-demo-object">
        <div className="research-demo-query"><Search size={16} /><span><b>家用台面制冰机</b><small>美国 · DTC 独立站</small></span></div>
        <div className="research-demo-inputs">
          <span><Search size={12} /> 关键词</span>
          <span><ImageIcon size={12} /> 3 张图片</span>
          <span><Link2 size={12} /> 2 个链接</span>
        </div>
        <p>重点验证：价格带、清洁痛点、噪音评价与差异化机会。</p>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="research-demo-source-list">
        <article><Database size={15} /><span><b>市场资料</b><small>9 个来源</small></span><em>09</em></article>
        <article><Users size={15} /><span><b>用户反馈</b><small>Amazon · Reddit · YouTube</small></span><em>699</em></article>
        <article><Sparkles size={15} /><span><b>竞品页面</b><small>价格、卖点与广告素材</small></span><em>08</em></article>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="research-demo-agent">
        <div className="research-demo-agent-head"><Bot size={17} /><span>研究 Agent 正在工作</span><i /></div>
        <div className="research-demo-terminal" aria-label="采集日志">
          <span><b>SEARCH</b> countertop ice maker complaints</span>
          <span><b>OPEN</b> 29 个候选页面</span>
          <span><b>FILTER</b> 排除转载与重复内容</span>
          <span><b>CAPTURE</b> 保存证据与访问时间</span>
        </div>
        <div className="research-demo-agent-metrics"><span>搜索记录 <b>22</b></span><span>有效页面 <b>29</b></span><span>原子判断 <b>22</b></span></div>
      </div>
    );
  }

  if (index === 3) {
    return (
      <div className="research-demo-analysis">
        <article><span>价格、趋势与竞争强度</span><b>机会窗口</b><i style={{ "--score": "76%" } as React.CSSProperties} /></article>
        <article><span>真实人群与真实焦虑</span><b>高频痛点</b><i style={{ "--score": "88%" } as React.CSSProperties} /></article>
        <div className="research-demo-insight"><Sparkles size={14} /><p><b>关键洞察</b>用户愿意为“易清洁 + 低噪音”支付更高价格，而非单纯追求制冰速度。</p></div>
      </div>
    );
  }

  return (
    <div className="research-demo-report">
      {reportRows.map((row, rowIndex) => (
        <article key={row} style={{ "--row-delay": `${rowIndex * 70}ms` } as React.CSSProperties}>
          <span>{String(rowIndex + 1).padStart(2, "0")}</span><b>{row}</b><Check size={13} />
        </article>
      ))}
    </div>
  );
}

export function ProductResearchAnimation() {
  const [activeStage, setActiveStage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setActiveStage((current) => (current + 1) % stages.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const restart = () => {
    setActiveStage(0);
    setIsPlaying(true);
  };

  return (
    <section className="research-demo" aria-label="选品研究过程动画">
      <div className="research-demo-window">
        <div className="research-demo-window-bar">
          <span className="research-demo-dots"><i /><i /><i /></span>
          <span>选品猫研究引擎</span>
          <div className="research-demo-bar-actions">
            <b><i />证据持续写入</b>
            <span className="research-demo-controls">
              <button type="button" onClick={() => setIsPlaying((value) => !value)} aria-label={isPlaying ? "暂停流程动画" : "播放流程动画"}>
                {isPlaying ? <CirclePause size={14} /> : <CirclePlay size={14} />}{isPlaying ? "暂停" : "播放"}
              </button>
              <button type="button" onClick={restart} aria-label="重新运行流程动画"><RefreshCw size={13} />重新运行</button>
            </span>
          </div>
        </div>

        <div className="research-demo-progress" aria-hidden="true">
          <span style={{ width: `${(activeStage / (stages.length - 1)) * 100}%` }} />
          <i className={isPlaying ? "moving" : ""} style={{ left: `${(activeStage / (stages.length - 1)) * 100}%` }}><FileText size={12} /></i>
        </div>

        <div className="research-demo-stages">
          {stages.map((stage, index) => {
            const state = index < activeStage ? "complete" : index === activeStage ? "active" : "waiting";
            return (
              <button
                className={`research-demo-stage ${state}`}
                type="button"
                key={stage.number}
                onClick={() => { setActiveStage(index); setIsPlaying(false); }}
                aria-current={state === "active" ? "step" : undefined}
              >
                <header>
                  <span>{stage.number}</span>
                  <div><b>{stage.label}</b><small>{stage.caption}</small></div>
                  <em>{state === "complete" ? <Check size={13} /> : state === "active" ? "运行中" : "等待"}</em>
                </header>
                <div className="research-demo-stage-body"><StageBody index={index} /></div>
                {index < stages.length - 1 ? <ArrowRight className="research-demo-arrow" size={18} /> : null}
              </button>
            );
          })}
        </div>

        <footer className="research-demo-footer">
          <span><i />当前阶段</span>
          <strong>{stages[activeStage].number} · {stages[activeStage].label}</strong>
          <p>{activeStage === 4 ? "报告已经生成，同时保留来源、未知项与下一步验证动作。" : "每一步都保留输入、来源与处理记录，结论可以回看和补证。"}</p>
          <b>{activeStage + 1} / {stages.length}</b>
        </footer>
      </div>
    </section>
  );
}
