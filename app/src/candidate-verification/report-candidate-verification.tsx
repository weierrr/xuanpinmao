import {
  ArrowRight,
  BadgeCheck,
  CircleHelp,
  GitCompareArrows,
  Layers3,
  PackageSearch,
  ShieldAlert,
} from "lucide-react";
import { candidateInputLabel } from "./service";
import type { CandidateVerificationWorkspace } from "./types";

const evidenceStatusClass = {
  verified: "verified",
  directional: "directional",
  unverified: "unverified",
  blocked: "blocked",
} as const;

export function ReportCandidateVerification({
  workspace,
}: Readonly<{ workspace: CandidateVerificationWorkspace }>) {
  return (
    <section className="report-candidate-workspace" aria-labelledby="candidate-verification-title">
      <header className="report-candidate-head">
        <div>
          <span>CANDIDATE CHECK / 候选商品核验</span>
          <h3 id="candidate-verification-title">找到货后，把链接带回来核验</h3>
          <p>{workspace.submissionPrompt}</p>
        </div>
        <strong>{workspace.statusLabel}</strong>
      </header>

      <div className="report-candidate-target">
        <div>
          <span>当前要找的方向</span>
          <strong>{workspace.targetDefinition.direction}</strong>
          <p>{workspace.targetDefinition.productConcept}</p>
        </div>
        <ArrowRight size={22} aria-hidden="true" />
        <div>
          <span>可提交的材料</span>
          <div className="report-candidate-inputs">
            {workspace.acceptedInputs.map((input) => <em key={input}>{candidateInputLabel(input)}</em>)}
          </div>
        </div>
      </div>

      <ol className="report-candidate-flow" aria-label="候选商品核验流程">
        {[
          { icon: PackageSearch, title: "识别商品", copy: "锁定平台、供应商、链接与具体款" },
          { icon: Layers3, title: "隔离变体", copy: "每条事实绑定颜色、尺码和材料" },
          { icon: GitCompareArrows, title: "判断同款", copy: "区分 Exact、Near、相邻与不匹配" },
          { icon: BadgeCheck, title: "形成行动", copy: "给出可做、先确认和不能做" },
        ].map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title}>
              <span>{index + 1}</span>
              <Icon size={19} />
              <div><strong>{step.title}</strong><small>{step.copy}</small></div>
            </li>
          );
        })}
      </ol>

      <details className="report-candidate-details">
        <summary>展开核验标准、证据状态和行动清单</summary>
        <div className="report-candidate-details-content">
          <section>
            <h4>当前证据状态</h4>
            <div className="report-candidate-evidence-grid">
              {workspace.evidenceModules.map((module) => (
                <article key={module.key}>
                  <div>
                    <strong>{module.label}</strong>
                    <span className={evidenceStatusClass[module.status]}>{module.statusLabel}</span>
                  </div>
                  <p>{module.conclusion}</p>
                  <small>为什么：{module.reason}</small>
                  <small>下一步：{module.nextVerification}</small>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h4>Exact / Near 匹配规则</h4>
            <div className="report-candidate-match-grid">
              {workspace.matchRules.map((rule) => (
                <article key={rule.level} data-level={rule.level}>
                  <span>{rule.level.toUpperCase()}</span>
                  <strong>{rule.label}</strong>
                  <p>{rule.definition}</p>
                  <small>{rule.priceUse}</small>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h4>核验后的行动边界</h4>
            <div className="report-candidate-action-grid">
              <article className="can-do"><strong>现在可以做</strong><ul>{workspace.actionLanes.canDo.map((item) => <li key={item}>{item}</li>)}</ul></article>
              <article className="must-confirm"><strong>必须先确认</strong><ul>{workspace.actionLanes.mustConfirm.map((item) => <li key={item}>{item}</li>)}</ul></article>
              <article className="cannot-do"><strong>现在不能做</strong><ul>{workspace.actionLanes.cannotDo.map((item) => <li key={item}>{item}</li>)}</ul></article>
            </div>
          </section>
        </div>
      </details>

      <p className="report-candidate-boundary"><CircleHelp size={15} />{workspace.boundary}</p>
    </section>
  );
}

export function ReportCreativeReferenceLibrary({
  workspace,
}: Readonly<{ workspace: CandidateVerificationWorkspace }>) {
  if (workspace.references.length === 0) return null;
  return (
    <details className="appendix-block report-creative-reference-library">
      <summary>竞品页面与素材参考（{workspace.references.length} 条）</summary>
      <div className="report-reference-grid">
        {workspace.references.map((reference) => (
          <article key={reference.id}>
            <div>
              <span>{reference.platform}</span>
              <em className={evidenceStatusClass[reference.status]}>{reference.statusLabel}</em>
            </div>
            <h4>{reference.title}</h4>
            <p><strong>借鉴用途</strong>：{reference.use}</p>
            <small><ShieldAlert size={13} />{reference.boundary}</small>
            <a href={reference.url} target="_blank" rel="noreferrer">查看原始页面 <ArrowRight size={14} /></a>
          </article>
        ))}
      </div>
      <p className="report-reference-boundary">参考链接只用于拆解商品展示、内容钩子和承接结构；旧素材、公开页面或评论不能直接证明当前热度、投放效果或成交。</p>
    </details>
  );
}
