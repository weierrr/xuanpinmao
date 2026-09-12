"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { reportTextZh } from "@/report/report-copy";
import { buildReportScorecard } from "@/research-whiteboard/report-scorecard";
import type { ResearchWhiteboardReportModule, ResearchWhiteboardSource } from "@/research-whiteboard/types";

type ResearchWhiteboardReportProps = Readonly<{
  modules: ResearchWhiteboardReportModule[];
  sources: ResearchWhiteboardSource[];
  scope?: Readonly<{
    product: string;
    market: string;
    channel?: string;
    researchRunId?: string;
    updatedAt: string;
    queryCount: number;
    recordCount: number;
  }>;
}>;

type SourceSelection = Readonly<{
  claim: string;
  sourceIds: string[];
}>;

const evidenceLevelLabel = {
  fact: "事实证据",
  directional: "方向性证据",
  hypothesis: "待验证假设",
  unknown: "未知 / 缺口",
} as const;

type EvidenceLevel = keyof typeof evidenceLevelLabel;
type EvidenceFilter = "all" | EvidenceLevel;

const evidenceLevelOrder: EvidenceLevel[] = ["fact", "directional", "hypothesis", "unknown"];
const reportNavigationEvent = "xuanpinmao:open-report-module";

const splitConclusion = (value: string) => {
  const normalized = reportTextZh(value);
  return normalized.match(/[^。！？]+[。！？]?/gu)?.map((item) => item.trim()).filter(Boolean) ?? [normalized];
};

const conclusionHighlightPattern = /(\b(?:RESEARCH_MORE|READY_FOR_SOURCING|NOT_WORTH_PURSUING)\b|\d+(?:[.,]\d+)*(?:\/\d+)?(?:\s*(?:%|美元|条|个|项|份|名|个月|月|天))?)/gu;
const conclusionHighlightExactPattern = /^(?:RESEARCH_MORE|READY_FOR_SOURCING|NOT_WORTH_PURSUING|\d+(?:[.,]\d+)*(?:\/\d+)?(?:\s*(?:%|美元|条|个|项|份|名|个月|月|天))?)$/u;
const highlightConclusion = (value: string) => value.split(conclusionHighlightPattern).map((part, index) => (
  conclusionHighlightExactPattern.test(part)
    ? <mark key={`${part}-${index}`}>{part}</mark>
    : part
));

const snapshotLabel = (value: string) => new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
}).format(new Date(value));

const sourceKindLabel: Record<ResearchWhiteboardSource["kind"], string> = {
  market: "市场数据",
  community: "用户社区",
  competitor: "竞品页面",
  supplier: "供应信息",
  official: "官方资料",
  other: "其他信源",
};

const sourceStatusLabel: Record<ResearchWhiteboardSource["status"], string> = {
  verified: "已核验",
  candidate: "候选信源",
  blocked: "访问受阻",
};

export function ResearchWhiteboardReport({ modules, sources, scope }: ResearchWhiteboardReportProps) {
  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const [activeCode, setActiveCode] = useState<ResearchWhiteboardReportModule["code"]>(modules[0]?.code ?? "market");
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const scorecard = useMemo(() => buildReportScorecard(modules, sources), [modules, sources]);

  const revealModule = useCallback((code: ResearchWhiteboardReportModule["code"]) => {
    if (!modules.some((module) => module.code === code)) return;
    setActiveCode(code);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`whiteboard-report-${code}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, [modules]);

  useEffect(() => {
    const moduleFromHash = () => {
      const code = window.location.hash.replace("#whiteboard-report-", "") as ResearchWhiteboardReportModule["code"];
      if (window.location.hash.startsWith("#whiteboard-report-")) revealModule(code);
    };
    const openFromCanvas = (event: Event) => {
      const code = (event as CustomEvent<{ code?: ResearchWhiteboardReportModule["code"] }>).detail?.code;
      if (code) revealModule(code);
    };
    window.addEventListener("hashchange", moduleFromHash);
    window.addEventListener(reportNavigationEvent, openFromCanvas);
    moduleFromHash();
    return () => {
      window.removeEventListener("hashchange", moduleFromHash);
      window.removeEventListener(reportNavigationEvent, openFromCanvas);
    };
  }, [revealModule]);

  useEffect(() => {
    if (!selection) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selection]);

  const selectedSources = selection?.sourceIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter((source): source is ResearchWhiteboardSource => Boolean(source)) ?? [];
  const missingSourceIds = selection?.sourceIds.filter((sourceId) => !sourceById.has(sourceId)) ?? [];
  const activeModule = modules.find((module) => module.code === activeCode) ?? modules[0];
  const activeIndex = Math.max(0, modules.findIndex((module) => module.code === activeModule?.code));
  const activeSourceCount = new Set(activeModule?.items.flatMap((item) => item.sourceIds) ?? []).size;
  const activeSourceIds = new Set(activeModule?.items.flatMap((item) => item.sourceIds) ?? []);
  const evidenceCounts = Object.fromEntries(evidenceLevelOrder.map((level) => [
    level,
    activeModule?.items.filter((item) => item.level === level).length ?? 0,
  ])) as Record<EvidenceLevel, number>;
  const visibleEvidenceLevels = evidenceLevelOrder.filter((level) => evidenceCounts[level] > 0);
  const showEvidenceFilter = (activeModule?.items.length ?? 0) > 0;
  const showAllEvidenceFilter = visibleEvidenceLevels.length > 1;
  const effectiveEvidenceFilter: EvidenceFilter = evidenceFilter !== "all" && evidenceCounts[evidenceFilter] === 0
    ? "all"
    : evidenceFilter;
  const filteredItems = activeModule?.items.filter((item) => effectiveEvidenceFilter === "all" || item.level === effectiveEvidenceFilter) ?? [];
  const conclusionParts = activeModule ? splitConclusion(activeModule.conclusion) : [];
  const sourceCoverage = (Object.keys(sourceKindLabel) as ResearchWhiteboardSource["kind"][])
    .map((kind) => ({
      kind,
      label: sourceKindLabel[kind],
      count: sources.filter((source) => source.kind === kind && activeSourceIds.has(source.id)).length,
    }))
    .filter((item) => item.count > 0);
  const maximumCoverage = Math.max(1, ...sourceCoverage.map((item) => item.count));
  const actionGate = activeModule?.items.find((item) => item.text.startsWith("行动验收："));
  const voc = activeModule?.code === "customer" ? activeModule.voc : undefined;
  const vocUnitLabel = ({ discussion_thread: "讨论线程", review: "评论", response: "回复", mixed: "混合记录" } as const)[voc?.unit ?? "mixed"];
  const maximumVocChannel = Math.max(1, ...(voc?.channels.map((item) => item.count) ?? []));
  const maximumVocTheme = Math.max(1, ...(voc?.themes.map((item) => item.count) ?? []));
  const scopeItems = [
    ...(scope ? [
      ["研究对象", scope.product],
      ["市场 / 渠道", `${scope.market} · ${scope.channel ?? "待确认"}`],
      ["Research Run", scope.researchRunId ?? "未绑定"],
      ["本轮检索", `${scope.queryCount} 条`],
      ["有效记录", `${scope.recordCount} 条`],
    ] : []),
    ["保留信源", `${sources.length} 个`],
    ["已核验", `${sources.filter((source) => source.status === "verified").length} 个`],
    ["来源类型", `${new Set(sources.map((source) => source.kind)).size} 类`],
    ["报告快照", snapshotLabel(scope?.updatedAt ?? activeModule?.updatedAt ?? new Date(0).toISOString())],
  ];

  useEffect(() => {
    if (effectiveEvidenceFilter !== evidenceFilter) setEvidenceFilter(effectiveEvidenceFilter);
  }, [effectiveEvidenceFilter, evidenceFilter]);
  const moduleJudgment = activeModule ? ({
    market: activeModule.conclusion.includes("RESEARCH_MORE") ? "值得保留，继续补证" : "需求与竞争已形成判断",
    customer: "人群与任务明确，规模待验证",
    competitor: "转化链清楚，真实经营数据未知",
    product: activeModule.conclusion.includes("READY_FOR_SOURCING") ? "可进入受控寻源" : activeModule.conclusion.includes("NOT_WORTH_PURSUING") ? "暂不继续" : "继续补证，暂不买样",
    marketing: activeModule.unknowns.length > 0 ? "仅限概念素材测试" : "可进入素材验证",
    validation: activeModule.unknowns.length > 0 ? "先过验证闸门" : "可进入受控验证",
  } as const)[activeModule.code] : "待形成判断";
  const marketSignals = activeModule?.code === "market" ? [
    ["公开市场信源", `${sources.filter((source) => ["market", "competitor", "official"].includes(source.kind)).length} 个`],
    ["证据条目", `${activeModule.items.length} 条`],
    ["引用信源", `${activeSourceCount} 个`],
    ["待补证", `${activeModule.unknowns.length} 项`],
    ["当前判断", moduleJudgment],
  ] : [
    ["证据条目", `${activeModule?.items.length ?? 0} 条`],
    ["引用信源", `${activeSourceCount} 个`],
    ["待补证", `${activeModule?.unknowns.length ?? 0} 项`],
    ["当前判断", moduleJudgment],
  ];
  const customerGroups = activeModule?.code === "customer" ? [
    { key: "pain", label: "焦虑与风险", tone: "pain", items: filteredItems.filter((item) => item.text.startsWith("焦虑：")) },
    { key: "purchase", label: "下单理由", tone: "purchase", items: filteredItems.filter((item) => item.text.startsWith("下单理由：")) },
    { key: "emotion", label: "情绪动机", tone: "emotion", items: filteredItems.filter((item) => item.text.startsWith("情绪动机：")) },
    { key: "other", label: "原声、主题、反证与行动", tone: "other", items: filteredItems.filter((item) => !["焦虑：", "下单理由：", "情绪动机："].some((prefix) => item.text.startsWith(prefix))) },
  ].filter((group) => group.items.length > 0) : [];
  const decisionBrief = activeModule ? [
    { label: "已知", tone: "fact", text: activeModule.items.find((item) => item.level === "fact")?.text ?? "本轮尚无直接事实证据。" },
    { label: "商业判断", tone: "directional", text: activeModule.items.find((item) => item.level === "directional")?.text ?? activeModule.conclusion },
    { label: "现在怎么做", tone: "hypothesis", text: activeModule.items.find((item) => item.level === "hypothesis")?.text ?? "先补齐关键证据，再决定是否投入。" },
    { label: "红线 / 缺口", tone: "unknown", text: activeModule.unknowns[0] ?? activeModule.items.find((item) => item.level === "unknown")?.text ?? "当前未记录重大缺口。" },
  ] as const : [];

  return (
    <section className="research-whiteboard-report" aria-label="六大选品结论">
      <header className="research-whiteboard-report-header">
        <span>选品结论</span>
        <h3>六大选品结论</h3>
        <p>像翻一份选品演示稿一样查看六个模块；每页都保留证据、来源和待验证缺口。</p>
      </header>
      <section className="research-whiteboard-report-scope-strip" aria-label="研究口径">
        <header><span>RESEARCH BASIS</span><b>所有数字仅限本次 Research Run</b></header>
        <dl>
          {scopeItems.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>
      <nav className="research-whiteboard-report-tabs" aria-label="六大选品报告导航">
        {modules.map((module, index) => (
          <button className={module.code === activeModule?.code ? "active" : ""} key={module.code} onClick={() => setActiveCode(module.code)} type="button">
            <span>{String(index + 1).padStart(2, "0")}</span>{module.title}
          </button>
        ))}
      </nav>
      <details className="research-whiteboard-report-scorecard">
        <summary><span>报告自评</span><b>{scorecard.total} / 100</b><button type="button">查看评分依据与满分缺口</button><em>{scorecard.grade}</em></summary>
        <div className="research-whiteboard-report-scorecard-explainer">
          <div><span>计算公式</span><p>{scorecard.formula}</p></div>
          <div><span>距离满分</span><p>当前还差 <b>{scorecard.missingPoints} 分</b>。以下每个维度均列出计分规则、当前依据和满分所需信息。</p></div>
        </div>
        <div className="research-whiteboard-report-scorecard-grid">
          {scorecard.dimensions.map((dimension) => (
            <div key={dimension.label}>
              <span>{dimension.label}</span><b>{dimension.score} / {dimension.weight}</b>
              <small><strong>当前依据</strong>{dimension.note}</small>
              <small><strong>计分规则</strong>{dimension.rule}</small>
              <small><strong>满分条件</strong>{dimension.fullScoreRequirement}</small>
              <small className={dimension.score >= dimension.weight ? "is-complete" : "is-missing"}><strong>{dimension.score >= dimension.weight ? "当前状态" : `还差 ${dimension.weight - dimension.score} 分`}</strong>{dimension.missingToFull}</small>
            </div>
          ))}
        </div>
        <p><b>当前最高优先级：</b>{scorecard.priority}</p>
      </details>
      {activeModule ? (
        <article className="research-whiteboard-report-slide" id={`whiteboard-report-${activeModule.code}`}>
          <div className="research-whiteboard-report-slide-topline"><span>MODULE {String(activeIndex + 1).padStart(2, "0")}</span><b>{activeModule.question}</b></div>
          <div className="research-whiteboard-report-slide-grid">
            <div className="research-whiteboard-report-main-copy">
              <h4>{activeModule.title}</h4>
              <section className="research-whiteboard-report-conclusion" aria-label="核心结论">
                <span>核心判断</span>
                <strong>{highlightConclusion(conclusionParts[0] ?? "")}</strong>
                {conclusionParts.length > 1 ? (
                  <ol>
                    {conclusionParts.slice(1).map((part, index) => (
                      <li key={`${activeModule.code}-conclusion-${index}`}><i>{String(index + 1).padStart(2, "0")}</i><p>{highlightConclusion(part)}</p></li>
                    ))}
                  </ol>
                ) : null}
              </section>
              <div className="research-whiteboard-report-metrics">
                {marketSignals.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}
              </div>
            </div>
            <aside className="research-whiteboard-report-side-note">
              <span>卖家结论</span>
              <strong>{moduleJudgment}</strong>
              <p>{reportTextZh(activeModule.unknowns[0] ?? "核心结论来自当前 Research Run，点击下方条目可以查看具体证据与来源。")}</p>
            </aside>
          </div>
          <section className="research-whiteboard-report-decision-brief" aria-label="卖家决策摘要">
            {decisionBrief.map((item) => (
              <article className={`tone-${item.tone}`} key={item.label}>
                <b>{item.label}</b>
                <p>{reportTextZh(item.text)}</p>
              </article>
            ))}
          </section>
          {voc ? (
            <section className="research-whiteboard-report-voc" aria-label="用户声音覆盖">
              <header>
                <div><span>STRUCTURED VOC</span><h5>用户声音覆盖</h5></div>
                <p><b>{voc.totalRecords}</b> 个{vocUnitLabel} · <b>{voc.channels.length}</b> 个渠道</p>
              </header>
              <div className="research-whiteboard-report-voc-grid">
                <article>
                  <header><span>渠道覆盖</span><small>独立来源不能混成一个总样本</small></header>
                  <div className="research-whiteboard-report-voc-bars">
                    {voc.channels.map((item) => <p key={item.key}><b>{item.label}</b><i><span style={{ width: `${Math.max(10, item.count / maximumVocChannel * 100)}%` }} /></i><strong>{item.count}</strong></p>)}
                  </div>
                </article>
                <article>
                  <header><span>主题证据</span><small>一条记录可命中多个主题</small></header>
                  <div className="research-whiteboard-report-voc-bars">
                    {voc.themes.map((item) => <button key={item.key} onClick={() => setSelection({ claim: `VOC 主题：${item.label}`, sourceIds: item.sourceIds })} type="button"><b>{item.label}</b><i><span style={{ width: `${Math.max(10, item.count / maximumVocTheme * 100)}%` }} /></i><strong>{item.count}</strong></button>)}
                  </div>
                </article>
                <article>
                  <header><span>触发场景</span><small>仅表示当前语料中被观察到</small></header>
                  <div className="research-whiteboard-report-voc-scenes">
                    {voc.scenarios.map((item) => <button key={item.key} onClick={() => setSelection({ claim: `触发场景：${item.label}`, sourceIds: item.sourceIds })} type="button"><span>{item.label}</span><b>{item.count}/{voc.totalRecords}</b></button>)}
                  </div>
                </article>
                <article className="research-whiteboard-report-voc-sentiment">
                  <header><span>情绪编码</span><small>未编码就不输出正负面比例</small></header>
                  <div>{voc.sentiments.map((item) => <p className={`tone-${item.key}`} key={item.key}><span>{item.label}</span><b>{item.count}</b></p>)}</div>
                  <strong>{voc.sentiments.every((item) => item.key === "unknown") ? "本轮没有逐条情绪标注，禁止推断满意度。" : "比例只描述当前样本，不代表市场总体。"}</strong>
                </article>
              </div>
              <p className="research-whiteboard-report-voc-boundary"><b>样本边界</b>{reportTextZh(voc.sampleBoundary)}</p>
              {voc.gaps.length > 0 ? <div className="research-whiteboard-report-voc-gaps"><b>覆盖缺口</b>{voc.gaps.map((gap) => <span key={gap}>{reportTextZh(gap)}</span>)}</div> : null}
            </section>
          ) : null}
          <section className="research-whiteboard-report-insight-grid" aria-label="证据覆盖与行动验收">
            <article className="research-whiteboard-report-coverage">
              <header><span>本页证据覆盖</span><small>只统计本模块实际引用信源</small></header>
              {sourceCoverage.length > 0 ? <div>
                {sourceCoverage.map((item) => (
                  <p key={item.kind}><b>{item.label}</b><i><span style={{ width: `${Math.max(12, item.count / maximumCoverage * 100)}%` }} /></i><strong>{item.count}</strong></p>
                ))}
              </div> : <p className="is-empty">当前模块还没有可回溯信源。</p>}
            </article>
            <article className="research-whiteboard-report-action-gate">
              <header><span>行动验收</span><small>门槛是待验证假设，不代表已经通过</small></header>
              <strong>{reportTextZh(actionGate?.text.replace(/^行动验收：/u, "") ?? "先补齐本模块关键证据，再决定是否升级商业状态。")}</strong>
              <p><b>不升级条件</b>{reportTextZh(activeModule.unknowns[0] ?? "无法回溯到当前 Run 的结论不进入下一阶段。")}</p>
            </article>
          </section>
          <div className="research-whiteboard-report-evidence-title"><span>证据与行动</span><small>{effectiveEvidenceFilter === "all" ? `${activeModule.items.length} 条证据` : `当前显示 ${filteredItems.length} / ${activeModule.items.length} 条`} · {activeModule.unknowns.length} 项缺口</small></div>
          {showEvidenceFilter ? (
            <section className="research-whiteboard-report-filter" aria-label="按证据等级快速筛选">
              <header><span>快速筛选证据标签</span><small>只影响当前 Tab 的证据卡片</small></header>
              <div>
                {showAllEvidenceFilter ? <button className={effectiveEvidenceFilter === "all" ? "active" : ""} aria-pressed={effectiveEvidenceFilter === "all"} onClick={() => setEvidenceFilter("all")} type="button">全部 <b>{activeModule.items.length}</b></button> : null}
                {visibleEvidenceLevels.map((level) => {
                  const isActive = effectiveEvidenceFilter === level || (!showAllEvidenceFilter && effectiveEvidenceFilter === "all");
                  return (
                    <button className={`${isActive ? "active" : ""} level-${level}`} aria-pressed={isActive} key={level} onClick={() => setEvidenceFilter(level)} type="button">
                      {evidenceLevelLabel[level]} <b>{evidenceCounts[level]}</b>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
          {activeModule.code === "customer" ? (
            <div className="research-whiteboard-report-customer-groups">
              {customerGroups.map((group) => (
                <section className={`research-whiteboard-report-customer-group tone-${group.tone}`} key={group.key}>
                  <header><span>{group.label}</span><small>{group.items.length} 条</small></header>
                  <div className="research-whiteboard-report-evidence-list">
                    {group.items.map((item, itemIndex) => (
                      <div className="research-whiteboard-report-evidence-row" key={`${group.key}-${itemIndex}`}>
                        <b className={`level-${item.level}`}>{evidenceLevelLabel[item.level]}</b>
                        <span>{reportTextZh(item.text)}</span>
                        {item.sourceIds.length > 0 ? <button className="research-whiteboard-source-trigger" onClick={() => setSelection({ claim: reportTextZh(item.text), sourceIds: item.sourceIds })} type="button">查看 {item.sourceIds.length} 个信源</button> : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="research-whiteboard-report-evidence-list">
              {filteredItems.map((item, itemIndex) => (
                <div className="research-whiteboard-report-evidence-row" key={`${activeModule.code}-${itemIndex}`}>
                  <b className={`level-${item.level}`}>{evidenceLevelLabel[item.level]}</b>
                  <span>{reportTextZh(item.text)}</span>
                  {item.sourceIds.length > 0 ? <button className="research-whiteboard-source-trigger" onClick={() => setSelection({ claim: reportTextZh(item.text), sourceIds: item.sourceIds })} type="button">查看 {item.sourceIds.length} 个信源</button> : null}
                </div>
              ))}
            </div>
          )}
          {filteredItems.length === 0 ? <div className="research-whiteboard-report-filter-empty">当前模块还没有可展示的证据。</div> : null}
          {activeModule.code === "marketing" ? (
            <section className="research-whiteboard-report-psychology-bridge" aria-label="心理链如何转成营销表达">
              <header><span>心理链 → 营销转译</span><small>先解释用户为什么买，再决定卖点怎么说</small></header>
              <div className="research-whiteboard-report-psychology-steps">
                <article><b>01</b><strong>触发焦虑</strong><p>从本轮用户证据中提取高频任务、选择困难和风险顾虑。</p></article>
                <i aria-hidden="true">→</i>
                <article><b>02</b><strong>购买标准</strong><p>把产品分工、使用边界、可追溯证据和经济性转成选择标准。</p></article>
                <i aria-hidden="true">→</i>
                <article><b>03</b><strong>内容表达</strong><p>只使用本次 Run 支持的卖点；未验证的性能、认证和效果保持禁用。</p></article>
              </div>
              <p className="research-whiteboard-report-psychology-boundary">当前是可测试的营销草案；样品、目标 SKU 文件和宣称核验通过后，才能升级为正式宣传。</p>
            </section>
          ) : null}
          {activeModule.unknowns.length > 0 ? <div className="research-whiteboard-report-gaps"><b>仍需补证</b>{activeModule.unknowns.map((item, itemIndex) => <span key={`${item}-${itemIndex}`}>{reportTextZh(item)}</span>)}</div> : null}
          <div className="research-whiteboard-report-slide-controls">
            <button disabled={activeIndex <= 0} onClick={() => setActiveCode(modules[activeIndex - 1].code)} type="button">上一页</button>
            <span>{activeIndex + 1} / {modules.length}</span>
            <button disabled={activeIndex >= modules.length - 1} onClick={() => setActiveCode(modules[activeIndex + 1].code)} type="button">下一页</button>
          </div>
        </article>
      ) : null}
      {selection ? (
        <div className="research-whiteboard-source-modal-layer">
          <button className="research-whiteboard-source-modal-backdrop" type="button" aria-label="关闭信源列表" onClick={() => setSelection(null)} />
          <section className="research-whiteboard-source-modal" role="dialog" aria-modal="true" aria-labelledby="report-source-modal-title">
            <header>
              <div>
                <span>证据追溯</span>
                <h2 id="report-source-modal-title">本条结论引用的信源</h2>
                <p>{selection.claim}</p>
              </div>
              <button type="button" aria-label="关闭信源列表" onClick={() => setSelection(null)}><X size={18} /></button>
            </header>
            <div className="research-whiteboard-source-modal-list">
              {selectedSources.map((source, index) => (
                <a href={source.url} key={source.id} target="_blank" rel="noreferrer">
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <span>
                    <strong>{source.label}</strong>
                    <small>{source.url}</small>
                    <i>{sourceKindLabel[source.kind]}</i>
                  </span>
                  <em className={`status-${source.status}`}>{sourceStatusLabel[source.status]}</em>
                  <ExternalLink size={15} />
                </a>
              ))}
              {missingSourceIds.map((sourceId) => (
                <div className="research-whiteboard-source-missing" key={sourceId}>
                  <b>{sourceId}</b>
                  <span>信源编号已被结论引用，但当前白板中没有对应的来源档案。</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
