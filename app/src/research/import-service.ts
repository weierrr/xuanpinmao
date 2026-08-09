import type { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { readEvidencePackage, validateEvidencePackage } from "./evidence-package";
import { dedupeResearchSources, normalizeResearchSource, normalizeUrl } from "./source-normalizer";
import type { ResearchImportResult, ResearchPlan, ResearchSource } from "./types";

const jsonText = (value: unknown): string => JSON.stringify(value);

const safeId = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
const shortHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 10);

const ensureResearchEnvelope = async (
  tx: Prisma.TransactionClient,
  researchPlan: ResearchPlan,
): Promise<{ projectId: string; runSpecId: string; researchRunId: string }> => {
  const productName = researchPlan.productName;
  const targetMarket = researchPlan.targetMarket;
  const currency = researchPlan.currency ?? "UNKNOWN";
  const researchRunId = researchPlan.researchRunId;
  const runSlug = safeId(researchRunId);
  const projectId = `research-project-${runSlug}`;
  const runSpecId = `research-runspec-${runSlug}`;
  const now = new Date();

  await tx.project.upsert({
    where: { id: projectId },
    create: {
      id: projectId,
      name: productName,
      mode: "research_import",
      targetMarket,
      status: "research_only",
      dataOrigin: "research_package",
    },
    update: {
      name: productName,
      targetMarket,
      dataOrigin: "research_package",
    },
  });

  await tx.runSpec.upsert({
    where: { id: runSpecId },
    create: {
      id: runSpecId,
      projectId,
      version: 1,
      isCurrent: true,
      productName,
      productUrl: null,
      sku: null,
      variant: null,
      packageSpec: null,
      targetCountry: targetMarket,
      targetUser: null,
      salePrice: null,
      saleCurrency: currency,
      offer: null,
      acquisitionChannel: "research_import",
      fulfillmentMode: "unknown",
      supplierCost: null,
      packagingCost: null,
      domesticShipping: null,
      internationalShipping: null,
      testBudget: null,
      prohibitedConditions: jsonText([]),
      completenessStatus: "research_only",
    },
    update: {
      productName,
      targetCountry: targetMarket,
      saleCurrency: currency,
      isCurrent: true,
    },
  });

  await tx.researchRun.upsert({
    where: { id: researchRunId },
    create: {
      id: researchRunId,
      projectId,
      runSpecId,
      provider: "web-access",
      model: "manual-research-package",
      instructionVersion: "research-pipeline-v1",
      instructionChecksum: "not-applicable",
      status: "succeeded",
      startedAt: now,
      completedAt: now,
      error: null,
      tokenUsage: 0,
      estimatedCost: 0,
      currency,
      dataOrigin: "research_package",
    },
    update: {
      completedAt: now,
      status: "succeeded",
      currency,
      dataOrigin: "research_package",
    },
  });

  return { projectId, runSpecId, researchRunId };
};

const toSourceCreateInput = (
  source: ResearchSource,
  researchRunId: string,
  sourceId: string,
): Prisma.SourceCreateManyInput => ({
  id: sourceId,
  researchRunId,
  entityId: null,
  title: source.title,
  url: source.url,
  sourceType: `research:${source.sourceType}`,
  evidenceCarrier: "web research package",
  accessedAt: source.retrievedAt,
  accessStatus: source.accessStatus,
  targetEntity: source.targetEntity,
  skuOrVariant: source.targetSku ?? null,
  market: source.targetMarket ?? null,
  notes: jsonText({
    researchSourceId: source.id,
    sourceType: source.sourceType,
    accessMethod: source.accessMethod,
    evidenceStatus: source.evidenceStatus,
    snapshotPath: source.snapshotPath ?? null,
    contentHash: source.contentHash ?? null,
    notes: source.notes ?? null,
  }),
});

export const importResearchPackage = async (prisma: PrismaClient, packagePath: string): Promise<ResearchImportResult> => {
  const validation = await validateEvidencePackage(packagePath);
  if (!validation.valid) {
    return {
      packagePath,
      researchRunId: validation.researchRunId ?? "unknown",
      imported: 0,
      skipped: validation.duplicateUrls.length,
      invalid: validation.errors.length,
      duplicateUrls: validation.duplicateUrls,
      errors: validation.errors,
    };
  }

  const evidencePackage = await readEvidencePackage(packagePath);
  const deduped = dedupeResearchSources(evidencePackage.sources);
  const errors = [...deduped.errors];
  const normalizedSources = deduped.sources;
  const researchRunId = evidencePackage.researchPlan.researchRunId;

  const existingSources = await prisma.source.findMany({
    where: { researchRunId },
    select: { url: true },
  });
  const existingUrls = new Set<string>();
  for (const source of existingSources) {
    try {
      existingUrls.add(normalizeUrl(source.url));
    } catch {
      // Historical fixtures may contain non-public placeholders such as "内部文件，无公开URL".
    }
  }

  const sourcesToImport: ResearchSource[] = [];
  const duplicateUrls = [...deduped.duplicateUrls];

  for (const source of normalizedSources) {
    const normalized = normalizeResearchSource(source);
    if (normalized.evidenceStatus === "invalid") {
      errors.push({
        sourceId: normalized.id,
        message: "invalid evidence sources are not imported",
      });
      continue;
    }
    if (existingUrls.has(normalized.url)) {
      duplicateUrls.push(normalized.url);
      continue;
    }
    sourcesToImport.push(normalized);
  }

  if (errors.length > 0) {
    return {
      packagePath,
      researchRunId,
      imported: 0,
      skipped: duplicateUrls.length,
      invalid: errors.length,
      duplicateUrls,
      errors,
    };
  }

  await prisma.$transaction(async (tx) => {
    const envelope = await ensureResearchEnvelope(tx, evidencePackage.researchPlan);

    for (const source of sourcesToImport) {
      const sourceId = `research-source-${safeId(envelope.researchRunId)}-${shortHash(source.id)}`;
      await tx.source.create({
        data: toSourceCreateInput(source, envelope.researchRunId, sourceId),
      });
    }
  });

  return {
    packagePath,
    researchRunId,
    imported: sourcesToImport.length,
    skipped: duplicateUrls.length,
    invalid: errors.length,
    duplicateUrls,
    errors,
  };
};

