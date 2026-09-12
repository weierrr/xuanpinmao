import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { researchPackagePath } from "../first-principles/service";
import {
  evidencePackagePaths,
  readEvidencePackage,
  writeEvidenceSources,
} from "../research/evidence-package";
import { contentHash, normalizeUrl } from "../research/source-normalizer";
import type { ResearchSource } from "../research/types";
import { vocCorpusSchema, type VocCorpus, type VocObservation } from "./types";
import { vocPaths } from "./service";

const BRIGHT_DATA_DATASET_ID = "gd_le8e811kzy4ggddlq";
const BRIGHT_DATA_API_ROOT = "https://api.brightdata.com/datasets/v3";

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const number = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = /\d+(?:\.\d+)?/.exec(value);
  return match ? Number(match[0]) : undefined;
};

const boolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const object = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const first = <T>(...values: Array<T | undefined>): T | undefined =>
  values.find((value) => value !== undefined);

export type AmazonReviewRecord = {
  asin: string;
  reviewId: string;
  reviewText: string;
  rating: number;
  reviewDate?: string;
  verifiedPurchase?: boolean;
  variation?: string;
  productUrl: string;
};

const normalizeAsin = (value: string): string => {
  const asin = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error(`Invalid Amazon ASIN: ${value}`);
  return asin;
};

export const normalizeBrightDataReview = (
  payload: unknown,
  fallbackAsin?: string,
): AmazonReviewRecord | null => {
  const row = object(payload);
  const providerAsin = first(text(row.asin), fallbackAsin ? normalizeAsin(fallbackAsin) : undefined);
  const reviewId = first(text(row.review_id), text(row.reviewId), text(row.id));
  const reviewText = first(text(row.review_text), text(row.reviewText), text(row.text), text(row.body));
  const rating = first(number(row.rating), number(row.review_rating), number(row.stars));
  if (!providerAsin || !reviewId || !reviewText || rating === undefined || rating < 1 || rating > 5) return null;

  const variationValue = first(
    text(row.product_variation),
    text(row.variation),
    text(row.variation_info),
    Array.isArray(row.variationList) ? row.variationList.map(String).join("; ") : undefined,
  );
  const productUrl = first(text(row.url), text(row.product_url)) ?? `https://www.amazon.com/dp/${providerAsin}`;
  const urlAsin = /\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i.exec(productUrl)?.[1];
  // Bright Data may expose the parent ASIN in `asin` while `url` identifies the
  // exact requested listing. Use the listing ASIN so source pages and review
  // observations retain the same canonical provenance URL.
  const asin = normalizeAsin(urlAsin ?? providerAsin);
  return {
    asin: normalizeAsin(asin),
    reviewId,
    reviewText,
    rating,
    reviewDate: first(text(row.review_date), text(row.reviewDate), text(row.date)),
    verifiedPurchase: first(
      boolean(row.verified_purchase),
      boolean(row.verifiedPurchase),
      boolean(row.verified),
    ),
    variation: variationValue,
    productUrl: normalizeUrl(productUrl),
  };
};

type FetchLike = typeof fetch;

const readJson = async (response: Response): Promise<unknown> => {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Bright Data request failed (${response.status}): ${body.slice(0, 240)}`);
  }
  return body ? JSON.parse(body) as unknown : null;
};

const snapshotIdFrom = (payload: unknown): string | undefined => {
  const row = object(payload);
  return first(text(row.snapshot_id), text(row.snapshotId), text(row.id));
};

const rowsFrom = (payload: unknown): unknown[] | undefined => {
  if (Array.isArray(payload)) return Array.from(payload) as unknown[];
  const row = object(payload);
  if (Array.isArray(row.data)) return Array.from(row.data) as unknown[];
  if (Array.isArray(row.results)) return Array.from(row.results) as unknown[];
  return undefined;
};

export const collectBrightDataAmazonReviews = async (options: {
  token: string;
  asins: string[];
  maxReviewsPerAsin: number;
  amazonDomain?: string;
  fetchImpl?: FetchLike;
  pollIntervalMs?: number;
  maxPolls?: number;
}): Promise<{ snapshotId: string; reviews: AmazonReviewRecord[]; rejectedRows: number }> => {
  const token = options.token.trim();
  if (!token) throw new Error("Missing BRIGHTDATA_API_TOKEN");
  if (!Number.isInteger(options.maxReviewsPerAsin) || options.maxReviewsPerAsin < 1 || options.maxReviewsPerAsin > 1000) {
    throw new Error("--max-reviews must be an integer between 1 and 1000");
  }
  const asins = [...new Set(options.asins.map(normalizeAsin))];
  if (asins.length === 0) throw new Error("At least one ASIN is required");
  const domain = options.amazonDomain ?? "amazon.com";
  const fetchImpl = options.fetchImpl ?? fetch;
  const triggerUrl = `${BRIGHT_DATA_API_ROOT}/trigger?dataset_id=${BRIGHT_DATA_DATASET_ID}&include_errors=true`;
  const triggerResponse = await fetchImpl(triggerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(asins.map((asin) => ({
      url: `https://www.${domain}/dp/${asin}`,
      max_reviews: options.maxReviewsPerAsin,
      variation_specific: false,
      reviews_to_not_include: [],
    }))),
  });
  const triggerPayload = await readJson(triggerResponse);
  const immediateRows = rowsFrom(triggerPayload);
  const snapshotId = snapshotIdFrom(triggerPayload) ?? "synchronous";
  let rows = immediateRows;

  for (let poll = 0; !rows && poll < (options.maxPolls ?? 90); poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs ?? 2_000));
    const response = await fetchImpl(
      `${BRIGHT_DATA_API_ROOT}/snapshot/${snapshotId}?format=json`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (response.status === 202) continue;
    rows = rowsFrom(await readJson(response));
  }
  if (!rows) throw new Error("Bright Data snapshot did not complete before the polling limit");

  const normalized = rows.map((row) => normalizeBrightDataReview(row));
  const reviews = normalized.filter((row): row is AmazonReviewRecord => row !== null);
  return {
    snapshotId,
    reviews,
    rejectedRows: normalized.length - reviews.length,
  };
};

const reviewHash = (review: AmazonReviewRecord): string =>
  createHash("sha256").update(review.reviewText.trim().toLowerCase()).digest("hex");

export const themeFor = (value: string): string => {
  const body = value.toLowerCase();
  const themes: Array<[string, RegExp]> = [
    ["compatibility and fit", /\b(fit|fits|compatible|compatibility|model|replace|replacement|install|installation|insert|housing)\b/],
    ["leaks and sealing", /\b(leak|leaking|drip|seal|o-ring|oring|gasket|water on the floor)\b/],
    ["water taste and odor", /\b(taste|tastes|odor|odour|smell|chlorine|flavor|flavour)\b/],
    ["water flow and pressure", /\b(flow|pressure|slow|stream|dispens|fill rate|trickle)\b/],
    ["filtration performance", /\b(filter|filtration|contaminant|lead|pfas|pfoa|pfos|sediment|particle|clean water|water quality)\b/],
    ["service life and replacement interval", /\b(month|months|life|lifespan|last|lasting|frequency|change indicator)\b/],
    ["certification and trust", /\b(nsf|ansi|certif|tested|oem|genuine|authentic|counterfeit)\b/],
    ["value and price", /\b(price|cost|value|expensive|cheap|affordable|money|pack)\b/],
    ["returns and service", /\b(return|refund|exchange|customer service|warranty)\b/],
  ];
  return themes.find(([, pattern]) => pattern.test(body))?.[0] ?? "overall refrigerator-filter experience";
};

const observationFromReview = (
  runId: string,
  sourceId: string,
  snapshotPath: string,
  capturedAt: string,
  review: AmazonReviewRecord,
): VocObservation => {
  const sentiment = review.rating <= 2 ? "negative" : review.rating === 3 ? "mixed" : "positive";
  const observationType = review.rating <= 2 ? "pain" : review.rating === 3 ? "objection" : "positive_evidence";
  const theme = themeFor(review.reviewText);
  const purchase = review.verifiedPurchase ? "verified-purchase " : "";
  const assessment = sentiment === "negative"
    ? "reported dissatisfaction"
    : sentiment === "mixed"
      ? "gave a mixed assessment"
      : "reported a positive experience";
  return {
    observation_id: `VOC-AMZ-${createHash("sha256").update(`${review.asin}:${review.reviewId}`).digest("hex").slice(0, 16)}`,
    research_run_id: runId,
    source_id: sourceId,
    snapshot_path: snapshotPath,
    platform: "Amazon",
    source_family: "marketplace",
    page_url: review.productUrl,
    page_title: `Amazon customer reviews for ASIN ${review.asin}`,
    captured_at: capturedAt,
    observation_type: observationType,
    sentiment,
    theme,
    paraphrase: `An Amazon ${purchase}reviewer ${assessment} related to ${theme}.`,
    quote_excerpt: null,
    product_scope: "competitor_product",
    variant_match: "not_applicable",
    firsthand_status: review.verifiedPurchase ? "explicit" : "likely",
    rating: { value: review.rating, scale_max: 5, platform: "Amazon" },
    privacy_reviewed: true,
    copyright_reviewed: true,
  };
};

const sourceNumber = (sources: ResearchSource[]): number =>
  sources.reduce((max, source) => {
    const match = /(\d+)$/.exec(source.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

const snapshotMarkdown = (
  sourceId: string,
  asin: string,
  capturedAt: string,
  providerSnapshotId: string,
  reviews: AmazonReviewRecord[],
): string => `# ${sourceId} Amazon Review Evidence Snapshot

- ASIN: ${asin}
- URL: https://www.amazon.com/dp/${asin}
- Platform: Amazon
- Source family: marketplace
- Capture method: Bright Data Amazon Reviews API
- Provider snapshot: ${providerSnapshotId}
- Captured at: ${capturedAt}
- Review records accepted: ${reviews.length}
- Privacy: reviewer names, profiles, avatars and account identifiers were discarded
- Copyright: full review bodies were processed in memory and were not retained

## Review audit index

${reviews.map((review) => [
    `- review_id: ${review.reviewId}`,
    `rating: ${review.rating}/5`,
    `verified: ${review.verifiedPurchase ?? "unknown"}`,
    `published: ${review.reviewDate ?? "unknown"}`,
    `variation: ${review.variation ?? "unknown"}`,
    `content_sha256: ${reviewHash(review)}`,
  ].join("; ")).join("\n")}
`;

export const appendAmazonReviewsToVocRun = async (options: {
  runId: string;
  reviews: AmazonReviewRecord[];
  providerSnapshotId: string;
  capturedAt?: string;
}): Promise<{
  accepted: number;
  duplicates: number;
  sourceCount: number;
  totalObservations: number;
  corpusFile: string;
}> => {
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  const packagePath = researchPackagePath(options.runId);
  const evidence = await readEvidencePackage(packagePath);
  const corpusPath = vocPaths(options.runId).corpus;
  const corpus: VocCorpus = vocCorpusSchema.parse(JSON.parse(await readFile(corpusPath, "utf8")));
  const existingObservationIds = new Set(corpus.observations.map((item) => item.observation_id));
  const seenReviewKeys = new Set<string>();
  const seenHashes = new Set<string>();
  const grouped = new Map<string, AmazonReviewRecord[]>();
  let duplicates = 0;

  for (const review of options.reviews) {
    const key = `${review.asin}:${review.reviewId}`;
    const hash = reviewHash(review);
    const observationId = `VOC-AMZ-${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
    if (existingObservationIds.has(observationId) || seenReviewKeys.has(key) || seenHashes.has(hash)) {
      duplicates += 1;
      continue;
    }
    seenReviewKeys.add(key);
    seenHashes.add(hash);
    grouped.set(review.asin, [...(grouped.get(review.asin) ?? []), review]);
  }

  const sources = [...evidence.sources];
  let nextSourceNumber = sourceNumber(sources) + 1;
  const newObservations: VocObservation[] = [];
  for (const [asin, reviews] of grouped) {
    const url = `https://www.amazon.com/dp/${asin}`;
    const existingSource = sources.find((source) => normalizeUrl(source.url) === normalizeUrl(url));
    const sourceId = existingSource?.id ?? `SRC-VOC-${String(nextSourceNumber++).padStart(3, "0")}`;
    const snapshotPath = existingSource?.snapshotPath ?? `source_snapshots/${sourceId}.md`;
    const snapshot = snapshotMarkdown(sourceId, asin, capturedAt, options.providerSnapshotId, reviews);
    await mkdir(evidencePackagePaths(packagePath).snapshots, { recursive: true });
    await writeFile(path.join(packagePath, snapshotPath), snapshot, "utf8");

    const source: ResearchSource = {
      id: sourceId,
      url,
      title: `Amazon customer reviews for ASIN ${asin}`,
      sourceType: "market",
      retrievedAt: capturedAt,
      targetEntity: `Amazon ASIN ${asin}`,
      targetMarket: evidence.researchInput.targetMarket,
      targetSku: asin,
      accessMethod: "api",
      accessStatus: "accessible",
      evidenceStatus: "verified",
      snapshotPath,
      contentHash: contentHash(snapshot),
      notes: "Structured public review records supplied by Bright Data; personal identifiers and full review bodies were not retained.",
    };
    if (existingSource) {
      sources[sources.indexOf(existingSource)] = source;
    } else {
      sources.push(source);
    }

    const existingPageIndex = corpus.source_pages.findIndex((page) => page.source_id === sourceId);
    const page = {
      source_id: sourceId,
      url,
      title: source.title,
      platform: "Amazon",
      source_family: "marketplace" as const,
      captured_at: capturedAt,
      access_status: "accessible" as const,
      snapshot_path: snapshotPath,
      product_scope: "competitor_product" as const,
      access_notes: "Collected through Bright Data Amazon Reviews API; full bodies were processed transiently and discarded.",
    };
    if (existingPageIndex >= 0) corpus.source_pages[existingPageIndex] = page;
    else corpus.source_pages.push(page);
    newObservations.push(...reviews.map((review) =>
      observationFromReview(options.runId, sourceId, snapshotPath, capturedAt, review)));
  }

  corpus.observations.push(...newObservations);
  corpus.generated_at = capturedAt;
  corpus.amazon_comment_level_evidence = corpus.observations.some((item) => item.platform === "Amazon");
  corpus.limitations = [
    ...corpus.limitations.filter((item) => !item.toLowerCase().includes("amazon")),
    "Amazon evidence is a bounded third-party-provider sample and is not representative of all purchasers.",
    "Amazon review bodies were processed transiently; seller-facing artifacts retain paraphrases, ratings and audit hashes rather than full copyrighted text.",
  ];
  const parsedCorpus = vocCorpusSchema.parse(corpus);
  await Promise.all([
    writeEvidenceSources(packagePath, sources),
    writeFile(corpusPath, `${JSON.stringify(parsedCorpus, null, 2)}\n`, "utf8"),
  ]);
  return {
    accepted: newObservations.length,
    duplicates,
    sourceCount: grouped.size,
    totalObservations: parsedCorpus.observations.length,
    corpusFile: corpusPath,
  };
};

export const collectAndAppendBrightDataAmazonVoc = async (options: {
  runId: string;
  token: string;
  asins: string[];
  maxReviewsPerAsin: number;
  amazonDomain?: string;
  fetchImpl?: FetchLike;
  pollIntervalMs?: number;
  maxPolls?: number;
}) => {
  const collected = await collectBrightDataAmazonReviews(options);
  const appended = await appendAmazonReviewsToVocRun({
    runId: options.runId,
    reviews: collected.reviews,
    providerSnapshotId: collected.snapshotId,
  });
  return {
    status: "collected",
    provider: "brightdata",
    providerSnapshotId: collected.snapshotId,
    received: collected.reviews.length,
    rejectedRows: collected.rejectedRows,
    ...appended,
  };
};
