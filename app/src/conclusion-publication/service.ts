import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { conclusionGovernancePath } from "../conclusion-governance/service";
import type { ConclusionGovernanceArtifact } from "../conclusion-governance/types";
import { validationExecutionPath, writeValidationExecutionLedger } from "../validation-execution/service";
import { markConclusionPublicationApplied } from "../validation-execution/transitions";
import type { ValidationExecutionLedger } from "../validation-execution/types";
import { buildConclusionPublicationPreview } from "./builder";
import type { ConclusionPublicationDraft } from "./types";

const atomicWriteJson = async (file: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
};

const atomicWriteText = async (file: string, value: string): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${Date.now()}.tmp`;
  await writeFile(temporary, value, "utf8");
  await rename(temporary, file);
};

export const conclusionPublicationDirectory = (runId: string, publicationId: string, root = process.cwd()): string =>
  path.join(root, "output", "codex-native", runId, "conclusion-publications", publicationId);

export const publishApprovedConclusionProposal = async ({
  artifact,
  ledger,
  recordId,
  drafts,
  expectedGovernanceGeneratedAt,
  confirmationPhrase,
  now = new Date().toISOString(),
  root = process.cwd(),
}: {
  artifact: ConclusionGovernanceArtifact;
  ledger: ValidationExecutionLedger;
  recordId: string;
  drafts: ConclusionPublicationDraft[];
  expectedGovernanceGeneratedAt: string;
  confirmationPhrase: string;
  now?: string;
  root?: string;
}) => {
  if (confirmationPhrase !== "确认发布到正式报告") throw new Error("Publication confirmation phrase does not match");
  if (artifact.generated_at !== expectedGovernanceGeneratedAt) throw new Error("Conclusion registry changed after preview; generate a new preview");
  const { preview, nextArtifact } = buildConclusionPublicationPreview({ artifact, ledger, recordId, drafts, now });
  const nextLedger = markConclusionPublicationApplied(ledger, recordId, preview.publicationId, now);
  const publicationDirectory = conclusionPublicationDirectory(ledger.runId, preview.publicationId, root);
  const governanceFile = conclusionGovernancePath(ledger.runId, root);
  const ledgerFile = validationExecutionPath(ledger.runId, root);
  const previousGovernanceText = await readFile(governanceFile, "utf8");
  let previousLedgerText: string | null = null;
  try {
    previousLedgerText = await readFile(ledgerFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await atomicWriteJson(path.join(publicationDirectory, "before.json"), artifact);
  await atomicWriteJson(path.join(publicationDirectory, "preview.json"), preview);
  await atomicWriteJson(path.join(publicationDirectory, "after.json"), nextArtifact);
  try {
    await atomicWriteJson(governanceFile, nextArtifact);
    await writeValidationExecutionLedger(nextLedger, root);
    await atomicWriteJson(path.join(publicationDirectory, "manifest.json"), {
      publicationId: preview.publicationId,
      runId: ledger.runId,
      recordId,
      appliedAt: now,
      status: "APPLIED",
      governanceFile,
      ledgerFile,
    });
  } catch (error) {
    await atomicWriteText(governanceFile, previousGovernanceText);
    if (previousLedgerText !== null) await atomicWriteText(ledgerFile, previousLedgerText);
    else await rm(ledgerFile, { force: true });
    await atomicWriteJson(path.join(publicationDirectory, "manifest.json"), {
      publicationId: preview.publicationId,
      runId: ledger.runId,
      recordId,
      attemptedAt: now,
      status: "ROLLED_BACK",
      error: error instanceof Error ? error.message : "Unknown publication failure",
    });
    throw error;
  }
  return { preview, nextArtifact, nextLedger, publicationDirectory };
};
