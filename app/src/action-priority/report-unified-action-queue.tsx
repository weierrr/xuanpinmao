import { ArrowRight, CheckCircle2, FlaskConical, LockKeyhole, Search, ShieldAlert } from "lucide-react";
import type { UnifiedActionQueue } from "./types";

const actionStatusLabels = {
  READY: "现在执行",
  BLOCKED: "等待前置步骤",
  PARALLEL_RESEARCH: "可低成本并行研究",
  OBSERVE: "暂时观察",
} as const;

export function ReportUnifiedActionQueue({ queue }: Readonly<{ queue: UnifiedActionQueue }>) {
  const globalFirst = queue.mainline.find((action) => action.id === queue.globalFirstActionId);
  if (!globalFirst) return null;

  return (
    <section className="report-unified-actions" aria-labelledby="unified-action-queue-title">
      <header className="report-unified-actions-head">
        <div>
          <span>全报告统一行动顺序</span>
          <h3 id="unified-action-queue-title">现在只先做这一件事</h3>
          <p>当前瑜伽裤验证是唯一主线；相邻机会可以补充公开研究，但不能取代主线或抢占样品与供应预算。</p>
        </div>
        <div className="report-unified-actions-count">
          <strong>1</strong>
          <span>个全局第一步</span>
        </div>
      </header>

      <article className="report-global-first-action">
        <div className="report-global-first-icon"><FlaskConical size={24} /></div>
        <div>
          <span>GLOBAL FIRST · 全局第一步</span>
          <h4>{globalFirst.title}</h4>
          <p>{globalFirst.description}</p>
        </div>
        <dl>
          <div><dt>通过标准</dt><dd>{globalFirst.successCondition}</dd></div>
          <div><dt>失败后</dt><dd>{globalFirst.failureAction}</dd></div>
        </dl>
        <a href={globalFirst.sourceAnchor}>查看完整实验 <ArrowRight size={14} /></a>
      </article>

      <div className="report-action-lanes">
        <section className="report-action-lane report-action-mainline">
          <header>
            <div><CheckCircle2 size={17} /><strong>主线 · 当前瑜伽裤</strong></div>
            <span>{queue.mainline.length} 个连续步骤</span>
          </header>
          <ol>
            {queue.mainline.map((action) => (
              <li className={action.status === "READY" ? "ready" : "blocked"} key={action.id}>
                <span className="report-action-step-number">{String(action.order).padStart(2, "0")}</span>
                <div>
                  <em>{actionStatusLabels[action.status]}</em>
                  <strong>{action.title}</strong>
                  <span>{action.typeLabel}</span>
                  {action.embeddedChecks.map((check) => (
                    <p key={check.label}><FlaskConical size={12} />样品阶段同时完成：{check.label}</p>
                  ))}
                </div>
                {action.status === "BLOCKED" ? <LockKeyhole size={14} /> : <CheckCircle2 size={14} />}
              </li>
            ))}
          </ol>
        </section>

        <section className="report-action-lane report-action-exploration">
          <header>
            <div><Search size={17} /><strong>探索支线 · 相邻机会</strong></div>
            <span>只做公开研究</span>
          </header>
          <ol>
            {queue.exploration.map((action) => (
              <li key={action.id}>
                <span className="report-action-step-number">{String(action.order).padStart(2, "0")}</span>
                <div>
                  <em>{actionStatusLabels[action.status]}</em>
                  <strong>{action.title}</strong>
                  <span>{action.typeLabel}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="report-unified-actions-boundary">
        <ShieldAlert size={15} />
        <p>{queue.crossLanePolicy}</p>
      </footer>
    </section>
  );
}
