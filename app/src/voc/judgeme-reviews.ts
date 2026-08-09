import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { researchPackagePath } from "../first-principles/service";
import {
  evidencePackagePaths,
  readEvidencePackage,
  writeEvidenceSources,
} from "../research/evidence-package";
import { contentHash, normalizeUrl } from "../research/source-normalizer";
import type { ResearchSource } from "../research/types";
import { themeFor } from "./amazon-reviews";
import { vocPaths } from "./service";
import { vocCorpusSchema, type VocObservation } from "./types";

export type JudgeMeReviewRecord = {
  reviewId: string;
  body: string;
  rating: number;
  publishedAt?: string;
  verified: boolean;
};

type FetchLike = typeof fetch;

const endpoint = "https://api.judge.me/reviews/reviews_for_widget";

const parseReviews = (html: string): JudgeMeReviewRecord[] => {
  const document = new JSDOM(html).window.document;
  return [...document.querySelectorAll<HTMLElement>(".jdgm-rev")].flatMap((element) => {
    const reviewId = element.dataset.reviewId?.trim();
    const body = element.querySelector(".jdgm-rev__body")?.textContent?.replaceAll(/\s+/g, " ").trim();
    const rating = Number(element.querySelector<HTMLElement>(".jdgm-rev__rating")?.dataset.score);
    if (!reviewId || !body || !Number.isFinite(rating) || rating < 1 || rating > 5) return [];
    return [{
      reviewId,
      body,
      rating,
      publishedAt: element.querySelector<HTMLElement>(".jdgm-rev__timestamp")?.dataset.content,
      verified: element.dataset.verifiedBuyer === "true",
    }];
  });
};

export const collectJudgeMeReviews = async (options: {
  productUrl: string;
  shopDomain: string;
  productId: string;
  maxPages?: number;
  fetchImpl?: FetchLike;
}): Promise<{ reviews: JudgeMeReviewRecord[]; pagesRead: number; duplicates: number }> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const seenIds = new Set<string>();
  const seenHashes = new Set<string>();
  const reviews: JudgeMeReviewRecord[] = [];
  let duplicates = 0;
  let pagesRead = 0;
  for (let page = 1; page <= (options.maxPages ?? 50); page += 1) {
    const query = new URLSearchParams({
      url: options.productUrl,
      shop_domain: options.shopDomain,
      platform: "shopify",
      page: String(page),
      per_page: "100",
      product_id: options.productId,
    });
    const response = await fetchImpl(`${endpoint}?${query}`);
    if (!response.ok) throw new Error(`Judge.me request failed (${response.status})`);
    const payload = await response.json() as { html?: unknown };
    if (typeof payload.html !== "string") throw new Error("Judge.me response is missing widget HTML");
    const pageReviews = parseReviews(payload.html);
    pagesRead += 1;
    if (pageReviews.length === 0) break;
    let newOnPage = 0;
    for (const review of pageReviews) {
      const hash = createHash("sha256").update(review.body.toLowerCase()).digest("hex");
      if (seenIds.has(review.reviewId) || seenHashes.has(hash)) {
        duplicates += 1;
        continue;
      }
      seenIds.add(review.reviewId);
      seenHashes.add(hash);
      reviews.push(review);
      newOnPage += 1;
    }
    if (newOnPage === 0) break;
  }
  return { reviews, pagesRead, duplicates };
};

const sourceNumber = (sources: ResearchSource[]): number =>
  sources.reduce((max, source) => {
    const match = /(\d+)$/.exec(source.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

const snapshot = (
  sourceId: string,
  options: {
    productUrl: string;
    platform: string;
    capturedAt: string;
    pagesRead: number;
    reviews: JudgeMeReviewRecord[];
  },
): string => `# ${sourceId} Public Product Review Snapshot

- URL: ${options.productUrl}
- Platform: ${options.platform}
- Source family: brand_competitor
- Capture method: Judge.me public review widget
- Captured at: ${options.capturedAt}
- Pages read: ${options.pagesRead}
- Review records accepted: ${options.reviews.length}
- Privacy: reviewer names, profiles, avatars and account identifiers were discarded
- Copyright: full review bodies were processed in memory and were not retained

## Review audit index

${options.reviews.map((review) => [
    `- review_id: ${review.reviewId}`,
    `rating: ${review.rating}/5`,
    `verified: ${review.verified}`,
    `published: ${review.publishedAt ?? "unknown"}`,
    `content_sha256: ${createHash("sha256").update(review.body.toLowerCase()).digest("hex")}`,
  ].join("; ")).join("\n")}
`;

const observation = (
  runId: string,
  sourceId: string,
  snapshotPath: string,
  productUrl: string,
  platform: string,
  capturedAt: string,
  review: JudgeMeReviewRecord,
): VocObservation => {
  const sentiment = review.rating <= 2 ? "negative" : review.rating === 3 ? "mixed" : "positive";
  const observationType = review.rating <= 2 ? "pain" : review.rating === 3 ? "objection" : "positive_evidence";
  const theme = themeFor(review.body);
  const assessment = sentiment === "negative"
    ? "reported dissatisfaction"
    : sentiment === "mixed"
      ? "gave a mixed assessment"
      : "reported a positive experience";
  return {
    observation_id: `VOC-JM-${createHash("sha256").update(`${productUrl}:${review.reviewId}`).digest("hex").slice(0, 16)}`,
    research_run_id: runId,
    source_id: sourceId,
    snapshot_path: snapshotPath,
    platform,
    source_family: "brand_competitor",
    page_url: productUrl,
    page_title: `${platform} public customer reviews`,
    captured_at: capturedAt,
    observation_type: observationType,
    sentiment,
    theme,
    paraphrase: `A ${review.verified ? "verified " : ""}${platform} reviewer ${assessment} related to ${theme}.`,
    quote_excerpt: null,
    product_scope: "competitor_product",
    variant_match: "not_applicable",
    firsthand_status: review.verified ? "explicit" : "likely",
    rating: { value: review.rating, scale_max: 5, platform },
    privacy_reviewed: true,
    copyright_reviewed: true,
  };
};

export const collectAndAppendJudgeMeVoc = async (options: {
  runId: string;
  productUrl: string;
  shopDomain: string;
  productId: string;
  platform: string;
  maxPages?: number;
  fetchImpl?: FetchLike;
}) => {
  const collected = await collectJudgeMeReviews(options);
  const capturedAt = new Date().toISOString();
  const productUrl = normalizeUrl(options.productUrl);
  const packagePath = researchPackagePath(options.runId);
  const evidence = await readEvidencePackage(packagePath);
  const corpusPath = vocPaths(options.runId).corpus;
  const corpus = vocCorpusSchema.parse(JSON.parse(await readFile(corpusPath, "utf8")));
  const existingSource = evidence.sources.find((source) => normalizeUrl(source.url) === productUrl);
  const sourceId = existingSource?.id ?? `SRC-VOC-${String(sourceNumber(evidence.sources) + 1).padStart(3, "0")}`;
  const snapshotPath = existingSource?.snapshotPath ?? `source_snapshots/${sourceId}.md`;
  const snapshotBody = snapshot(sourceId, {
    productUrl,
    platform: options.platform,
    capturedAt,
    pagesRead: collected.pagesRead,
    reviews: collected.reviews,
  });
  await mkdir(evidencePackagePaths(packagePath).snapshots, { recursive: true });
  await writeFile(path.join(packagePath, snapshotPath), snapshotBody, "utf8");

  const source: ResearchSource = {
    id: sourceId,
    url: productUrl,
    title: `${options.platform} public customer reviews`,
    sourceType: "market",
    retrievedAt: capturedAt,
    targetEntity: `${options.platform} competitor product`,
    targetMarket: evidence.researchInput.targetMarket,
    accessMethod: "api",
    accessStatus: "accessible",
    evidenceStatus: "verified",
    snapshotPath,
    contentHash: contentHash(snapshotBody),
    notes: "Public Judge.me review widget; personal identifiers and full review bodies were not retained.",
  };
  const sources = [...evidence.sources];
  if (existingSource) sources[sources.indexOf(existingSource)] = source;
  else sources.push(source);

  const existingObservationIds = new Set(corpus.observations.map((item) => item.observation_id));
  const observations = collected.reviews.map((review) =>
    observation(options.runId, sourceId, snapshotPath, productUrl, options.platform, capturedAt, review))
    .filter((item) => !existingObservationIds.has(item.observation_id));
  const page = {
    source_id: sourceId,
    url: productUrl,
    title: source.title,
    platform: options.platform,
    source_family: "brand_competitor" as const,
    captured_at: capturedAt,
    access_status: "accessible" as const,
    snapshot_path: snapshotPath,
    product_scope: "competitor_product" as const,
    access_notes: "Collected from the public Judge.me review widget; full review bodies were processed transiently and discarded.",
  };
  const pageIndex = corpus.source_pages.findIndex((item) => item.source_id === sourceId);
  if (pageIndex >= 0) corpus.source_pages[pageIndex] = page;
  else corpus.source_pages.push(page);
  corpus.observations.push(...observations);
  corpus.generated_at = capturedAt;
  corpus.limitations = [
    ...corpus.limitations.filter((item) => !item.includes(options.platform)),
    `${options.platform} evidence is a bounded brand-hosted review sample and may be subject to merchant moderation or selection effects.`,
  ];
  const parsedCorpus = vocCorpusSchema.parse(corpus);
  await Promise.all([
    writeEvidenceSources(packagePath, sources),
    writeFile(corpusPath, `${JSON.stringify(parsedCorpus, null, 2)}\n`, "utf8"),
  ]);
  return {
    status: "collected",
    provider: "judgeme-public-widget",
    platform: options.platform,
    received: collected.reviews.length,
    accepted: observations.length,
    duplicates: collected.duplicates + collected.reviews.length - observations.length,
    pagesRead: collected.pagesRead,
    sourceId,
    totalObservations: parsedCorpus.observations.length,
    corpusFile: corpusPath,
  };
};
