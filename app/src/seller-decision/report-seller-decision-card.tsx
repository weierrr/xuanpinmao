import { ArrowRight, CircleHelp } from "lucide-react";
import type { SellerDecisionCard } from "./types";

type EvidenceBasisItem = {
  value: string;
  label: string;
  detail?: string;
};

const signalTone: Record<SellerDecisionCard["signals"][number]["key"], string> = {
  market: "positive",
  competition: "warning",
  crowding: "warning",
  whitespace: "positive",
};

export function ReportSellerDecisionCard({
  card,
  evidenceBasis = [],
}: Readonly<{
  card: SellerDecisionCard;
  evidenceBasis?: EvidenceBasisItem[];
}>) {
  const opportunity = card.signals.find((signal) => signal.key === "whitespace");

  return (
    <section className="report-seller-decision" aria-labelledby="seller-decision-title">
      <header className="report-seller-decision-head">
        <div>
          <span>SELLER VERDICT / 生意判断</span>
          <h3 id="seller-decision-title">{card.primaryVerdict}</h3>
          {opportunity ? <p><strong>机会在哪：</strong>{opportunity.detail}</p> : null}
        </div>
        <a
          className="report-seller-validation-link"
          href="#chapter-validation"
          aria-label={`${card.statusLabel}：查看验证方案`}
        >
          查看验证方案
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </header>

      {evidenceBasis.length > 0 ? (
        <div className="report-seller-evidence" aria-label="本次判断依据">
          <strong>这份判断基于</strong>
          <dl>
            {evidenceBasis.map((item) => (
              <div key={`${item.value}-${item.label}`}>
                <dt>{item.value}</dt>
                <dd>{item.label}</dd>
                {item.detail ? <small>{item.detail}</small> : null}
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="report-seller-signals">
        {card.signals.map((signal) => (
          <article className={`report-seller-signal ${signalTone[signal.key]}`} key={signal.key}>
            <div>
              <span>{signal.question}</span>
              <small>{signal.evidenceLabel}</small>
            </div>
            <strong>{signal.verdict}</strong>
            <p>{signal.detail}</p>
          </article>
        ))}
      </div>

      <div className="report-seller-next">
        <span>现在怎么做</span>
        <strong>{card.nextAction}</strong>
        <ArrowRight size={19} aria-hidden="true" />
      </div>
      <p className="report-seller-boundary"><CircleHelp size={15} />{card.boundary}</p>
    </section>
  );
}
