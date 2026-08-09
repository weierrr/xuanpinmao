import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readSupersededRunIds } from "./superseded-runs";

describe("superseded research runs", () => {
  it("hides the historical input when a newer composed report exists", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "xpm-compositions-"));
    await writeFile(path.join(root, "new-run.json"), JSON.stringify({
      schema_version: "report-composition.v1",
      primary_run_id: "old-run",
      audit_run_id: "new-run",
    }));

    await expect(readSupersededRunIds(root)).resolves.toEqual(new Set(["old-run"]));
  });

  it("ignores malformed and non-composed files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "xpm-compositions-"));
    await writeFile(path.join(root, "broken.json"), "{");
    await writeFile(path.join(root, "same-run.json"), JSON.stringify({
      schema_version: "report-composition.v1",
      primary_run_id: "same-run",
      audit_run_id: "same-run",
    }));

    await expect(readSupersededRunIds(root)).resolves.toEqual(new Set());
  });
});
