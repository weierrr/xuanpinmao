import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  opportunityDiscoveryInputSchema,
  opportunityDiscoveryPlanSchema,
  type OpportunityDiscoveryInput,
  type OpportunityDiscoveryPlan,
} from "./types";

const safeSlug = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "category";

export const createOpportunityDiscoveryPlan = (
  input: OpportunityDiscoveryInput,
  now = new Date(),
): OpportunityDiscoveryPlan => {
  const parsed = opportunityDiscoveryInputSchema.parse(input);
  const referenceUrls = [...new Set([
    ...parsed.referenceUrls,
    ...parsed.imageUrls,
    ...parsed.competitorUrls,
  ])];
  const normalizedInput = { ...parsed, referenceUrls };
  const hash = createHash("sha256").update(JSON.stringify(normalizedInput)).digest("hex").slice(0, 12);
  const discoveryId = `discovery-${safeSlug(parsed.categoryKeyword).slice(0, 48)}-${hash}-${safeSlug(parsed.targetMarket)}`;
  const category = parsed.categoryKeyword;
  const market = parsed.targetMarket;

  return opportunityDiscoveryPlanSchema.parse({
    schemaVersion: "1.0",
    discoveryId,
    mode: "CATEGORY_OPPORTUNITY_DISCOVERY",
    ...normalizedInput,
    coverageTargets: {
      minimumBrands: 10,
      minimumAsins: 20,
      maximumAsins: 50,
      minimumValidReviews: 500,
      minimumRedditThreads: 20,
      minimumPriceBands: 3,
    },
    queryGroups: {
      amazonCategoryDiscovery: [
        `Amazon ${market} ${category} best sellers`,
        `Amazon ${market} ${category} new releases`,
        `${category} Amazon one star reviews`,
        `${category} Amazon sizing material style comparison`,
      ],
      redditDemandDiscovery: [
        `site:reddit.com ${category} problems`,
        `site:reddit.com ${category} recommendations`,
        `site:reddit.com ${category} alternatives`,
        `site:reddit.com ${category} wish existed`,
      ],
      independentReviewDiscovery: [
        `${category} Trustpilot reviews`,
        `${category} independent review complaints`,
        `${category} brand reviews durability sizing`,
      ],
      alternativeAndWorkaroundDiscovery: [
        `${category} workaround`,
        `${category} substitute product`,
        `${category} what do you use instead`,
      ],
    },
    stages: [
      { code: "CATEGORY_MAP", title: "建立品类地图", output: "品牌、ASIN、价格带、款式与结构分类" },
      { code: "VOC_COLLECTION", title: "收集用户之声", output: "亚马逊、Reddit、独立评论平台的有界评论语料" },
      { code: "NEED_CLUSTERING", title: "聚类未满足需求", output: "痛点、期望结果、替代方案与反证" },
      { code: "SATURATION_CHECK", title: "判断满足度与饱和度", output: "现有产品覆盖、同质化和差异化空白" },
      { code: "CONCEPT_GENERATION", title: "生成候选商品概念", output: "3–5 个有证据边界的候选方向" },
      { code: "RESEARCH_HANDOFF", title: "创建独立尽调任务", output: "优先方向的新 Research Run 输入" },
    ],
    decisionGuardrails: [
      "评论数量和搜索排名不能单独证明市场机会。",
      "非互斥痛点不能用饼图表示为总体占比。",
      "推断出的相邻商品只能保持研究假设状态。",
      "每个候选方向必须同时展示反证、替代方案和证据缺口。",
      "没有独立 Research Run，不得给出买样、上架或广告测试结论。",
    ],
    createdAt: now.toISOString(),
  });
};

export const opportunityDiscoveryPaths = (discoveryId: string) => {
  const root = path.join(process.cwd(), "output", "discovery", discoveryId);
  return {
    root,
    plan: path.join(root, "discovery-plan.json"),
    task: path.join(root, "CODEX_RESEARCH_TASK.md"),
  };
};

export const opportunityDiscoveryTaskMarkdown = (plan: OpportunityDiscoveryPlan): string => `# 品类机会发现任务

## 输入

- 品类关键词：${plan.categoryKeyword}
- 目标市场：${plan.targetMarket}
- 目标渠道：${plan.salesChannel ?? "待确认"}
- 目标人群：${plan.targetAudience ?? "待研究"}
- 商品图片：${plan.imageUrls.length > 0 ? plan.imageUrls.join("；") : "无"}
- 竞品链接：${plan.competitorUrls.length > 0 ? plan.competitorUrls.join("；") : "无"}
- 全部参考网址：${plan.referenceUrls.length > 0 ? plan.referenceUrls.join("；") : "无"}

## 覆盖目标

- 品牌不少于 ${plan.coverageTargets.minimumBrands} 个
- ASIN ${plan.coverageTargets.minimumAsins}–${plan.coverageTargets.maximumAsins} 个
- 有效评论不少于 ${plan.coverageTargets.minimumValidReviews} 条
- Reddit 讨论不少于 ${plan.coverageTargets.minimumRedditThreads} 个
- 至少覆盖 ${plan.coverageTargets.minimumPriceBands} 个价格带

## 执行阶段

${plan.stages.map((stage, index) => `${index + 1}. ${stage.title}：${stage.output}`).join("\n")}

## 决策边界

${plan.decisionGuardrails.map((item) => `- ${item}`).join("\n")}
`;

export const writeOpportunityDiscoveryPlan = async (input: OpportunityDiscoveryInput) => {
  const plan = createOpportunityDiscoveryPlan(input);
  const paths = opportunityDiscoveryPaths(plan.discoveryId);
  await mkdir(paths.root, { recursive: true });
  await Promise.all([
    writeFile(paths.plan, `${JSON.stringify(plan, null, 2)}\n`, "utf8"),
    writeFile(paths.task, opportunityDiscoveryTaskMarkdown(plan), "utf8"),
  ]);
  return { status: "planned", plan, paths };
};
