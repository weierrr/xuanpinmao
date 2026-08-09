"use server";

import { redirect } from "next/navigation";
import { writeOpportunityDiscoveryPlan } from "@/opportunity-discovery/service";
import { initializeResearchWhiteboard } from "@/research-whiteboard/service";

const textValue = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const parseWebUrls = (value: string): string[] => [...new Set(
  value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      try {
        const url = new URL(item);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }),
)];

export async function confirmDiscoveryPlan(formData: FormData) {
  const categoryInput = textValue(formData, "category");
  const imageUrls = parseWebUrls(textValue(formData, "imageUrls"));
  const competitorUrls = parseWebUrls(textValue(formData, "competitorUrls"));
  const categoryKeyword = categoryInput
    || (competitorUrls.length > 0 ? "待从商品链接识别的商品方向" : "待从商品图片识别的商品方向");

  const result = await writeOpportunityDiscoveryPlan({
    categoryKeyword,
    targetMarket: textValue(formData, "market") || "US",
    targetAudience: textValue(formData, "audience") || undefined,
    salesChannel: textValue(formData, "channel") || undefined,
    imageUrls,
    competitorUrls,
    referenceUrls: [],
  });

  await initializeResearchWhiteboard(result.plan);

  redirect(`/discover/plan/whiteboard?discoveryId=${encodeURIComponent(result.plan.discoveryId)}`);
}
