import type { CompetitorAdvertisingAudit } from "../report/competitor-advertising-audit";
import type { PriceMarketStructure } from "../market-structure/types";
import {
  candidateVerificationWorkspaceSchema,
  type CandidateVerificationWorkspace,
} from "./types";

type BuildCandidateVerificationWorkspaceInput = {
  runId: string;
  direction: string;
  productConcept: string;
  mustHave: string[];
  priceMarketStructure: PriceMarketStructure | null;
  advertisingAudit: CompetitorAdvertisingAudit | null;
};

const inputLabels = {
  "1688_link": "1688 商品链接",
  "amazon_link": "Amazon 商品链接",
  "supplier_link": "工厂或独立站链接",
  "product_image": "商品图片",
  "supplier_spec": "供应商规格表",
} as const;

export const candidateInputLabel = (input: keyof typeof inputLabels): string => inputLabels[input];

export const buildCandidateVerificationWorkspace = ({
  runId,
  direction,
  productConcept,
  mustHave,
  priceMarketStructure,
  advertisingAudit,
}: BuildCandidateVerificationWorkspaceInput): CandidateVerificationWorkspace => {
  const offerCount = priceMarketStructure?.coverage.usableObservationCount ?? 0;
  const referenceSources = advertisingAudit?.hooks.flatMap((hook) => hook.sources.map((source, index) => ({
    id: `${hook.competitor.toLowerCase()}-${index + 1}`,
    sourceType: source.url.includes("trustpilot") ? "review" as const : "product_page" as const,
    platform: source.url.includes("trustpilot") ? "Trustpilot" : hook.competitor,
    title: source.label,
    url: source.url,
    status: hook.level === "已核实" ? "verified" as const : "directional" as const,
    statusLabel: hook.level,
    use: `理解“${hook.hook}”如何承接到商品页，不直接复制其功效声明。`,
    boundary: hook.risk,
  }))) ?? [];
  const references = advertisingAudit
    ? [
      ...referenceSources,
      {
        id: "meta-ad-library",
        sourceType: "ad_library" as const,
        platform: "Meta",
        title: "重新核查当前广告素材",
        url: advertisingAudit.metaLibraryUrl,
        status: "blocked" as const,
        statusLabel: "本次获取受阻",
        use: "用于确认竞品当前是否仍在投放、素材数量和实际广告表达。",
        boundary: advertisingAudit.metaAccessNote,
      },
    ]
    : [];

  return candidateVerificationWorkspaceSchema.parse({
    schemaVersion: "1.0",
    runId,
    status: "awaiting_candidate",
    statusLabel: "等待候选商品",
    targetDefinition: {
      direction,
      productConcept,
      mustHave: mustHave.slice(0, 8),
    },
    acceptedInputs: ["1688_link", "amazon_link", "supplier_link", "product_image", "supplier_spec"],
    submissionPrompt: "提交一个候选商品链接、商品图片或供应商规格表，系统将继续核验具体变体、同款程度、价格与缺失参数。",
    candidate: null,
    variantFacts: [],
    matchAssessment: null,
    matchRules: [
      {
        level: "exact",
        label: "目标同款",
        definition: "关键结构、材料、功能、尺码与目标变体均一致，并能逐项核对来源。",
        priceUse: "可以作为直接报价候选，但仍需加入运费、MOQ、包装和质量条件。",
      },
      {
        level: "near",
        label: "高度近似",
        definition: "核心功能与结构接近，但材料、变体、尺码或局部做法存在差异。",
        priceUse: "只能作为价格和实现方式参照，不能当作目标款正式成本。",
      },
      {
        level: "adjacent",
        label: "相邻替代",
        definition: "解决相似用户任务，但产品结构或主要体验与目标方向不同。",
        priceUse: "只能用于理解替代方案与价格锚点，不能进入同款比价。",
      },
      {
        level: "mismatch",
        label: "不匹配",
        definition: "产品、变体或关键能力与目标方向冲突，继续比较会误导决策。",
        priceUse: "不得用于定价、成本或供应可行性判断。",
      },
    ],
    evidenceModules: [
      {
        key: "product_identity",
        label: "商品识别",
        status: "unverified",
        statusLabel: "尚未核验",
        conclusion: "当前没有具体候选商品，无法确认品牌、供应商、链接或目标款。",
        reason: "研究结论定义了要找什么，但还没有收到真实商品输入。",
        nextVerification: "提交一个商品链接、图片或规格表，锁定具体商品身份。",
      },
      {
        key: "variant_applicability",
        label: "变体事实",
        status: "unverified",
        statusLabel: "尚未核验",
        conclusion: "颜色、尺码、材料和功能是否适用于同一变体尚不清楚。",
        reason: "不同变体可能共享页面标题，却不共享夜光、防透、面料或尺寸能力。",
        nextVerification: "逐条绑定“事实—适用变体—证据位置”，禁止跨变体继承卖点。",
      },
      {
        key: "comparable_price",
        label: "可比价格",
        status: offerCount > 0 ? "directional" : "unverified",
        statusLabel: offerCount > 0 ? "已有近似参照" : "尚未取得",
        conclusion: offerCount > 0
          ? `已有 ${offerCount} 个公开报价点，但尚未确认与候选商品的 Exact/Near 关系。`
          : "当前没有可复核的公开报价点。",
        reason: "竞品公开售价不包含目标采购、运费、MOQ、包装、退货与获客成本。",
        nextVerification: "先完成商品匹配分级，再比较商品价、运费、变体、库存和总落地条件。",
      },
      {
        key: "supply_terms",
        label: "供应条件",
        status: "unverified",
        statusLabel: "尚未取得",
        conclusion: "正式供应商、MOQ、交期、报价和可调整规格均未确认。",
        reason: "当前供应拆解只定义了需要实现的能力，不等于已有工厂能稳定交付。",
        nextVerification: "向至少两家供应商索取同口径规格、报价、MOQ、样品费和交期。",
      },
      {
        key: "target_performance",
        label: "目标样品表现",
        status: "unverified",
        statusLabel: "尚未实测",
        conclusion: "视觉平滑、防透、舒适和多体型表现尚未在目标样裤上证明。",
        reason: "竞品页面、用户反馈和产品构想不能替代目标样品测试。",
        nextVerification: "完成同光线盲测、深蹲防透、穿着舒适和洗后回弹测试。",
      },
      {
        key: "content_reference",
        label: "内容参考",
        status: references.length > 0 ? "directional" : "unverified",
        statusLabel: references.length > 0 ? "可借鉴结构" : "尚未整理",
        conclusion: references.length > 0
          ? `已有 ${references.length} 条竞品页面、评论或广告库入口可用于拆解表达结构。`
          : "当前没有可复核的内容参考。",
        reason: "参考内容只能说明表达方式，播放量、投放表现与真实成交仍需独立数据。",
        nextVerification: "记录素材日期、平台、可借鉴结构和不可照搬的声明，再转译为验证脚本。",
      },
    ],
    actionLanes: {
      canDo: [
        "按寻源关键词搜索并联系供应商。",
        "索取商品链接、实拍、规格表、报价和样品条件。",
        "把候选商品提交回来做逐款核验。",
      ],
      mustConfirm: [
        "当前选择的具体颜色、尺码和材料变体。",
        "功能是否适用于该变体，而不是页面里的其他款。",
        "商品价、运费、MOQ、样品费、包装和交期。",
        "防透、视觉平滑、舒适和洗后表现。",
      ],
      cannotDo: [
        "把其他变体的功能自动继承给当前变体。",
        "把近似竞品价格当成目标款正式售价或采购成本。",
        "在目标样品未通过前备货、上架或投放广告。",
      ],
    },
    references,
    boundary: "候选商品核验工作区只负责把具体链接、变体、价格和证据与既定产品方向对齐；未提交候选商品时只展示核验规则，不生成虚假的商品识别或匹配结论。",
  });
};
