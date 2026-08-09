import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  danglingSourceIds,
  parseQueriesFromMarkdown,
  readSearchLog,
} from "./search-log";

describe("search log", () => {
  let packagePath = "";

  beforeEach(async () => {
    packagePath = await mkdtemp(path.join(tmpdir(), "search-log-"));
  });

  afterEach(async () => {
    await rm(packagePath, { recursive: true, force: true });
  });

  it("reports unrecorded when a run left no search trace", async () => {
    const log = await readSearchLog(packagePath);
    // "No evidence of X" must be distinguishable from "nobody looked".
    expect(log.fidelity).toBe("unrecorded");
    expect(log.queries).toEqual([]);
  });

  it("falls back to the markdown log and marks it queries-only", async () => {
    await writeFile(
      path.join(packagePath, "research_log.md"),
      ["# Research Log", "", "## Queries", "", "- first query", "- second query", "", "## Successful sources", "", "- something else"].join("\n"),
      "utf8",
    );

    const log = await readSearchLog(packagePath);
    expect(log.fidelity).toBe("queries_only");
    expect(log.queries.map((query) => query.query)).toEqual(["first query", "second query"]);
    // The markdown states no outcome, so none may be claimed.
    expect(log.queries.every((query) => query.outcome === "not_executed")).toBe(true);
    expect(log.queries.every((query) => query.keptSourceIds.length === 0)).toBe(true);
  });

  it("stops parsing at the next markdown section", () => {
    const queries = parseQueriesFromMarkdown(
      ["## Queries", "- kept", "## Failed or degraded sources", "- not a query"].join("\n"),
    );
    expect(queries).toEqual(["kept"]);
  });

  it("prefers the structured artifact and counts every outcome", async () => {
    await writeFile(
      path.join(packagePath, "search_log.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        researchRunId: "research-run-example-0000000000-us",
        generatedAt: "2026-07-22T08:10:00.000Z",
        queries: [
          { id: "Q-001", query: "a", surface: "Google", outcome: "yielded_sources", keptSourceIds: ["SRC-001"] },
          { id: "Q-002", query: "b", surface: "Google", outcome: "no_relevant_results", keptSourceIds: [] },
          { id: "Q-003", query: "c", surface: "Trends", outcome: "blocked", keptSourceIds: [], note: "extraction failed" },
        ],
      }),
      "utf8",
    );
    // A markdown log is present too; the structured artifact must win.
    await writeFile(path.join(packagePath, "research_log.md"), "## Queries\n\n- ignored\n", "utf8");

    const log = await readSearchLog(packagePath);
    expect(log.fidelity).toBe("structured");
    expect(log.totals).toEqual({ total: 3, yielded: 1, empty: 1, blocked: 1 });
  });

  it("falls back rather than throwing when the artifact is malformed", async () => {
    await writeFile(path.join(packagePath, "search_log.json"), "{ not json", "utf8");
    await writeFile(path.join(packagePath, "research_log.md"), "## Queries\n\n- recovered\n", "utf8");

    const log = await readSearchLog(packagePath);
    expect(log.fidelity).toBe("queries_only");
    expect(log.queries[0].query).toBe("recovered");
  });

  it("flags source ids a query claims but the package does not contain", async () => {
    await writeFile(
      path.join(packagePath, "search_log.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        researchRunId: "research-run-example-0000000000-us",
        generatedAt: "2026-07-22T08:10:00.000Z",
        queries: [
          { id: "Q-001", query: "a", surface: "Google", outcome: "yielded_sources", keptSourceIds: ["SRC-001", "SRC-404"] },
        ],
      }),
      "utf8",
    );

    const log = await readSearchLog(packagePath);
    expect(danglingSourceIds(log, new Set(["SRC-001"]))).toEqual(["SRC-404"]);
    expect(danglingSourceIds(log, new Set(["SRC-001", "SRC-404"]))).toEqual([]);
  });
});
