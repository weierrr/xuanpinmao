import type { OpportunityDiscoveryPlan } from "@/opportunity-discovery/types";
import type { ResearchRunnerInput } from "./research-runner";

type LiveResearchOverrides = Pick<ResearchRunnerInput, "description" | "currency"> &
  Partial<Pick<ResearchRunnerInput,
    | "budget"
    | "availableTime"
    | "teamSize"
    | "currentSupplierResources"
    | "currentChannelAssets"
    | "currentContentAssets"
    | "acceptableMoq"
    | "targetMargin"
    | "unacceptableRisks"
    | "preferredBusinessModel"
    | "validationGoal"
  >>;

/** Convert the saved page confirmation into a live-run input without requiring optional URL clues. */
export const liveResearchInputFromDiscovery = (
  plan: OpportunityDiscoveryPlan,
  overrides: LiveResearchOverrides,
): ResearchRunnerInput => ({
  mode: "live",
  productName: plan.categoryKeyword,
  targetMarket: plan.targetMarket,
  targetAudience: plan.targetAudience,
  imagePaths: plan.imageUrls,
  competitors: plan.competitorUrls.length > 0
    ? plan.competitorUrls
    : plan.referenceUrls.filter((url) => !plan.imageUrls.includes(url)),
  ...overrides,
});
