import type { PriceRange } from "../report/price-anchors";
import {
  priceBandKeys,
  priceMarketStructureSchema,
  type MarketOfferPrice,
  type ObservedPriceBand,
  type PriceMarketStructure,
} from "./types";

export type MarketOfferPriceInput = Omit<MarketOfferPrice, "id"> & { id?: string };

type BuildPriceMarketStructureInput = {
  runId: string;
  product: string;
  market: string;
  generatedAt: string;
  offers: MarketOfferPriceInput[];
  recommendedRange: PriceRange | null;
};

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const safeId = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 48) || "offer";

const normalizeOffers = (offers: MarketOfferPriceInput[]): MarketOfferPrice[] => {
  const seen = new Set<string>();
  const normalized: MarketOfferPrice[] = [];
  for (const [index, offer] of offers.entries()) {
    const key = `${offer.label.trim().toLowerCase()}|${offer.currencySymbol}|${round(offer.currentPrice)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      ...offer,
      id: offer.id ?? `price-${String(index + 1).padStart(2, "0")}-${safeId(offer.label)}`,
      currentPrice: round(offer.currentPrice),
      listPrice: offer.listPrice === null ? null : round(offer.listPrice),
    });
  }
  return normalized;
};

const dominantCurrency = (offers: MarketOfferPrice[], recommendedRange: PriceRange | null): string => {
  const counts = new Map<string, number>();
  for (const offer of offers) counts.set(offer.currencySymbol, (counts.get(offer.currencySymbol) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    if (recommendedRange?.currencySymbol === a[0]) return -1;
    if (recommendedRange?.currencySymbol === b[0]) return 1;
    return a[0].localeCompare(b[0]);
  })[0]?.[0] ?? recommendedRange?.currencySymbol ?? "$";
};

const bandLabels: Record<(typeof priceBandKeys)[number], string> = {
  entry: "低位进入带",
  core: "主流比较带",
  premium: "高位溢价带",
};

const bandInterpretations: Record<(typeof priceBandKeys)[number], string> = {
  entry: "当前样本中相对较低的公开报价，更多承担进入门槛和价格敏感型比较作用。",
  core: "当前样本中间段的公开报价，是用户进行功能、品牌和证明比较的主要参照区。",
  premium: "当前样本中相对较高的公开报价，需要更强品牌、产品或证明资产支撑溢价。",
};

const buildBands = (offers: MarketOfferPrice[]): ObservedPriceBand[] => {
  const distinctPrices = [...new Set(offers.map((offer) => offer.currentPrice))].sort((a, b) => a - b);
  if (distinctPrices.length < 3) return [];
  const priceBandByValue = new Map<number, (typeof priceBandKeys)[number]>();
  distinctPrices.forEach((price, index) => {
    const bandIndex = Math.min(2, Math.floor((index * 3) / distinctPrices.length));
    priceBandByValue.set(price, priceBandKeys[bandIndex]);
  });

  return priceBandKeys.map((key) => {
    const bandOffers = offers
      .filter((offer) => priceBandByValue.get(offer.currentPrice) === key)
      .sort((a, b) => a.currentPrice - b.currentPrice);
    return {
      key,
      label: bandLabels[key],
      observedLow: bandOffers[0].currentPrice,
      observedHigh: bandOffers[bandOffers.length - 1].currentPrice,
      observationCount: bandOffers.length,
      shareOfObservedOffers: round(bandOffers.length / offers.length, 4),
      offerIds: bandOffers.map((offer) => offer.id),
      interpretation: bandInterpretations[key],
    };
  });
};

const shapeLabels = {
  unresolved: "结构待补证",
  compressed: "价格压缩型",
  laddered: "连续阶梯型",
  split: "两段分化型",
  anchor_stretched: "高低锚点拉伸型",
} as const;

const buildShape = (
  offers: MarketOfferPrice[],
  low: number,
  high: number,
  largestGap: PriceMarketStructure["largestGap"],
): PriceMarketStructure["shape"] => {
  const distinctPrices = [...new Set(offers.map((offer) => offer.currentPrice))].sort((a, b) => a - b);
  if (distinctPrices.length < 3 || !largestGap) {
    return {
      key: "unresolved",
      label: shapeLabels.unresolved,
      conclusion: "公开报价点不足，暂时不能判断价格结构。",
      rationale: "至少需要三个不同价格点才能区分压缩、阶梯或断层结构。",
    };
  }
  if (high / low <= 1.5) {
    return {
      key: "compressed",
      label: shapeLabels.compressed,
      conclusion: "已观察报价集中在较窄区间，价格本身较难形成明显区隔。",
      rationale: `最高公开报价约为最低价的 ${round(high / low, 2)} 倍，样本价格跨度相对有限。`,
    };
  }
  if (largestGap.shareOfObservedSpan >= 0.4) {
    const lowerCount = distinctPrices.filter((price) => price <= largestGap.fromPrice).length;
    const upperCount = distinctPrices.filter((price) => price >= largestGap.toPrice).length;
    if (Math.min(lowerCount, upperCount) === 1) {
      return {
        key: "anchor_stretched",
        label: shapeLabels.anchor_stretched,
        conclusion: "一个孤立的高价或低价锚点拉长了整体区间，不能据此宣称存在成熟细分市场。",
        rationale: `最大价差占已观察跨度的 ${Math.round(largestGap.shareOfObservedSpan * 100)}%，且断层一侧只有一个不同价格点。`,
      };
    }
    return {
      key: "split",
      label: shapeLabels.split,
      conclusion: "公开报价在最大断层两侧形成两个可见区段，但不代表销量也按同样方式分布。",
      rationale: `最大价差占已观察跨度的 ${Math.round(largestGap.shareOfObservedSpan * 100)}%，断层两侧均有多个价格点。`,
    };
  }
  return {
    key: "laddered",
    label: shapeLabels.laddered,
    conclusion: "公开报价从低到高形成相对连续的价格阶梯。",
    rationale: "当前样本没有单一价差主导整体跨度，用户可在多个价格层级之间连续比较。",
  };
};

const buildRecommendedPosition = (
  recommendedRange: PriceRange | null,
  currencySymbol: string,
  observedLow: number,
  observedHigh: number,
  bands: ObservedPriceBand[],
): PriceMarketStructure["recommendedRangePosition"] => {
  const boundary = "建议价格所处位置只说明它与已观察公开报价的相对关系，不证明用户愿付、毛利成立或目标 SKU 可以正式定价。";
  if (!recommendedRange) {
    return {
      status: "unavailable",
      label: "建议价格未结构化",
      low: null,
      high: null,
      overlapBandKeys: [],
      conclusion: "当前没有可比较的结构化建议价格区间。",
      boundary,
    };
  }
  if (recommendedRange.currencySymbol !== currencySymbol) {
    return {
      status: "currency_mismatch",
      label: "币种不可直接比较",
      low: recommendedRange.low,
      high: recommendedRange.high,
      overlapBandKeys: [],
      conclusion: "建议价格与主要公开报价币种不同，未进行汇率换算。",
      boundary,
    };
  }
  if (recommendedRange.high < observedLow) {
    return {
      status: "below_observed",
      label: "低于已观察区间",
      low: recommendedRange.low,
      high: recommendedRange.high,
      overlapBandKeys: [],
      conclusion: "建议区间整体低于当前样本的最低公开报价。",
      boundary,
    };
  }
  if (recommendedRange.low > observedHigh) {
    return {
      status: "above_observed",
      label: "高于已观察区间",
      low: recommendedRange.low,
      high: recommendedRange.high,
      overlapBandKeys: [],
      conclusion: "建议区间整体高于当前样本的最高公开报价。",
      boundary,
    };
  }
  const overlapBandKeys = bands
    .filter((band) => recommendedRange.low <= band.observedHigh && recommendedRange.high >= band.observedLow)
    .map((band) => band.key);
  if (overlapBandKeys.length === 1) {
    const key = overlapBandKeys[0];
    return {
      status: key,
      label: bandLabels[key],
      low: recommendedRange.low,
      high: recommendedRange.high,
      overlapBandKeys,
      conclusion: `建议价格主要落在当前样本的${bandLabels[key]}。`,
      boundary,
    };
  }
  return {
    status: "spans_multiple",
    label: "跨越多个价格带",
    low: recommendedRange.low,
    high: recommendedRange.high,
    overlapBandKeys,
    conclusion: overlapBandKeys.length > 0
      ? `建议价格横跨 ${overlapBandKeys.map((key) => bandLabels[key]).join("、")}，需要进一步收窄目标成交价。`
      : "建议价格落在已观察报价的空档内，空档不等于市场机会。",
    boundary,
  };
};

export const buildPriceMarketStructure = ({
  runId,
  product,
  market,
  generatedAt,
  offers: rawOffers,
  recommendedRange,
}: BuildPriceMarketStructureInput): PriceMarketStructure | null => {
  const normalizedOffers = normalizeOffers(rawOffers);
  if (normalizedOffers.length === 0) return null;

  const currencySymbol = dominantCurrency(normalizedOffers, recommendedRange);
  const offers = normalizedOffers
    .filter((offer) => offer.currencySymbol === currencySymbol)
    .sort((a, b) => a.currentPrice - b.currentPrice || a.label.localeCompare(b.label));
  if (offers.length === 0) return null;

  const prices = offers.map((offer) => offer.currentPrice);
  const distinctPrices = [...new Set(prices)].sort((a, b) => a - b);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const span = high - low;
  const gaps = distinctPrices.slice(1).map((price, index) => ({
    lowerPrice: distinctPrices[index],
    upperPrice: price,
    gap: price - distinctPrices[index],
  }));
  const gapMedian = gaps.length > 0 ? median(gaps.map((gap) => gap.gap)) : 0;
  const rawLargestGap = [...gaps].sort((a, b) => b.gap - a.gap)[0];
  const lowerOffer = rawLargestGap
    ? [...offers].reverse().find((offer) => offer.currentPrice === rawLargestGap.lowerPrice)
    : null;
  const upperOffer = rawLargestGap
    ? offers.find((offer) => offer.currentPrice === rawLargestGap.upperPrice)
    : null;
  const largestGap = rawLargestGap && lowerOffer && upperOffer && rawLargestGap.gap > 0
    ? {
      lowerOfferId: lowerOffer.id,
      upperOfferId: upperOffer.id,
      fromPrice: rawLargestGap.lowerPrice,
      toPrice: rawLargestGap.upperPrice,
      absoluteGap: round(rawLargestGap.gap),
      shareOfObservedSpan: span > 0 ? round(rawLargestGap.gap / span, 4) : 0,
      relativeToMedianGap: gapMedian > 0 ? round(rawLargestGap.gap / gapMedian, 2) : 1,
      interpretation: "这是当前公开报价样本中最大的相邻价差；它可能是定位空档，也可能只是样本覆盖不足。",
    }
    : null;

  const bands = buildBands(offers);
  const coverageStatus = distinctPrices.length >= 6
    ? "sufficient" as const
    : distinctPrices.length >= 3
      ? "partial" as const
      : "insufficient" as const;
  const discountedOffers = offers.filter((offer) => offer.listPrice !== null);
  const discountRates = discountedOffers.flatMap((offer) => offer.listPrice === null
    ? []
    : [(offer.listPrice - offer.currentPrice) / offer.listPrice]);
  const excludedCurrencyCount = normalizedOffers.length - offers.length;
  const limitations = [
    "公开报价样本不含销量权重，因此价格带占比只代表已观察商品数，不代表销售额或市场份额。",
    "促销价、库存与页面展示会变化，当前结果不是长期市场均价。",
    "未接入搜索量、BSR、GMV 或真实成交数据，不能据此判断价格带需求强弱。",
  ];
  if (excludedCurrencyCount > 0) {
    limitations.push(`另有 ${excludedCurrencyCount} 个不同币种报价未参与横向计算，系统未自动换算汇率。`);
  }
  if (coverageStatus !== "sufficient") {
    limitations.push("不同价格点不足 6 个，市场结构只能作为初步方向，不能作为完整品类地图。 ");
  }

  return priceMarketStructureSchema.parse({
    schemaVersion: "1.0",
    runId,
    product,
    market,
    generatedAt,
    currencySymbol,
    offers,
    coverage: {
      status: coverageStatus,
      label: coverageStatus === "sufficient" ? "结构可读" : coverageStatus === "partial" ? "初步结构" : "证据不足",
      totalObservationCount: normalizedOffers.length,
      usableObservationCount: offers.length,
      distinctPriceCount: distinctPrices.length,
      sourceCount: new Set(offers.map((offer) => offer.sourceId)).size,
      claimBackedCount: offers.filter((offer) => offer.sourceType === "current_run_claim").length,
      curatedBenchmarkCount: offers.filter((offer) => offer.sourceType === "curated_benchmark").length,
      excludedCurrencyCount,
      limitations,
    },
    observedRange: {
      low: round(low),
      high: round(high),
      median: round(median(prices)),
      span: round(span),
      highToLowRatio: round(high / low, 2),
      discountedOfferCount: discountedOffers.length,
      medianDiscountRate: discountRates.length > 0 ? round(median(discountRates), 4) : null,
    },
    bands,
    shape: buildShape(offers, low, high, largestGap),
    largestGap,
    recommendedRangePosition: buildRecommendedPosition(recommendedRange, currencySymbol, low, high, bands),
    decisionUse: {
      canAnswer: [
        "当前公开报价覆盖了怎样的高低区间。",
        "已观察商品在低位、主流和高位价格层分别有哪些参照。",
        "建议价格相对当前公开报价处于什么位置。",
      ],
      cannotAnswer: [
        "哪个价格带销量最大或利润最好。",
        "价格空档是否等于真实市场机会。",
        "目标 SKU 在该价格带一定能成交。",
      ],
      nextEvidence: [
        "补齐至少 6 个不同价格点，并覆盖平台款、独立站品牌与头部品牌。",
        "接入销量或排名代理指标，按成交权重重建价格结构。",
        "用正式成本和价格测试验证建议区间，而不是只参考竞品标价。",
      ],
    },
    boundary: "本模块描述的是当前已核查公开报价的结构，不是市场均价、市场份额或需求曲线；任何价格建议都不能绕过目标 SKU 的正式报价、单位经济和真实付费验证。",
  });
};

export const priceBandFor = (
  structure: PriceMarketStructure | null,
  price: number,
): ObservedPriceBand["key"] | null => {
  if (!structure || structure.bands.length === 0) return null;
  return structure.bands.find((band) => price >= band.observedLow && price <= band.observedHigh)?.key ?? null;
};
