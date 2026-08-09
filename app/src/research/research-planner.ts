import { createHash } from "node:crypto";
import { researchInputSchema, researchPlanSchema, type ResearchInput, type ResearchPlan } from "./types";

const compactUnique = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
const safeSlug = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const regulatoryDomainsByMarket: Record<string, string[]> = {
  US: ["cpsc.gov", "ftc.gov", "fda.gov"],
  EU: ["europa.eu", "ec.europa.eu"],
  UK: ["gov.uk"],
  CA: ["canada.ca"],
  AU: ["productsafety.gov.au", "accc.gov.au"],
  JP: ["go.jp"],
};

export const defaultCurrencyByMarket: Record<string, string> = {
  US: "USD",
  EU: "EUR",
  UK: "GBP",
  CA: "CAD",
  AU: "AUD",
  JP: "JPY",
};

const normalizedInput = (input: ResearchInput): Required<Pick<ResearchInput, "productName" | "targetMarket">> &
  Omit<ResearchInput, "productName" | "targetMarket"> => {
  const parsed = researchInputSchema.parse(input);
  return {
    productName: parsed.productName.trim(),
    targetMarket: parsed.targetMarket.trim().toUpperCase(),
    description: parsed.description?.trim(),
    imagePaths: parsed.imagePaths?.map((item) => item.trim()).filter(Boolean).sort(),
    currency: parsed.currency?.trim().toUpperCase() ?? defaultCurrencyByMarket[parsed.targetMarket.trim().toUpperCase()],
    competitors: parsed.competitors?.map((item) => item.trim()).filter(Boolean).sort(),
    targetAudience: parsed.targetAudience?.trim(),
    budget: parsed.budget?.trim(),
    availableTime: parsed.availableTime?.trim(),
    teamSize: parsed.teamSize,
    currentSupplierResources: parsed.currentSupplierResources?.map((item) => item.trim()).filter(Boolean).sort(),
    currentChannelAssets: parsed.currentChannelAssets?.map((item) => item.trim()).filter(Boolean).sort(),
    currentContentAssets: parsed.currentContentAssets?.map((item) => item.trim()).filter(Boolean).sort(),
    acceptableMoq: parsed.acceptableMoq?.trim(),
    targetMargin: parsed.targetMargin?.trim(),
    unacceptableRisks: parsed.unacceptableRisks?.map((item) => item.trim()).filter(Boolean).sort(),
    preferredBusinessModel: parsed.preferredBusinessModel?.trim(),
    validationGoal: parsed.validationGoal?.trim(),
  };
};

export const createResearchInputHash = (input: ResearchInput): string =>
  createHash("sha256").update(JSON.stringify(normalizedInput(input))).digest("hex");

export const createResearchRunId = (input: ResearchInput): string => {
  const normalized = normalizedInput(input);
  const productSlug = safeSlug(normalized.productName).slice(0, 48) || "product";
  const marketSlug = safeSlug(normalized.targetMarket).slice(0, 12) || "market";
  const hash = createResearchInputHash(input).slice(0, 12);
  return `research-run-${productSlug}-${hash}-${marketSlug}`;
};

const regulatoryQueries = (product: string, market: string): string[] => {
  const domains = regulatoryDomainsByMarket[market] ?? [];
  if (domains.length === 0) {
    return compactUnique([
      `${market} ${product} product regulations official`,
      `${market} ${product} labeling requirements government`,
      `${market} ${product} product safety official`,
    ]);
  }

  const [primaryDomain, secondaryDomain] = domains;
  return compactUnique([
    `${market} ${product} product regulations official`,
    primaryDomain ? `site:${primaryDomain} ${product} product safety` : "",
    secondaryDomain ? `site:${secondaryDomain} ${product} labeling requirements` : `${market} ${product} labeling requirements official`,
  ]);
};

export const createResearchPlan = (input: ResearchInput, now = new Date()): ResearchPlan => {
  const parsed = normalizedInput(input);
  const product = parsed.productName;
  const market = parsed.targetMarket;

  const plan: ResearchPlan = {
    researchRunId: createResearchRunId(parsed),
    inputHash: createResearchInputHash(parsed),
    productName: product,
    targetMarket: market,
    description: parsed.description,
    imagePaths: parsed.imagePaths,
    currency: parsed.currency,
    competitors: parsed.competitors,
    targetAudience: parsed.targetAudience,
    budget: parsed.budget,
    availableTime: parsed.availableTime,
    teamSize: parsed.teamSize,
    currentSupplierResources: parsed.currentSupplierResources,
    currentChannelAssets: parsed.currentChannelAssets,
    currentContentAssets: parsed.currentContentAssets,
    acceptableMoq: parsed.acceptableMoq,
    targetMargin: parsed.targetMargin,
    unacceptableRisks: parsed.unacceptableRisks,
    preferredBusinessModel: parsed.preferredBusinessModel,
    validationGoal: parsed.validationGoal,
    competitorQueries: compactUnique([
      ...(parsed.competitors ?? []).map((url) => `site:${new URL(url).hostname} ${product}`),
      `${product} best seller ${market}`,
      `${product} brand ${market}`,
      `${product} reviews ${market}`,
    ]).slice(0, 4),
    supplierQueries: compactUnique([
      `${product} Alibaba supplier`,
      `${product} manufacturer ${market}`,
      `${product} wholesale supplier`,
    ]),
    regulationQueries: regulatoryQueries(product, market),
    createdAt: now.toISOString(),
  };

  return researchPlanSchema.parse(plan);
};
