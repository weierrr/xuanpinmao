export type AdvertisingEvidenceLevel = "已核实" | "间接核实" | "待复核";

export type AdvertisingHook = {
  competitor: string;
  level: AdvertisingEvidenceLevel;
  hook: string;
  whyItWorks: string;
  landingPageHandoff: string;
  risk: string;
  sources: Array<{ label: string; url: string }>;
};

export type CompetitorAdvertisingAudit = {
  asOf: string;
  auditRunId: string;
  metaLibraryUrl: string;
  metaAccessNote: string;
  reconciliation: {
    headline: string;
    summary: string;
    stages: Array<{
      label: string;
      conclusion: string;
      evidenceScope: string;
    }>;
    legacyAdjustment: string;
  };
  hooks: AdvertisingHook[];
};

const composedReportRunId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

const audit: CompetitorAdvertisingAudit = {
  asOf: "2026-08-02",
  auditRunId: "research-run-3d-yoga-pants-29982a674557-us",
  metaLibraryUrl:
    "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=Ionix%20Labs&search_type=keyword_unordered",
  metaAccessNote:
    "本次无法稳定读取 Meta 广告资料库，因此不能确认 Ionix 当前是否仍在投放、投放了多少素材或哪条素材表现最好。",
  reconciliation: {
    headline: "先分清：什么让用户点进来，什么让用户最终下单",
    summary:
      "最新补充调研更新的是广告入口；过去积累的商品页、评论和用户反馈继续用于解释落地页承接与购买阻力，不能再把三者并列成同一种“畅销原因”。",
    stages: [
      {
        label: "让用户点进来",
        conclusion: "Ionix 用橘皮与外观焦虑切入；Silix 用循环、炎症和身体不适切入。它们属于不同竞品，不能合并成同一品牌结论。",
        evidenceScope: "最新补充调研；广告原件仍待复核",
      },
      {
        label: "让用户相信",
        conclusion: "商品页用即时平滑、自然塑形和更轻盈的视觉或体感承接广告承诺，再通过用户故事和效果表达建立信任。",
        evidenceScope: "商品页与历史用户证据",
      },
      {
        label: "让用户敢下单",
        conclusion: "不透、尺码、舒适、退款保证、折扣和免邮主要用于降低风险与犹豫，不再作为广告入口的核心结论。",
        evidenceScope: "历史商品页、评论与交易机制证据",
      },
    ],
    legacyAdjustment:
      "旧版“竞品靠塑形、不透、尺码和退款卖出”的表述已调整：塑形属于承诺兑现，不透与尺码属于证明，退款和折扣属于风险逆转；最新广告入口结论以上述分品牌抓手为准。",
  },
  hooks: [
    {
      competitor: "Ionix",
      level: "待复核",
      hook: "Facebook 广告用“去橘皮”切入外观焦虑",
      whyItWorks:
        "它把一条普通塑形裤变成解决具体外观困扰的方案，比“舒适、显瘦”更容易让目标用户停下来。",
      landingPageHandoff:
        "商品页继续强调穿上即刻更平滑、双腿更轻盈和塑形效果，再用用户故事、前后效果表达与 90 天退款承诺降低犹豫。",
      risk:
        "“去橘皮”这一广告原件尚未独立取得；落地页只能证明商家使用了相关卖点，不能反推具体广告素材或投放效果。",
      sources: [
        {
          label: "查看 Ionix 商品页",
          url: "https://getionix.com/products/3d-sculpting-anti-cellulite-leggings-instant-lift-smooth",
        },
      ],
    },
    {
      competitor: "Silix",
      level: "间接核实",
      hook: "广告用“促进淋巴流动、减轻炎症”吸引身体不适与塑形人群",
      whyItWorks:
        "它同时触发外观改善和身体舒适两类需求，比单纯展示裤型更像一个值得点击的问题解决方案。",
      landingPageHandoff:
        "商品页用“对抗橘皮”“塑腿提臀”“改善循环”等更激进的表达承接，并叠加折扣、效果图和退款保证推动成交。",
      risk:
        "广告入口来自独立评论者的消费经历，不等同于广告素材原件；循环、炎症和橘皮功效都属于高风险表达，不能直接照搬。",
      sources: [
        {
          label: "查看独立评论记录",
          url: "https://www.trustpilot.com/review/silixwear.com?page=3",
        },
        {
          label: "查看 Silix 商品页",
          url: "https://silixwear.com/products/3d-anti-cellulite-legging",
        },
      ],
    },
  ],
};

export const competitorAdvertisingAuditFor = (
  runId: string,
): CompetitorAdvertisingAudit | null => (runId === composedReportRunId ? audit : null);
