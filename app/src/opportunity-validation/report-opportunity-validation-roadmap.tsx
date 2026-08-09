import { ArrowRight, FlaskConical, Search, ShieldAlert } from "lucide-react";
import type { OpportunityValidationRoadmap } from "./types";

const priorityClass = {
  E1_RESEARCH_NEXT: "priority-p0",
  E2_RESEARCH_LATER: "priority-p1",
  E3_OBSERVE: "priority-p2",
  DO_NOT_CONTINUE: "priority-stop",
} as const;

export function ReportOpportunityValidationRoadmap({
  roadmap,
}: Readonly<{ roadmap: OpportunityValidationRoadmap }>) {
  const recommended = roadmap.candidates.find((candidate) => candidate.id === roadmap.recommendedCandidateId);

  return (
    <section className="report-opportunity-roadmap" aria-labelledby="opportunity-validation-roadmap-title">
      <header className="report-opportunity-roadmap-head">
        <div>
          <span>把发现变成行动</span>
          <h3 id="opportunity-validation-roadmap-title">相邻机会先研究哪个？</h3>
          <p>
            不按想象空间排序，只按直接商品证据、当前研究状态和反向证据安排下一轮工作。
            这里仅表示探索支线内部顺序，不会替代当前瑜伽裤的主线验证。
          </p>
        </div>
        <div className="report-opportunity-roadmap-summary">
          <FlaskConical size={21} />
          <span>探索支线首选</span>
          <strong>{recommended?.title ?? "暂无优先探索候选"}</strong>
        </div>
      </header>

      <div className="report-opportunity-roadmap-metrics" aria-label="机会优先级汇总">
        <div><strong>{roadmap.metrics.exploreFirst}</strong><span>优先补充研究</span></div>
        <div><strong>{roadmap.metrics.researchLater}</strong><span>后续补证</span></div>
        <div><strong>{roadmap.metrics.observe}</strong><span>暂时观察</span></div>
      </div>

      <ol className="report-opportunity-roadmap-list">
        {roadmap.candidates.map((candidate) => (
          <li className={`report-opportunity-candidate ${priorityClass[candidate.priority]}`} key={candidate.id}>
            <article>
              <header>
                <span className="report-opportunity-candidate-order">{String(candidate.order).padStart(2, "0")}</span>
                <div>
                  <span className="report-opportunity-priority">{candidate.priorityLabel}</span>
                  <h4>{candidate.title}</h4>
                  <p>{candidate.category}</p>
                </div>
              </header>

              <p className="report-opportunity-priority-reason">{candidate.whyThisPriority}</p>

              <div className="report-opportunity-evidence-row">
                <span>{candidate.evidence.directProductEvidence ? "有直接商品线索" : "无直接商品线索"}</span>
                <span>{candidate.evidence.statusLabel}</span>
                <span>支持 {candidate.evidence.supportCount}</span>
                <span>反向 {candidate.evidence.counterevidenceCount}</span>
              </div>

              <div className="report-opportunity-relationship-row">
                {candidate.relationships.map((relationship) => <span key={relationship}>{relationship}</span>)}
              </div>

              <details open={candidate.priority === "E1_RESEARCH_NEXT"}>
                <summary><Search size={14} />查看最小研究方案</summary>
                <div className="report-opportunity-research-plan">
                  <section>
                    <span>这轮先回答</span>
                    <strong>{candidate.researchPlan.objective}</strong>
                    <ul>{candidate.researchPlan.questions.map((question) => <li key={question}>{question}</li>)}</ul>
                  </section>
                  <section>
                    <span>建议检索</span>
                    <ul>{candidate.researchPlan.queries.map((query) => <li key={query}>{query}</li>)}</ul>
                  </section>
                  <dl>
                    <div><dt>通过</dt><dd>{candidate.researchPlan.pass}</dd></div>
                    <div><dt>失败</dt><dd>{candidate.researchPlan.fail}</dd></div>
                    <div><dt>停止</dt><dd>{candidate.researchPlan.stop}</dd></div>
                    <div><dt>通过后</dt><dd>{candidate.researchPlan.nextIfPass}</dd></div>
                    <div><dt>失败后</dt><dd>{candidate.researchPlan.nextIfFail}</dd></div>
                  </dl>
                  <footer>
                    <span>{candidate.researchPlan.durationLabel}</span>
                    <strong>{candidate.researchPlan.budgetLabel}</strong>
                  </footer>
                </div>
              </details>

              <p className="report-opportunity-candidate-boundary">
                <ShieldAlert size={14} />{candidate.evidence.boundary}
              </p>
            </article>
          </li>
        ))}
      </ol>

      <footer className="report-opportunity-roadmap-boundary">
        <div>
          <strong>排序规则</strong>
          <p>{roadmap.orderingRule}</p>
        </div>
        <a href="#chapter-validation">查看当前瑜伽裤验证计划 <ArrowRight size={14} /></a>
      </footer>
    </section>
  );
}
