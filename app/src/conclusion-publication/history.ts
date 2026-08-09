import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { conclusionGovernancePath } from "../conclusion-governance/service";
import { conclusionGovernanceArtifactSchema, type ConclusionGovernanceArtifact } from "../conclusion-governance/types";
import { validateConclusionGovernance } from "../conclusion-governance/validation";
import { validationExecutionPath, writeValidationExecutionLedger } from "../validation-execution/service";
import { markConclusionPublicationRolledBack } from "../validation-execution/transitions";
import type { ValidationExecutionLedger } from "../validation-execution/types";
import {
  conclusionPublicationPreviewSchema,
  conclusionRollbackPreviewSchema,
  conclusionVersionHistorySchema,
  type ConclusionPublicationPreview,
  type ConclusionRollbackPreview,
  type ConclusionVersionHistory,
} from "./types";

type PublicationManifest = {
  publicationId: string;
  runId: string;
  recordId: string;
  appliedAt: string;
  status: "APPLIED";
};

type RollbackManifest = {
  rollbackId: string;
  publicationId: string;
  runId: string;
  recordId: string;
  appliedAt: string;
  status: "APPLIED";
};

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

const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8")) as T;

const publicationRoot = (runId: string, root = process.cwd()) =>
  path.join(root, "output", "codex-native", runId, "conclusion-publications");

const rollbackRoot = (runId: string, root = process.cwd()) =>
  path.join(root, "output", "codex-native", runId, "conclusion-rollbacks");

const childDirectories = async (directory: string): Promise<string[]> => {
  try {
    return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

const appliedRollbacks = async (runId: string, root = process.cwd()): Promise<RollbackManifest[]> => {
  const base = rollbackRoot(runId, root);
  const manifests = await Promise.all((await childDirectories(base)).map(async (directory) => {
    try {
      const manifest = await readJson<RollbackManifest>(path.join(base, directory, "manifest.json"));
      return manifest.status === "APPLIED" ? manifest : null;
    } catch {
      return null;
    }
  }));
  return manifests.filter((manifest): manifest is RollbackManifest => manifest !== null);
};

export const readConclusionVersionHistory = async ({
  runId,
  currentArtifact,
  root = process.cwd(),
}: {
  runId: string;
  currentArtifact: ConclusionGovernanceArtifact;
  root?: string;
}): Promise<ConclusionVersionHistory> => {
  const base = publicationRoot(runId, root);
  const rollbacks = await appliedRollbacks(runId, root);
  const rollbackByPublication = new Map(rollbacks.map((rollback) => [rollback.publicationId, rollback]));
  const versions = (await Promise.all((await childDirectories(base)).map(async (directory) => {
    try {
      const packageDirectory = path.join(base, directory);
      const manifest = await readJson<PublicationManifest>(path.join(packageDirectory, "manifest.json"));
      if (manifest.status !== "APPLIED") return null;
      const preview = conclusionPublicationPreviewSchema.parse(await readJson<unknown>(path.join(packageDirectory, "preview.json")));
      const before = conclusionGovernanceArtifactSchema.parse(await readJson<unknown>(path.join(packageDirectory, "before.json")));
      const after = conclusionGovernanceArtifactSchema.parse(await readJson<unknown>(path.join(packageDirectory, "after.json")));
      const rollback = rollbackByPublication.get(manifest.publicationId);
      const active = !rollback && currentArtifact.generated_at === after.generated_at;
      return {
        publicationId: manifest.publicationId,
        recordId: manifest.recordId,
        appliedAt: manifest.appliedAt,
        status: rollback ? "ROLLED_BACK" as const : active ? "ACTIVE" as const : "SUPERSEDED" as const,
        rollbackEligible: active,
        disposition: preview.disposition,
        affectedChapterIds: preview.affectedChapterIds,
        diffCount: preview.diffs.length,
        beforeGeneratedAt: before.generated_at,
        afterGeneratedAt: after.generated_at,
        rolledBackAt: rollback?.appliedAt ?? null,
        rollbackId: rollback?.rollbackId ?? null,
        diffs: preview.diffs,
      };
    } catch {
      return null;
    }
  }))).filter((version): version is NonNullable<typeof version> => version !== null)
    .sort((left, right) => right.appliedAt.localeCompare(left.appliedAt));

  return conclusionVersionHistorySchema.parse({
    schemaVersion: "1.0",
    runId,
    currentGovernanceGeneratedAt: currentArtifact.generated_at,
    versions,
    metrics: {
      total: versions.length,
      active: versions.filter((version) => version.status === "ACTIVE").length,
      superseded: versions.filter((version) => version.status === "SUPERSEDED").length,
      rolledBack: versions.filter((version) => version.status === "ROLLED_BACK").length,
    },
    boundary: "历史版本只用于审计与差异比较；只有与当前注册表完全匹配的最后一次有效发布可以回滚。",
  });
};

export const buildConclusionRollbackPreview = async ({
  runId,
  publicationId,
  currentArtifact,
  ledger,
  now = new Date().toISOString(),
  root = process.cwd(),
}: {
  runId: string;
  publicationId: string;
  currentArtifact: ConclusionGovernanceArtifact;
  ledger: ValidationExecutionLedger;
  now?: string;
  root?: string;
}): Promise<{ preview: ConclusionRollbackPreview; restoreArtifact: ConclusionGovernanceArtifact }> => {
  const packageDirectory = path.join(publicationRoot(runId, root), publicationId);
  let manifest: PublicationManifest;
  let publicationPreview: ConclusionPublicationPreview;
  let after: ConclusionGovernanceArtifact;
  let restoreArtifact: ConclusionGovernanceArtifact;
  try {
    manifest = await readJson<PublicationManifest>(path.join(packageDirectory, "manifest.json"));
    publicationPreview = conclusionPublicationPreviewSchema.parse(await readJson<unknown>(path.join(packageDirectory, "preview.json")));
    after = conclusionGovernanceArtifactSchema.parse(await readJson<unknown>(path.join(packageDirectory, "after.json")));
    restoreArtifact = conclusionGovernanceArtifactSchema.parse(await readJson<unknown>(path.join(packageDirectory, "before.json")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("Conclusion publication version not found");
    throw error;
  }
  if (manifest.status !== "APPLIED" || manifest.publicationId !== publicationId) throw new Error("Publication package is not an applied version");
  if (currentArtifact.generated_at !== after.generated_at) throw new Error("Only the current latest publication can be rolled back");
  const record = ledger.records.find((item) => item.id === manifest.recordId);
  if (!record?.decisionImpact?.reportUpdateApplied || record.decisionImpact.publicationId !== publicationId) {
    throw new Error("Validation ledger does not mark this publication as currently applied");
  }
  const validation = validateConclusionGovernance(restoreArtifact, {
    reportRunId: restoreArtifact.report_run_id,
    product: restoreArtifact.product,
    market: restoreArtifact.market,
  });
  if (!validation.valid) throw new Error(`Rollback target failed conclusion consistency validation: ${validation.errors.map((issue) => issue.code).join(", ")}`);
  const key = now.replace(/\D/gu, "").slice(0, 14);
  const preview = conclusionRollbackPreviewSchema.parse({
    schemaVersion: "1.0",
    rollbackId: `RBK-${publicationId}-${key}`,
    runId,
    publicationId,
    recordId: manifest.recordId,
    generatedAt: now,
    currentGovernanceGeneratedAt: currentArtifact.generated_at,
    restoreGovernanceGeneratedAt: restoreArtifact.generated_at,
    confirmationPhrase: "确认回滚正式报告",
    diffs: publicationPreview.diffs.map((diff) => ({
      currentConclusionId: diff.newConclusionId,
      restoredConclusionId: diff.oldConclusionId,
      topic: diff.topic,
      currentStatement: diff.newStatement,
      restoredStatement: diff.oldStatement,
      chapterIds: diff.chapterIds,
    })),
    consistencyValidation: { valid: true, errorCount: 0 },
    boundaries: [
      "回滚只恢复结论注册表，不删除原始验证证据、审核记录或发布版本包。",
      "只有当前最后一次有效发布可以回滚，存在后续版本时必须先处理最新版本。",
      "回滚前后都会保存独立快照，任何写入失败都会恢复回滚前状态。",
    ],
  });
  return { preview, restoreArtifact };
};

export const rollbackConclusionPublication = async ({
  runId,
  publicationId,
  currentArtifact,
  ledger,
  confirmationPhrase,
  now = new Date().toISOString(),
  root = process.cwd(),
}: {
  runId: string;
  publicationId: string;
  currentArtifact: ConclusionGovernanceArtifact;
  ledger: ValidationExecutionLedger;
  confirmationPhrase: string;
  now?: string;
  root?: string;
}) => {
  if (confirmationPhrase !== "确认回滚正式报告") throw new Error("Rollback confirmation phrase does not match");
  const { preview, restoreArtifact } = await buildConclusionRollbackPreview({ runId, publicationId, currentArtifact, ledger, now, root });
  const nextLedger = markConclusionPublicationRolledBack(ledger, preview.recordId, publicationId, preview.rollbackId, now);
  const directory = path.join(rollbackRoot(runId, root), preview.rollbackId);
  const governanceFile = conclusionGovernancePath(runId, root);
  const ledgerFile = validationExecutionPath(runId, root);
  const previousGovernanceText = await readFile(governanceFile, "utf8");
  let previousLedgerText: string | null = null;
  try {
    previousLedgerText = await readFile(ledgerFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await atomicWriteJson(path.join(directory, "current.json"), currentArtifact);
  await atomicWriteJson(path.join(directory, "restored.json"), restoreArtifact);
  await atomicWriteJson(path.join(directory, "preview.json"), preview);
  try {
    await atomicWriteJson(governanceFile, restoreArtifact);
    await writeValidationExecutionLedger(nextLedger, root);
    await atomicWriteJson(path.join(directory, "manifest.json"), {
      rollbackId: preview.rollbackId,
      publicationId,
      runId,
      recordId: preview.recordId,
      appliedAt: now,
      status: "APPLIED",
    });
  } catch (error) {
    await atomicWriteText(governanceFile, previousGovernanceText);
    if (previousLedgerText !== null) await atomicWriteText(ledgerFile, previousLedgerText);
    else await rm(ledgerFile, { force: true });
    await atomicWriteJson(path.join(directory, "manifest.json"), {
      rollbackId: preview.rollbackId,
      publicationId,
      runId,
      recordId: preview.recordId,
      attemptedAt: now,
      status: "ROLLED_BACK_AFTER_FAILURE",
      error: error instanceof Error ? error.message : "Unknown rollback failure",
    });
    throw error;
  }
  return { preview, restoreArtifact, nextLedger, directory };
};
