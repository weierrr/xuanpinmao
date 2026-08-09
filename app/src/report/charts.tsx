import type { PriceMarketStructure } from "../market-structure/types";

/**
 * Chart primitives for the run report.
 *
 * Design-system parameters (from globals.css, light surface only):
 *   magnitude / accent   #ff5b29  signal orange
 *   de-emphasis context  #6c6c6c  steel
 *   track                rgba(0,0,0,.08)
 *
 * The chartreuse highlight (#f5ff80) is deliberately NOT used as a data fill:
 * it measures 1.05:1 against the surface, so it can only be a card background.
 *
 * Every bar is direct-labelled, so values never depend on reading a color.
 */

type BarDatum = {
  label: string;
  value: number;
  /** Text shown at the bar tip. Defaults to the value. */
  valueLabel?: string;
  /** Secondary line under the label. */
  note?: string;
  /** Emphasis form: one series in accent, the rest recessive. */
  emphasis?: boolean;
};

/**
 * Horizontal magnitude bars on a shared scale.
 *
 * Single series, so no legend box — the caption names what is plotted.
 */
export function BarList({
  data,
  max,
  caption,
  scaleNote,
}: Readonly<{
  data: readonly BarDatum[];
  /** Shared upper bound; pass the real denominator so bars stay comparable. */
  max: number;
  caption: string;
  scaleNote?: string;
}>) {
  const anyEmphasis = data.some((item) => item.emphasis);

  return (
    <figure className="report-chart">
      <figcaption>
        {caption}
        {scaleNote && <span className="report-chart-note">{scaleNote}</span>}
      </figcaption>
      <div className="report-bars">
        {data.map((item) => {
          // Emphasis form: when one row is the story, the rest go recessive.
          const accent = anyEmphasis ? item.emphasis === true : true;
          return (
            <div className="report-bar-row" key={item.label}>
              <div className="report-bar-label">
                <span>{item.label}</span>
                {item.note && <small>{item.note}</small>}
              </div>
              <div className="report-bar-track">
                <div
                  className={`report-bar-fill ${accent ? "accent" : "muted"}`}
                  style={{ width: `${max > 0 ? Math.min(100, (item.value / max) * 100) : 0}%` }}
                  title={`${item.label}：${item.valueLabel ?? item.value}`}
                />
              </div>
              <div className="report-bar-value">{item.valueLabel ?? item.value}</div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

/** A single ratio against a limit reads as a meter, never a two-slice pie. */
export function ScoreMeter({
  value,
  max = 100,
  label,
}: Readonly<{ value: number; max?: number; label: string }>) {
  return (
    <div className="report-meter">
      <div className="report-meter-head">
        <span>{label}</span>
        <strong>{value}<em>/{max}</em></strong>
      </div>
      <div className="report-bar-track">
        <div className="report-bar-fill accent" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

export type TimelineStep = {
  name: string;
  typeLabel: string;
  days: number;
  budget: string;
};

/**
 * Sequential validation plan on a shared day axis.
 *
 * Segments sit on one baseline with a 2px surface gap between them, so the
 * reader sees both each step's length and the cumulative commitment.
 */
export function ValidationTimeline({
  steps,
  totalDays,
  caption,
}: Readonly<{ steps: readonly TimelineStep[]; totalDays: number; caption: string }>) {
  return (
    <figure className="report-chart">
      <figcaption>
        {caption}
        <span className="report-chart-note">共 {totalDays} 天，按顺序推进；前一阶段失败即不进入下一阶段</span>
      </figcaption>

      <div className="report-timeline-track">
        {steps.map((step, index) => (
          <div
            className="report-timeline-segment"
            key={`${step.name}-${index}`}
            style={{ width: `${(step.days / totalDays) * 100}%` }}
            title={`${step.typeLabel}：${step.days} 天 · ${step.budget}`}
          >
            <span>{step.days}天</span>
          </div>
        ))}
      </div>
      <div className="report-timeline-axis">
        <span>第 0 天</span>
        <span>第 {totalDays} 天</span>
      </div>

      <ol className="report-timeline-legend">
        {steps.map((step, index) => (
          <li key={`${step.name}-legend-${index}`}>
            <span className="report-timeline-index">{index + 1}</span>
            <span className="report-timeline-name">{step.typeLabel}</span>
            <span className="report-timeline-meta">{step.days} 天 · {step.budget}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

/** Pass / hold state across the three decision layers, as a stepper. */
export function DecisionChain({
  steps,
}: Readonly<{ steps: readonly { label: string; value: string; state: "pass" | "hold" }[] }>) {
  return (
    <ol className="report-chain">
      {steps.map((step) => (
        <li className={`report-chain-step ${step.state}`} key={step.label}>
          <span className="report-chain-label">{step.label}</span>
          <strong>{step.value}</strong>
        </li>
      ))}
    </ol>
  );
}

/**
 * Competitor price anchors and our recommended band on one axis.
 *
 * Two or three anchors is not an average — the caption says so, because the
 * competitor's headline figure ("US$24.97 vs 均价 US$83.19") is exactly the
 * kind of claim that reads as authoritative on a sample of two.
 */
export function PriceAxis({
  anchors,
  range,
  rangeText,
  structure,
}: Readonly<{
  anchors: readonly {
    label: string;
    current: number;
    original: number | null;
    currencySymbol: string;
    url: string | null;
    summary?: string;
    tier?: string;
  }[];
  range: { low: number; high: number; currencySymbol: string } | null;
  rangeText: string;
  structure?: PriceMarketStructure | null;
}>) {
  if (anchors.length === 0) return null;
  const symbol = anchors[0]?.currencySymbol ?? range?.currencySymbol ?? "";
  const sorted = [...anchors].sort((a, b) => a.current - b.current);
  const bandKeys = ["entry", "core", "premium"] as const;
  const fallbackBandForIndex = (index: number): (typeof bandKeys)[number] =>
    bandKeys[Math.min(2, Math.floor((index * 3) / sorted.length))];
  const bandFor = (price: number, index: number): (typeof bandKeys)[number] =>
    structure?.bands.find((band) => price >= band.observedLow && price <= band.observedHigh)?.key
    ?? fallbackBandForIndex(index);
  const values = [...sorted.map((anchor) => anchor.current), ...(range ? [range.low, range.high] : [])];
  const domainMin = Math.max(0, Math.floor(Math.min(...values) / 10) * 10);
  const domainMax = Math.ceil(Math.max(...values) / 10) * 10 + 10;
  const plotLeft = 100;
  const plotRight = 790;
  const xFor = (value: number): number =>
    plotLeft + ((value - domainMin) / (domainMax - domainMin)) * (plotRight - plotLeft);
  const ticks = Array.from(
    { length: Math.floor((domainMax - domainMin) / 10) + 1 },
    (_, index) => domainMin + index * 10,
  );
  const assignedBands = sorted.map((anchor, index) => bandFor(anchor.current, index));
  const bandTotals = new Map<string, number>();
  for (const band of assignedBands) bandTotals.set(band, (bandTotals.get(band) ?? 0) + 1);
  const bandCounts = new Map<string, number>();
  const shortName = (label: string): string => {
    if (label.startsWith("Oner Active")) return "Oner Active";
    return label.split(" ")[0] ?? label;
  };
  const laneBounds = {
    premium: { top: 34, bottom: 84 },
    core: { top: 110, bottom: 222 },
    entry: { top: 250, bottom: 300 },
  } as const;
  const points = sorted.map((anchor, index) => {
    const band = assignedBands[index];
    const bandIndex = bandCounts.get(band) ?? 0;
    bandCounts.set(band, bandIndex + 1);
    const total = bandTotals.get(band) ?? 1;
    const lane = laneBounds[band];
    const y = lane.top + ((bandIndex + 1) / (total + 1)) * (lane.bottom - lane.top);
    return { anchor, band, x: xFor(anchor.current), y };
  });
  const labelFor = (key: (typeof bandKeys)[number]): string =>
    structure?.bands.find((band) => band.key === key)?.label
    ?? ({ entry: "低位进入带", core: "主流比较带", premium: "高位溢价带" } as const)[key];

  return (
    <figure className="report-chart">
      <figcaption>
        竞品价格地图
        <span className="report-chart-note">
          横向对比 {anchors.length} 个公开价格点；点击竞品名称可查看对应页面。促销价和库存会变化，不把它们算成“市场均价”。
        </span>
      </figcaption>

      {range && (
        <div className="report-price-recommendation">
          <span>我们的建议售价</span>
          <strong>{symbol}{range.low}–{symbol}{range.high}</strong>
          <p>{structure?.recommendedRangePosition.conclusion ?? "建议区间只用于竞品相对比较；能否站稳，取决于样品质量、单位经济和真实付费验证。"}</p>
        </div>
      )}

      <div className="report-price-scatter-scroll">
        <svg
          className="report-price-scatter"
          viewBox="0 0 820 350"
          role="img"
          aria-label={`${anchors.length} 个竞品公开售价与建议售价区间散点图`}
        >
          <title>竞品公开售价散点图</title>
          <rect className="report-price-lane high" x="100" y="24" width="690" height="68" rx="8" />
          <rect className="report-price-lane medium" x="100" y="98" width="690" height="136" rx="8" />
          <rect className="report-price-lane low" x="100" y="240" width="690" height="66" rx="8" />
          <text className="report-price-lane-label" x="14" y="61">{labelFor("premium")}</text>
          <text className="report-price-lane-label" x="14" y="169">{labelFor("core")}</text>
          <text className="report-price-lane-label" x="14" y="278">{labelFor("entry")}</text>

          {range && (
            <g className="report-price-range-band">
              <rect x={xFor(range.low)} y="18" width={xFor(range.high) - xFor(range.low)} height="294" rx="8" />
              <text x={(xFor(range.low) + xFor(range.high)) / 2} y="16" textAnchor="middle">
                我们建议 {symbol}{range.low}–{symbol}{range.high}
              </text>
            </g>
          )}

          {ticks.map((tick) => (
            <g className="report-price-tick" key={tick}>
              <line x1={xFor(tick)} x2={xFor(tick)} y1="24" y2="312" />
              <text x={xFor(tick)} y="336" textAnchor="middle">{symbol}{tick}</text>
            </g>
          ))}

          {points.map(({ anchor, band, x, y }) => {
            const point = (
              <g className={`report-price-point tier-${band}`} transform={`translate(${x} ${y})`}>
                <title>{`${anchor.label}：${anchor.currencySymbol}${anchor.current}`}</title>
                <circle r="7" />
                <text y="-10" textAnchor="middle">
                  <tspan x="0">{shortName(anchor.label)}</tspan>
                  <tspan x="0" dy="14">{anchor.currencySymbol}{anchor.current}</tspan>
                </text>
              </g>
            );
            return anchor.url ? (
              <a href={anchor.url} target="_blank" rel="noreferrer" key={anchor.label} aria-label={`查看 ${anchor.label} 商品页`}>
                {point}
              </a>
            ) : <g key={anchor.label}>{point}</g>;
          })}
          <line className="report-price-axis-line" x1={plotLeft} x2={plotRight} y1="312" y2="312" />
          <text className="report-price-axis-label" x="790" y="345" textAnchor="end">公开售价（美元）</text>
        </svg>
      </div>

      <details className="report-price-details">
        <summary>查看 {sorted.length} 个竞品的价格与说明</summary>
        <ol className="report-price-cards">
          {sorted.map((anchor) => (
            <li key={anchor.label}>
              <span className="report-price-tier">{labelFor(bandFor(anchor.current, sorted.indexOf(anchor)))}</span>
              <span className="report-price-name">
                {anchor.url ? <a href={anchor.url} target="_blank" rel="noreferrer">{anchor.label}</a> : anchor.label}
              </span>
              <span className="report-price-value">
                {anchor.currencySymbol}{anchor.current}
                {anchor.original !== null && <em> 原价 {anchor.currencySymbol}{anchor.original}</em>}
              </span>
              <p>{anchor.summary ?? "原报告已核查的竞品公开价格。"}</p>
            </li>
          ))}
        </ol>
      </details>

      {!range && <p className="appendix-note">建议区间未能结构化：{rangeText}</p>}
    </figure>
  );
}

/**
 * Complaints against satisfaction for the same theme, on one shared scale.
 *
 * Sentiment is an ordered agree/disagree scale, so this is a diverging form:
 * two opposite hues around a neutral midpoint, never one hue for both sides.
 * Pair validated against the light surface (#ff5b29 / #1f6feb, all six checks
 * pass), and both sides are direct-labelled so identity never rests on color.
 */
export function SentimentSplit({
  rows,
  denominator,
  caption,
}: Readonly<{
  rows: readonly { theme: string; negative: number; positive: number; sourceLabel?: string }[];
  denominator: number;
  caption: string;
}>) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.flatMap((row) => [row.negative, row.positive]));
  if (max === 0) return null;
  const pct = (value: number) => `${(value / max) * 50}%`;

  return (
    <figure className="report-chart">
      <figcaption>
        {caption}
        <span className="report-chart-note">
          同一主题下的抱怨与满意，共用一条标尺，中线为零；
          分母为 {denominator} 条有效评论级观察，计数不代表市场总体发生率。
        </span>
      </figcaption>

      <div className="report-split-legend">
        <span><i className="neg" />抱怨</span>
        <span><i className="pos" />满意</span>
      </div>

      <div className="report-splits">
        {rows.map((row) => (
          <div className="report-split-row" key={row.theme}>
            <div className="report-split-theme">
              {row.theme}
              {row.sourceLabel && <small>来自：{row.sourceLabel}</small>}
            </div>
            <div className="report-split-value neg">{row.negative}</div>
            <div className="report-split-track">
              <div className="report-split-half left">
                <div
                  className="report-split-fill neg"
                  style={{ width: pct(row.negative) }}
                  title={`${row.theme}：抱怨 ${row.negative}/${denominator}`}
                />
              </div>
              <div className="report-split-half right">
                <div
                  className="report-split-fill pos"
                  style={{ width: pct(row.positive) }}
                  title={`${row.theme}：满意 ${row.positive}/${denominator}`}
                />
              </div>
            </div>
            <div className="report-split-value pos">{row.positive}</div>
          </div>
        ))}
      </div>
    </figure>
  );
}
