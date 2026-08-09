import path from "node:path";
import type { EvidencePackage } from "../research/types";
import { normalizeUrl } from "../research/source-normalizer";
import { vocCorpusSchema, type VocCorpus, type VocValidationIssue, type VocValidationResult } from "./types";

const normalizeExcerpt = (value: string): string =>
  value.toLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, " ").trim();

const inside = (root: string, candidate: string): boolean => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

export const validateVocCorpus = (
  payload: unknown,
  evidencePackage: EvidencePackage,
  snapshotExists: (absolutePath: string) => boolean,
): VocValidationResult => {
  const errors: VocValidationIssue[] = [];
  const warnings: VocValidationIssue[] = [];
  const parsed = vocCorpusSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      valid: false,
      run_id: evidencePackage.researchInput.researchRunId,
      errors: parsed.error.issues.map((issue) => ({
        code: "INVALID_VOC_SCHEMA",
        message: issue.message,
        path: issue.path.join("."),
      })),
      warnings,
      summary: {
        source_count: 0,
        observation_count: 0,
        valid_observation_count: 0,
        duplicate_count: 0,
        source_family_count: 0,
        platform_count: 0,
        negative_or_neutral_count: 0,
        counterevidence_count: 0,
      },
    };
  }

  const corpus: VocCorpus = parsed.data;
  const expectedRunId = evidencePackage.researchInput.researchRunId;
  if (corpus.run_id !== expectedRunId) {
    errors.push({ code: "VOC_RUN_MISMATCH", message: `VOC Run ${corpus.run_id} does not match ${expectedRunId}`, path: "run_id" });
  }
  if (corpus.product !== evidencePackage.researchInput.productName) {
    errors.push({ code: "VOC_PRODUCT_MISMATCH", message: "VOC product does not match current Research Run", path: "product" });
  }
  if (corpus.market.toUpperCase() !== evidencePackage.researchInput.targetMarket.toUpperCase()) {
    errors.push({ code: "VOC_MARKET_MISMATCH", message: "VOC market does not match current Research Run", path: "market" });
  }

  const researchSources = new Map(evidencePackage.sources.map((source) => [source.id, source]));
  const pageBySource = new Map<string, VocCorpus["source_pages"][number]>();
  for (const page of corpus.source_pages) {
    if (pageBySource.has(page.source_id)) {
      errors.push({ code: "DUPLICATE_VOC_SOURCE_PAGE", message: "A Source may appear only once in source_pages", sourceId: page.source_id });
    }
    pageBySource.set(page.source_id, page);
    const source = researchSources.get(page.source_id);
    if (!source) {
      errors.push({ code: "VOC_SOURCE_NOT_IN_CURRENT_RUN", message: "VOC Source does not belong to the current Research Run", sourceId: page.source_id });
      continue;
    }
    if (normalizeUrl(source.url) !== normalizeUrl(page.url)) {
      errors.push({ code: "VOC_SOURCE_URL_MISMATCH", message: "VOC page URL does not match its current-run Source", sourceId: page.source_id });
    }
    if (source.snapshotPath !== page.snapshot_path) {
      errors.push({ code: "VOC_SNAPSHOT_REFERENCE_MISMATCH", message: "VOC snapshot path does not match its Source", sourceId: page.source_id });
    }
    const snapshot = path.resolve(evidencePackage.packagePath, page.snapshot_path);
    if (!inside(evidencePackage.packagePath, snapshot)) {
      errors.push({ code: "VOC_SNAPSHOT_PATH_ESCAPE", message: "VOC snapshot escapes the current Evidence Package", sourceId: page.source_id });
    } else if (!snapshotExists(snapshot)) {
      errors.push({ code: "VOC_SNAPSHOT_MISSING", message: "VOC snapshot does not exist", sourceId: page.source_id });
    }
    if (page.access_status !== "accessible" && page.access_status !== "partial") {
      warnings.push({ code: "VOC_SOURCE_NOT_OBSERVABLE", message: "Blocked or unavailable source must not contribute observations", sourceId: page.source_id });
    }
  }

  const observationIds = new Set<string>();
  const excerpts = new Map<string, string>();
  let duplicateCount = 0;
  let validObservationCount = 0;
  for (const observation of corpus.observations) {
    let observationValid = true;
    const reject = (code: string, message: string): void => {
      observationValid = false;
      errors.push({ code, message, observationId: observation.observation_id, sourceId: observation.source_id });
    };
    if (observationIds.has(observation.observation_id)) reject("DUPLICATE_VOC_OBSERVATION_ID", "Observation ID must be unique");
    observationIds.add(observation.observation_id);
    if (observation.research_run_id !== corpus.run_id) reject("VOC_OBSERVATION_RUN_MISMATCH", "Observation belongs to another Research Run");
    const page = pageBySource.get(observation.source_id);
    if (!page) {
      reject("VOC_OBSERVATION_SOURCE_MISSING", "Observation does not reference a declared source page");
    } else {
      if (page.access_status !== "accessible" && page.access_status !== "partial") reject("VOC_OBSERVATION_FROM_INACCESSIBLE_PAGE", "Inaccessible page cannot contribute observations");
      if (observation.snapshot_path !== page.snapshot_path) reject("VOC_OBSERVATION_SNAPSHOT_MISMATCH", "Observation snapshot does not match source page");
      if (normalizeUrl(observation.page_url) !== normalizeUrl(page.url)) reject("VOC_OBSERVATION_URL_MISMATCH", "Observation URL does not match source page");
      if (observation.platform !== page.platform || observation.source_family !== page.source_family) {
        reject("VOC_OBSERVATION_SOURCE_METADATA_MISMATCH", "Observation platform or source family does not match source page");
      }
    }
    if (observation.product_scope === "parent_listing" && observation.variant_match === "target_variant") {
      reject("VOC_PARENT_REVIEW_TARGET_VARIANT", "Parent-listing evidence cannot assert target-variant match");
    }
    if (observation.product_scope === "competitor_product" && observation.variant_match === "target_variant") {
      reject("VOC_COMPETITOR_TARGET_VARIANT", "Competitor experience cannot be marked as target variant");
    }
    if (observation.rating && observation.rating.platform !== observation.platform) {
      reject("VOC_RATING_PROVENANCE_MISMATCH", "Rating platform must match the observed platform");
    }
    if (observation.rating && observation.rating.value > observation.rating.scale_max) {
      reject("VOC_RATING_OUT_OF_RANGE", "Rating exceeds the declared platform scale");
    }
    if (observation.quote_excerpt) {
      const normalized = normalizeExcerpt(observation.quote_excerpt);
      const prior = excerpts.get(normalized);
      if (prior) {
        duplicateCount += 1;
        reject("DUPLICATE_VOC_EXCERPT", `Quote duplicates observation ${prior}`);
      } else {
        excerpts.set(normalized, observation.observation_id);
      }
    }
    if (observationValid) validObservationCount += 1;
  }

  const sourceFamilies = new Set(corpus.observations.map((item) => item.source_family));
  const platforms = new Set(corpus.observations.map((item) => item.platform));
  const negativeOrNeutral = corpus.observations.filter((item) => item.sentiment === "negative" || item.sentiment === "neutral").length;
  const counterevidence = corpus.observations.filter((item) => item.observation_type === "counterevidence" || item.observation_type === "positive_evidence").length;
  if (corpus.observations.length > 0 && counterevidence === 0) {
    warnings.push({ code: "VOC_COUNTEREVIDENCE_MISSING", message: "Corpus has no positive or counterevidence observations" });
  }
  if (!corpus.amazon_comment_level_evidence) {
    warnings.push({ code: "VOC_AMAZON_COMMENT_EVIDENCE_MISSING", message: "No Amazon comment-level evidence was collected" });
  }

  return {
    valid: errors.length === 0,
    run_id: corpus.run_id,
    errors,
    warnings,
    summary: {
      source_count: corpus.source_pages.length,
      observation_count: corpus.observations.length,
      valid_observation_count: validObservationCount,
      duplicate_count: duplicateCount,
      source_family_count: sourceFamilies.size,
      platform_count: platforms.size,
      negative_or_neutral_count: negativeOrNeutral,
      counterevidence_count: counterevidence,
    },
  };
};
