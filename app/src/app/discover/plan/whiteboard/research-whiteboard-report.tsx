"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { reportTextZh } from "@/report/report-copy";
import type { ResearchWhiteboardReportModule, ResearchWhiteboardSource } from "@/research-whiteboard/types";

type ResearchWhiteboardReportProps = Readonly<{
  modules: ResearchWhiteboardReportModule[];
  sources: ResearchWhiteboardSource[];
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

export function ResearchWhiteboardReport({ modules, sources }: ResearchWhiteboardReportProps) {
  const [selection, setSelection] = useState<SourceSelection | null>(null);
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);

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

  return (
    <section className="research-whiteboard-report" aria-label="六大选品结论">
      <header>
        <span>选品结论</span>
        <h3>六大选品结论</h3>
        <p>先看每个模块的核心结论；需要核查时，再展开证据、来源和仍未解决的问题。</p>
      </header>
      <div className="research-whiteboard-report-grid">
        {modules.map((module, index) => (
          <article key={module.code} id={`whiteboard-report-${module.code}`}>
            <header><span>{String(index + 1).padStart(2, "0")}</span><div><h4>{module.title}</h4><p>{module.question}</p></div></header>
            <strong>{reportTextZh(module.conclusion)}</strong>
            <details>
              <summary>展开证据与缺口</summary>
              <ul>
                {module.items.map((item, itemIndex) => (
                  <li key={`${module.code}-${itemIndex}`}>
                    <b className={`level-${item.level}`}>{evidenceLevelLabel[item.level]}</b>
                    <span>{reportTextZh(item.text)}</span>
                    {item.sourceIds.length > 0 ? (
                      <button
                        className="research-whiteboard-source-trigger"
                        onClick={() => setSelection({ claim: reportTextZh(item.text), sourceIds: item.sourceIds })}
                        type="button"
                      >
                        查看 {item.sourceIds.length} 个信源
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {module.unknowns.length > 0 ? (
                <div className="research-whiteboard-unknowns"><b>仍需补证</b><ul>{module.unknowns.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{reportTextZh(item)}</li>)}</ul></div>
              ) : null}
            </details>
          </article>
        ))}
      </div>

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
