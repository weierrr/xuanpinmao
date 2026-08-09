import path from "node:path";
import { readdir } from "node:fs/promises";
import { readEvidencePackage } from "../src/research/evidence-package";
import { danglingSourceIds, readSearchLog } from "../src/research/search-log";

/**
 * Checks a run's search log against SEARCH_LOG_RECORDING_STANDARD.md §11.
 *
 * Run with a runId to verify one run, or with no argument to report the
 * fidelity of every run in the output directory.
 */

const researchRoot = path.join(process.cwd(), "output", "research");

type Failure = { rule: string; detail: string };

const verify = async (runId: string): Promise<{ fidelity: string; failures: Failure[]; total: number }> => {
  const packagePath = path.join(researchRoot, runId);
  const log = await readSearchLog(packagePath);
  const failures: Failure[] = [];

  if (log.fidelity === "structured") {
    // §11.2 — every claimed source must exist in the package.
    try {
      const evidence = await readEvidencePackage(packagePath);
      const dangling = danglingSourceIds(log, new Set(evidence.sources.map((source) => source.id)));
      if (dangling.length > 0) {
        failures.push({ rule: "§11.2 悬空来源", detail: dangling.join(", ") });
      }
    } catch {
      failures.push({ rule: "§11.2 悬空来源", detail: "无法读取 sources.json，未能校验" });
    }

    // §11.3 — blocked and empty results must explain themselves.
    const missingNote = log.queries.filter(
      (query) => ["blocked", "no_relevant_results"].includes(query.outcome) && !query.note,
    );
    if (missingNote.length > 0) {
      failures.push({ rule: "§11.3 缺少 note", detail: missingNote.map((query) => query.id).join(", ") });
    }

    // §11.4 — a query that ran has a known outcome.
    const notExecuted = log.queries.filter((query) => query.outcome === "not_executed");
    if (notExecuted.length > 0) {
      failures.push({ rule: "§11.4 出现 not_executed", detail: notExecuted.map((query) => query.id).join(", ") });
    }
  }

  return { fidelity: log.fidelity, failures, total: log.totals.total };
};

const main = async () => {
  const requested = process.argv[2];
  const runIds = requested ? [requested] : (await readdir(researchRoot)).sort();

  let failed = 0;
  for (const runId of runIds) {
    const { fidelity, failures, total } = await verify(runId);
    const label = fidelity === "structured" ? `structured (${total} 条查询)` : fidelity;
    console.log(`${runId.slice(0, 52).padEnd(54)} ${label}`);
    for (const failure of failures) {
      console.log(`  ✗ ${failure.rule}: ${failure.detail}`);
      failed += 1;
    }
  }

  if (failed > 0) {
    console.log(`\n${failed} 项不合规，见 docs/SEARCH_LOG_RECORDING_STANDARD.md §11`);
    process.exitCode = 1;
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
