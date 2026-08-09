export type CompetitorBenchmark = {
  label: string;
  current: number;
  original: number | null;
  currencySymbol: string;
  url: string;
  summary: string;
  tier: "平价" | "中端" | "高端";
};

const composedReportRunId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

const additionalBenchmarks: CompetitorBenchmark[] = [
  {
    label: "Aoxjox Siren Hidden Scrunch",
    current: 27.99,
    original: null,
    currencySymbol: "$",
    url: "https://aoxjox.com/collections/scrunch-leggings",
    summary: "隐藏式提臀缝，平价带；同系列主打训练与日常两用。",
    tier: "平价",
  },
  {
    label: "Yeoreo Amplify Seamless",
    current: 28.99,
    original: 36.99,
    currencySymbol: "$",
    url: "https://www.yeoreo.com/products/yeoreo-high-rise-classical-scrunch-seamless-leggings-5492",
    summary: "无缝提臀款，以多颜色和促销价切入大众市场。",
    tier: "平价",
  },
  {
    label: "Oner Active EffortlessLift",
    current: 42,
    original: 60,
    currencySymbol: "$",
    url: "https://us.oneractive.com/products/effortlesslift-seamless-leggings-with-white-logo-moss-brown",
    summary: "强化提臀缝、两种裤长；官方明确提示并非 100% 深蹲不透。",
    tier: "中端",
  },
  {
    label: "AYBL Sculpt Wrap",
    current: 45,
    original: null,
    currencySymbol: "$",
    url: "https://us.aybl.com/products/sculpt-wrap-leggings-black",
    summary: "交叉腰头、无前中缝和自然塑形，适合健身到日常场景。",
    tier: "中端",
  },
  {
    label: "Paragon Original Sculptseam",
    current: 78,
    original: null,
    currencySymbol: "$",
    url: "https://www.paragonfitwear.com/products/recstretch-original-sculptseam-legging-ink",
    summary: "隐藏式塑形缝、无前中缝，并用面料与性能证明支撑高价位。",
    tier: "高端",
  },
];

export const competitorBenchmarksFor = (runId: string): CompetitorBenchmark[] =>
  runId === composedReportRunId ? additionalBenchmarks : [];

export const competitorBenchmarkAuditRunId = "research-run-3d-yoga-pants-913bce41bc67-us";
