import { createHash } from "node:crypto";
import { researchSourceSchema, type ResearchSource } from "./types";

const trackingParams = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_",
  "spm",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

export const normalizeUrl = (url: string): string => {
  const parsed = new URL(url);
  parsed.hash = "";
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  for (const key of [...parsed.searchParams.keys()]) {
    if (trackingParams.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();
  return parsed.toString();
};

export const contentHash = (content: string): string => createHash("sha256").update(content).digest("hex");

export const normalizeResearchSource = (source: ResearchSource, fallbackRetrievedAt = new Date()): ResearchSource => {
  const withDefaults: ResearchSource = {
    ...source,
    retrievedAt: source.retrievedAt || fallbackRetrievedAt.toISOString(),
    targetMarket: source.targetMarket?.trim() ?? undefined,
    targetSku: source.targetSku?.trim() ?? undefined,
    url: normalizeUrl(source.url),
    contentHash: source.contentHash ?? (source.contentSnapshot ? contentHash(source.contentSnapshot) : undefined),
  };
  return researchSourceSchema.parse(withDefaults);
};

export const dedupeResearchSources = (
  sources: ResearchSource[],
): { sources: ResearchSource[]; duplicateUrls: string[]; errors: Array<{ sourceId?: string; message: string }> } => {
  const seen = new Set<string>();
  const deduped: ResearchSource[] = [];
  const duplicateUrls: string[] = [];
  const errors: Array<{ sourceId?: string; message: string }> = [];

  for (const source of sources) {
    try {
      const normalized = normalizeResearchSource(source);
      if (seen.has(normalized.url)) {
        duplicateUrls.push(normalized.url);
        continue;
      }
      seen.add(normalized.url);
      deduped.push(normalized);
    } catch (error) {
      errors.push({
        sourceId: source.id,
        message: error instanceof Error ? error.message : "invalid source",
      });
    }
  }

  return { sources: deduped, duplicateUrls, errors };
};

