import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/**
 * The record of what was searched for, including searches that found nothing.
 *
 * Without this, "no evidence of X" is unfalsifiable: a reader cannot tell
 * whether X does not exist or whether nobody looked. Failed queries are the
 * point of this artifact, not an afterthought.
 */
export const searchQueryOutcomes = [
  "yielded_sources",
  "no_relevant_results",
  "blocked",
  "not_executed",
] as const;

export const searchQuerySchema = z.object({
  id: z.string().trim().min(1),
  query: z.string().trim().min(1),
  /** Where it was run: a search engine, a marketplace, a community. */
  surface: z.string().trim().min(1),
  executedAt: z.iso.datetime().optional(),
  outcome: z.enum(searchQueryOutcomes),
  /** Raw hit count when the surface reports one. */
  resultsFound: z.number().int().min(0).optional(),
  /** Source ids this query actually contributed to the evidence package. */
  keptSourceIds: z.array(z.string().trim().min(1)),
  /** Why a query was blocked or produced nothing usable. */
  note: z.string().trim().min(1).optional(),
});

export const searchLogSchema = z.object({
  schemaVersion: z.literal("1.0"),
  researchRunId: z.string().trim().min(8),
  generatedAt: z.iso.datetime(),
  queries: z.array(searchQuerySchema),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchLog = z.infer<typeof searchLogSchema>;

/** How completely this run recorded its own search process. */
export type SearchLogFidelity = "structured" | "queries_only" | "unrecorded";

export type SearchLogView = {
  fidelity: SearchLogFidelity;
  queries: SearchQuery[];
  totals: {
    total: number;
    yielded: number;
    empty: number;
    blocked: number;
  };
};

export const searchLogPath = (packagePath: string): string =>
  path.join(packagePath, "search_log.json");

const empty: SearchLogView = {
  fidelity: "unrecorded",
  queries: [],
  totals: { total: 0, yielded: 0, empty: 0, blocked: 0 },
};

const summarize = (queries: SearchQuery[], fidelity: SearchLogFidelity): SearchLogView => ({
  fidelity,
  queries,
  totals: {
    total: queries.length,
    yielded: queries.filter((item) => item.outcome === "yielded_sources").length,
    empty: queries.filter((item) => item.outcome === "no_relevant_results").length,
    blocked: queries.filter((item) => item.outcome === "blocked").length,
  },
});

/**
 * Parses the `## Queries` section of a hand-written research log.
 *
 * Older runs recorded their queries as Markdown bullets with no result counts
 * and no link to the sources they produced. Those queries are a real record, so
 * they are surfaced — but marked `queries_only`, never dressed up as if the
 * outcome of each one were known.
 */
export const parseQueriesFromMarkdown = (markdown: string): string[] => {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Queries\s*$/i.test(line.trim()));
  if (start === -1) return [];

  const queries: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const match = /^\s*-\s+(.+?)\s*$/.exec(line);
    if (match) queries.push(match[1]);
  }
  return queries;
};

/**
 * Reads the search record, preferring the structured artifact and falling back
 * to the Markdown log. Never fabricates: a run with neither reports
 * `unrecorded` so the report can say so plainly.
 */
export const readSearchLog = async (packagePath: string): Promise<SearchLogView> => {
  try {
    const raw = await readFile(searchLogPath(packagePath), "utf8");
    const parsed = searchLogSchema.parse(JSON.parse(raw));
    return summarize(parsed.queries, "structured");
  } catch {
    // No structured artifact — try the hand-written log.
  }

  try {
    const markdown = await readFile(path.join(packagePath, "research_log.md"), "utf8");
    const texts = parseQueriesFromMarkdown(markdown);
    if (texts.length === 0) return empty;
    return summarize(
      texts.map((query, index) => ({
        id: `Q-${String(index + 1).padStart(3, "0")}`,
        query,
        surface: "未记录",
        // The Markdown log states no per-query outcome, so it stays unknown.
        outcome: "not_executed" as const,
        keptSourceIds: [],
      })),
      "queries_only",
    );
  } catch {
    return empty;
  }
};

/**
 * Every source a query claims to have produced must exist in the package.
 * Returns the ids that do not resolve.
 */
export const danglingSourceIds = (
  log: SearchLogView,
  knownSourceIds: ReadonlySet<string>,
): string[] =>
  [...new Set(log.queries.flatMap((query) => query.keptSourceIds))]
    .filter((id) => !knownSourceIds.has(id));
