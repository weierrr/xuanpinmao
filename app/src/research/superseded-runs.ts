import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

type ReportComposition = {
  schema_version?: string;
  primary_run_id?: string;
  audit_run_id?: string;
};

/**
 * Runs used as historical inputs to a newer composed report are evidence
 * sources, not separate seller-facing research records.
 */
export const readSupersededRunIds = async (
  compositionRoot = path.join(process.cwd(), "config", "report-compositions"),
): Promise<Set<string>> => {
  let entries: string[];
  try {
    entries = await readdir(compositionRoot);
  } catch {
    return new Set();
  }

  const compositions = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map(async (entry): Promise<ReportComposition | null> => {
        try {
          return JSON.parse(await readFile(path.join(compositionRoot, entry), "utf8")) as ReportComposition;
        } catch {
          return null;
        }
      }),
  );

  return new Set(
    compositions.flatMap((composition) => (
      composition?.schema_version === "report-composition.v1"
      && composition.primary_run_id
      && composition.audit_run_id
      && composition.primary_run_id !== composition.audit_run_id
        ? [composition.primary_run_id]
        : []
    )),
  );
};
