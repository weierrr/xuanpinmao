import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { contentHash, dedupeResearchSources, normalizeUrl } from "./source-normalizer";
import {
  researchInputRecordSchema,
  researchPackageManifestSchema,
  researchPackageVersion,
  researchPlanSchema,
  researchSourcesSchema,
  unresolvedResearchItemsSchema,
  type EvidencePackage,
  type ResearchInputRecord,
  type ResearchPackageManifest,
  type ResearchPackageValidationResult,
  type ResearchPlan,
  type ResearchSource,
  type UnresolvedResearchItem,
} from "./types";

const expectedFiles = [
  "manifest.json",
  "research_input.json",
  "research_plan.json",
  "sources.json",
  "source_snapshots/",
  "research_log.md",
  "unresolved_items.json",
] as const;

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const isFileExistsError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";

export const evidencePackagePaths = (packagePath: string) => ({
  root: packagePath,
  manifest: path.join(packagePath, "manifest.json"),
  input: path.join(packagePath, "research_input.json"),
  plan: path.join(packagePath, "research_plan.json"),
  sources: path.join(packagePath, "sources.json"),
  snapshots: path.join(packagePath, "source_snapshots"),
  log: path.join(packagePath, "research_log.md"),
  unresolved: path.join(packagePath, "unresolved_items.json"),
});

const isInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readIfExists = async (filePath: string): Promise<string | undefined> => {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
};

const schemaErrorMessage = (error: unknown): string => {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
  }
  return error instanceof Error ? error.message : "invalid JSON document";
};

const inputRecordFromPlan = (plan: ResearchPlan): ResearchInputRecord => ({
  packageVersion: researchPackageVersion,
  researchRunId: plan.researchRunId,
  inputHash: plan.inputHash,
  productName: plan.productName,
  targetMarket: plan.targetMarket,
  description: plan.description,
  imagePaths: plan.imagePaths ?? [],
  currency: plan.currency,
  competitors: plan.competitors ?? [],
  targetAudience: plan.targetAudience,
  budget: plan.budget,
  availableTime: plan.availableTime,
  teamSize: plan.teamSize,
  currentSupplierResources: plan.currentSupplierResources ?? [],
  currentChannelAssets: plan.currentChannelAssets ?? [],
  currentContentAssets: plan.currentContentAssets ?? [],
  acceptableMoq: plan.acceptableMoq,
  targetMargin: plan.targetMargin,
  unacceptableRisks: plan.unacceptableRisks ?? [],
  preferredBusinessModel: plan.preferredBusinessModel,
  validationGoal: plan.validationGoal,
  createdAt: plan.createdAt,
});

const manifestFromPlan = (plan: ResearchPlan): ResearchPackageManifest => ({
  packageVersion: researchPackageVersion,
  researchRunId: plan.researchRunId,
  createdAt: plan.createdAt,
  productName: plan.productName,
  targetMarket: plan.targetMarket,
  expectedFiles: [...expectedFiles],
});

const writePackageFile = async (filePath: string, value: string, overwrite: boolean): Promise<void> => {
  const flag = overwrite ? "w" : "wx";
  await writeFile(filePath, value, { encoding: "utf8", flag }).catch(async (error: unknown) => {
    if (isFileExistsError(error)) throw new Error(`Evidence package already exists: ${filePath}`);
    throw error;
  });
};

export const createEvidencePackage = async (
  packagePath: string,
  plan: ResearchPlan,
  options: {
    researchInput?: ResearchInputRecord;
    manifest?: ResearchPackageManifest;
    sources?: ResearchSource[];
    unresolvedItems?: UnresolvedResearchItem[];
    researchLog?: string;
    overwrite?: boolean;
  } = {},
): Promise<EvidencePackage> => {
  const paths = evidencePackagePaths(packagePath);
  const parsedPlan = researchPlanSchema.parse(plan);
  const researchInput = researchInputRecordSchema.parse(options.researchInput ?? inputRecordFromPlan(parsedPlan));
  const manifest = researchPackageManifestSchema.parse(options.manifest ?? manifestFromPlan(parsedPlan));
  const sources = researchSourcesSchema.parse(options.sources ?? []);
  const unresolvedItems = unresolvedResearchItemsSchema.parse(options.unresolvedItems ?? []);
  const overwrite = options.overwrite ?? false;

  await mkdir(paths.root, { recursive: true });
  await mkdir(paths.snapshots, { recursive: true });
  await writePackageFile(paths.manifest, json(manifest), overwrite);
  await writePackageFile(paths.input, json(researchInput), overwrite);
  await writePackageFile(paths.plan, json(parsedPlan), overwrite);
  await writePackageFile(paths.sources, json(sources), overwrite);
  await writePackageFile(paths.unresolved, json(unresolvedItems), overwrite);
  await writePackageFile(paths.log, options.researchLog ?? `# Research Log\n\nCreated: ${parsedPlan.createdAt}\n\nResearch package initialized. No network execution has been run.\n`, overwrite);

  return readEvidencePackage(packagePath);
};

export const readEvidencePackage = async (packagePath: string): Promise<EvidencePackage> => {
  const paths = evidencePackagePaths(packagePath);
  const [manifestRaw, inputRaw, planRaw, sourcesRaw, unresolvedRaw] = await Promise.all([
    readFile(paths.manifest, "utf8"),
    readFile(paths.input, "utf8"),
    readFile(paths.plan, "utf8"),
    readFile(paths.sources, "utf8"),
    readFile(paths.unresolved, "utf8"),
  ]);

  return {
    packagePath,
    manifest: researchPackageManifestSchema.parse(JSON.parse(manifestRaw)),
    researchInput: researchInputRecordSchema.parse(JSON.parse(inputRaw)),
    researchPlan: researchPlanSchema.parse(JSON.parse(planRaw)),
    sources: researchSourcesSchema.parse(JSON.parse(sourcesRaw)),
    unresolvedItems: unresolvedResearchItemsSchema.parse(JSON.parse(unresolvedRaw)),
  };
};

export const writeEvidenceSources = async (packagePath: string, sources: ResearchSource[]): Promise<void> => {
  const parsed = researchSourcesSchema.parse(sources);
  await writeFile(evidencePackagePaths(packagePath).sources, json(parsed), "utf8");
};

export const writeUnresolvedItems = async (packagePath: string, items: UnresolvedResearchItem[]): Promise<void> => {
  const parsed = unresolvedResearchItemsSchema.parse(items);
  await writeFile(evidencePackagePaths(packagePath).unresolved, json(parsed), "utf8");
};

export const validateEvidencePackage = async (packagePath: string): Promise<ResearchPackageValidationResult> => {
  const errors: ResearchPackageValidationResult["errors"] = [];
  const warnings: ResearchPackageValidationResult["warnings"] = [];
  const paths = evidencePackagePaths(packagePath);
  const addError = (code: string, message: string, details: { file?: string; sourceId?: string } = {}): void => {
    errors.push({ code, message, ...details });
  };

  for (const expectedFile of expectedFiles) {
    const filePath = path.join(packagePath, expectedFile);
    if (!(await fileExists(filePath))) {
      addError("MISSING_REQUIRED_PATH", `missing required evidence package path: ${expectedFile}`, { file: expectedFile });
    }
  }

  let manifest: ResearchPackageManifest | undefined;
  let researchInput: ResearchInputRecord | undefined;
  let researchPlan: ResearchPlan | undefined;
  let sources: ResearchSource[] = [];
  let unresolvedItems: UnresolvedResearchItem[] = [];

  try {
    const raw = await readFile(paths.manifest, "utf8");
    manifest = researchPackageManifestSchema.parse(JSON.parse(raw));
  } catch (error) {
    addError("INVALID_MANIFEST", schemaErrorMessage(error), { file: "manifest.json" });
  }

  try {
    const raw = await readFile(paths.input, "utf8");
    researchInput = researchInputRecordSchema.parse(JSON.parse(raw));
  } catch (error) {
    addError("INVALID_RESEARCH_INPUT", schemaErrorMessage(error), { file: "research_input.json" });
  }

  try {
    const raw = await readFile(paths.plan, "utf8");
    researchPlan = researchPlanSchema.parse(JSON.parse(raw));
  } catch (error) {
    addError("INVALID_RESEARCH_PLAN", schemaErrorMessage(error), { file: "research_plan.json" });
  }

  try {
    const raw = await readFile(paths.sources, "utf8");
    sources = researchSourcesSchema.parse(JSON.parse(raw));
  } catch (error) {
    addError("INVALID_SOURCES", schemaErrorMessage(error), { file: "sources.json" });
  }

  try {
    const raw = await readFile(paths.unresolved, "utf8");
    unresolvedItems = unresolvedResearchItemsSchema.parse(JSON.parse(raw));
  } catch (error) {
    addError("INVALID_UNRESOLVED_ITEMS", schemaErrorMessage(error), { file: "unresolved_items.json" });
  }

  const log = await readIfExists(paths.log);
  if (log !== undefined && log.trim().length === 0) {
    addError("EMPTY_RESEARCH_LOG", "research_log.md must be non-empty", { file: "research_log.md" });
  }

  let snapshotCount = 0;
  try {
    snapshotCount = (await readdir(paths.snapshots, { withFileTypes: true })).filter((entry) => entry.isFile()).length;
  } catch {
    snapshotCount = 0;
  }

  if (manifest) {
    if (manifest.packageVersion !== researchPackageVersion) {
      addError("UNSUPPORTED_PACKAGE_VERSION", `unsupported packageVersion: ${manifest.packageVersion}`, { file: "manifest.json" });
    }
    for (const expectedFile of manifest.expectedFiles) {
      if (!(await fileExists(path.join(packagePath, expectedFile)))) {
        addError("MISSING_EXPECTED_FILE", `manifest expected file is missing: ${expectedFile}`, { file: "manifest.json" });
      }
    }
  }

  if (manifest && researchInput) {
    if (manifest.researchRunId !== researchInput.researchRunId) {
      addError("MANIFEST_INPUT_RUN_MISMATCH", "manifest researchRunId does not match research_input", { file: "manifest.json" });
    }
    if (manifest.productName !== researchInput.productName) {
      addError("MANIFEST_INPUT_PRODUCT_MISMATCH", "manifest productName does not match research_input", { file: "manifest.json" });
    }
    if (manifest.targetMarket !== researchInput.targetMarket) {
      addError("MANIFEST_INPUT_MARKET_MISMATCH", "manifest targetMarket does not match research_input", { file: "manifest.json" });
    }
  }

  if (researchInput && researchPlan) {
    if (researchInput.researchRunId !== researchPlan.researchRunId) {
      addError("INPUT_PLAN_RUN_MISMATCH", "ResearchInput researchRunId does not match ResearchPlan", { file: "research_plan.json" });
    }
    if (researchInput.productName !== researchPlan.productName) {
      addError("INPUT_PLAN_PRODUCT_MISMATCH", "ResearchInput productName does not match ResearchPlan", { file: "research_plan.json" });
    }
    if (researchInput.targetMarket !== researchPlan.targetMarket) {
      addError("INPUT_PLAN_MARKET_MISMATCH", "ResearchInput targetMarket does not match ResearchPlan", { file: "research_plan.json" });
    }
  }

  const seenSourceIds = new Set<string>();
  const seenUnresolvedIds = new Set<string>();
  const snapshotPathHashes = new Map<string, string>();
  for (const item of unresolvedItems) {
    if (seenUnresolvedIds.has(item.id)) {
      addError("DUPLICATE_UNRESOLVED_ID", "duplicate unresolved item id inside evidence package", {
        file: "unresolved_items.json",
      });
    }
    seenUnresolvedIds.add(item.id);
  }

  for (const source of sources) {
    if (seenSourceIds.has(source.id)) {
      addError("DUPLICATE_SOURCE_ID", "duplicate source id inside evidence package", { file: "sources.json", sourceId: source.id });
    }
    seenSourceIds.add(source.id);

    try {
      const parsedUrl = new URL(source.url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        addError("UNSUPPORTED_SOURCE_URL_PROTOCOL", "source URL must use http or https", { file: "sources.json", sourceId: source.id });
      }
      normalizeUrl(source.url);
    } catch (error) {
      addError("INVALID_SOURCE_URL", error instanceof Error ? error.message : "invalid source URL", { file: "sources.json", sourceId: source.id });
    }

    if (source.evidenceStatus === "invalid") {
      addError("INVALID_EVIDENCE_SOURCE", "invalid evidence sources are not importable", { file: "sources.json", sourceId: source.id });
    }

    if (researchPlan && source.targetMarket && source.targetMarket.trim().toUpperCase() !== researchPlan.targetMarket.trim().toUpperCase()) {
      addError("SOURCE_MARKET_MISMATCH", "source targetMarket does not match research plan targetMarket", {
        file: "sources.json",
        sourceId: source.id,
      });
    }

    if (!source.contentSnapshot && !source.snapshotPath && source.evidenceStatus === "verified") {
      addError("VERIFIED_SOURCE_MISSING_TRACE", "verified source requires contentSnapshot or snapshotPath", {
        file: "sources.json",
        sourceId: source.id,
      });
    }

    if (!source.contentHash) {
      addError("SOURCE_MISSING_CONTENT_HASH", "contentHash is required for a complete evidence package", {
        file: "sources.json",
        sourceId: source.id,
      });
    }

    let snapshotContent: string | undefined;
    if (source.snapshotPath) {
      if (path.isAbsolute(source.snapshotPath)) {
        addError("SNAPSHOT_PATH_ABSOLUTE", "snapshotPath must be relative to the evidence package", {
          file: "sources.json",
          sourceId: source.id,
        });
      } else {
        const snapshotFile = path.resolve(packagePath, source.snapshotPath);
        if (!isInside(packagePath, snapshotFile)) {
          addError("SNAPSHOT_PATH_ESCAPE", "snapshotPath escapes the evidence package", {
            file: "sources.json",
            sourceId: source.id,
          });
        } else {
          snapshotContent = await readIfExists(snapshotFile);
          if (snapshotContent === undefined) {
            addError("MISSING_SOURCE_SNAPSHOT", `missing source snapshot: ${source.snapshotPath}`, {
              file: source.snapshotPath,
              sourceId: source.id,
            });
          }
        }
      }
    }

    if (source.contentHash) {
      const hashBase = source.contentSnapshot ?? snapshotContent;
      if (hashBase !== undefined && source.contentHash !== contentHash(hashBase)) {
        addError("CONTENT_HASH_MISMATCH", "contentHash does not match contentSnapshot or snapshot content", {
          file: source.snapshotPath ?? "sources.json",
          sourceId: source.id,
        });
      }
    }

    if (source.snapshotPath && source.contentHash) {
      const existingHash = snapshotPathHashes.get(source.snapshotPath);
      if (existingHash && existingHash !== source.contentHash) {
        addError("SNAPSHOT_PATH_CONFLICT", "snapshotPath is reused with a different contentHash", {
          file: source.snapshotPath,
          sourceId: source.id,
        });
      }
      snapshotPathHashes.set(source.snapshotPath, source.contentHash);
    }
  }

  const deduped = dedupeResearchSources(sources);
  for (const error of deduped.errors) {
    addError("SOURCE_NORMALIZATION_ERROR", error.message, { sourceId: error.sourceId, file: "sources.json" });
  }

  return {
    packagePath,
    researchRunId: researchPlan?.researchRunId ?? researchInput?.researchRunId ?? manifest?.researchRunId,
    valid: errors.length === 0,
    duplicateUrls: deduped.duplicateUrls,
    errors,
    warnings,
    summary: {
      sourceCount: sources.length,
      unresolvedCount: unresolvedItems.length,
      snapshotCount,
      verifiedCount: sources.filter((source) => source.evidenceStatus === "verified").length,
      needsReviewCount: sources.filter((source) => source.evidenceStatus === "needs_review").length,
      invalidCount: sources.filter((source) => source.evidenceStatus === "invalid").length,
    },
  };
};
