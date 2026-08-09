import { readFile } from "node:fs/promises";
import { vocPaths } from "../voc/service";
import type { ReportCounterevidence, ReportSentimentRow, ReportVoicePlatformCount } from "./types";

type ThemeCount = { theme: string; count: number };

/**
 * Reads the same-theme complaint/satisfaction split and the observations that
 * actually argue against a pain point.
 *
 * The summary reports pain themes and positive themes in separate lists; only
 * joining them on the theme shows a reader that "45 complaints about fit" sits
 * beside 229 people who were satisfied with the same thing.
 *
 * Returns empty structures when a run has no voice-of-customer artifacts.
 */
export const readVocEvidence = async (
  runId: string,
  localizeTheme: (value: string) => string,
): Promise<{
  sentimentSplit: ReportSentimentRow[];
  counterevidence: ReportCounterevidence[];
  positiveEvidenceCount: number;
  missingObservationDates: boolean;
  observationCount: number;
  datedObservationCount: number;
  platformCounts: ReportVoicePlatformCount[];
}> => {
  const empty = {
    sentimentSplit: [],
    counterevidence: [],
    positiveEvidenceCount: 0,
    missingObservationDates: false,
    observationCount: 0,
    datedObservationCount: 0,
    platformCounts: [],
  };
  const paths = vocPaths(runId);

  type VocSummaryShape = { top_pain_points?: ThemeCount[]; positive_and_counterevidence?: ThemeCount[] };
  let summary: VocSummaryShape;
  try {
    summary = JSON.parse(await readFile(paths.summaryJson, "utf8")) as VocSummaryShape;
  } catch {
    return empty;
  }

  const positiveByTheme = new Map(
    (summary.positive_and_counterevidence ?? []).map((item) => [item.theme, item.count]),
  );

  const sentimentSplit: ReportSentimentRow[] = (summary.top_pain_points ?? [])
    .map((pain) => ({
      theme: localizeTheme(pain.theme),
      negative: pain.count,
      positive: positiveByTheme.get(pain.theme) ?? 0,
    }))
    .sort((a, b) => b.negative - a.negative);

  let counterevidence: ReportCounterevidence[] = [];
  let positiveEvidenceCount = 0;
  let observationCount = 0;
  let datedObservationCount = 0;
  let platformCounts: ReportVoicePlatformCount[] = [];
  // `captured_at` is when we fetched, not when the user wrote. Only an original
  // publication date supports any recency claim.
  let missingObservationDates = false;
  try {
    const corpus = JSON.parse(await readFile(paths.corpus, "utf8")) as {
      observations?: Array<{
        observation_type: string;
        theme: string;
        paraphrase: string;
        quote_excerpt?: string;
        platform: string;
        page_url: string;
        page_title: string;
        published_at?: string;
      }>;
    };
    const observations = corpus.observations ?? [];
    const countByPlatform = new Map<string, number>();
    for (const observation of observations) {
      countByPlatform.set(observation.platform, (countByPlatform.get(observation.platform) ?? 0) + 1);
    }
    observationCount = observations.length;
    datedObservationCount = observations.filter((item) => Boolean(item.published_at)).length;
    missingObservationDates =
      observations.length > 0 && observations.every((item) => !item.published_at);
    positiveEvidenceCount = observations.filter((item) => item.observation_type === "positive_evidence").length;
    counterevidence = observations
      .filter((item) => item.observation_type === "counterevidence")
      .map((item) => ({
        theme: localizeTheme(item.theme),
        paraphrase: item.paraphrase,
        quote: item.quote_excerpt ?? "",
        platform: item.platform,
        url: item.page_url,
        pageTitle: item.page_title,
      }));
    platformCounts = [...countByPlatform.entries()]
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);
  } catch {
    // Split still works without the corpus; only the rebuttal list is lost.
  }

  return {
    sentimentSplit,
    counterevidence,
    positiveEvidenceCount,
    missingObservationDates,
    observationCount,
    datedObservationCount,
    platformCounts,
  };
};
