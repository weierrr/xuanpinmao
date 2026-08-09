import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { validationExecutionLedgerSchema, type ValidationExecutionLedger } from "./types";
import { validateValidationExecutionLedger } from "./validation";

const runIdPattern = /^[a-z0-9_-]+$/i;

export const validationExecutionPath = (runId: string, root = process.cwd()): string => {
  if (!runIdPattern.test(runId)) throw new Error("Invalid research run id");
  const base = path.resolve(root, "output", "codex-native");
  const file = path.resolve(base, runId, "validation-execution.json");
  if (!file.startsWith(`${base}${path.sep}`)) throw new Error("Invalid validation execution path");
  return file;
};

const assertCompatibleBaseline = (
  persisted: ValidationExecutionLedger,
  baseline: ValidationExecutionLedger,
): void => {
  const fingerprint = (ledger: ValidationExecutionLedger) => ledger.records.map((record) => [
    record.sourceActionId,
    record.validationType,
    record.conclusionReviewTargets.map((target) => target.id).join(","),
  ].join(":")).join("|");
  const persistedActions = fingerprint(persisted);
  const baselineActions = fingerprint(baseline);
  if (persisted.runId !== baseline.runId || persistedActions !== baselineActions) {
    throw new Error("Persisted validation execution ledger is incompatible with the current action queue or conclusion registry");
  }
};

export const readValidationExecutionLedger = async (
  runId: string,
  baseline: ValidationExecutionLedger,
  root = process.cwd(),
): Promise<ValidationExecutionLedger> => {
  try {
    const parsed = validationExecutionLedgerSchema.parse(JSON.parse(await readFile(validationExecutionPath(runId, root), "utf8")) as unknown);
    assertCompatibleBaseline(parsed, baseline);
    const validation = validateValidationExecutionLedger(parsed);
    if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return baseline;
    throw error;
  }
};

export const writeValidationExecutionLedger = async (
  ledger: ValidationExecutionLedger,
  root = process.cwd(),
): Promise<string> => {
  const parsed = validationExecutionLedgerSchema.parse(ledger);
  const validation = validateValidationExecutionLedger(parsed);
  if (!validation.valid) throw new Error(validation.errors.map((issue) => issue.message).join("; "));
  const file = validationExecutionPath(parsed.runId, root);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await rename(temporary, file);
  return file;
};
