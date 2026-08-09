import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { validateClaimSourceIntegrity } from "@/domain/claim-source";
import { toPersistableClaim, validateExtractedClaims } from "@/domain/claim-extraction";
import type { SourceRecord } from "@/domain/types";
import { loadT21Fixture } from "@/infrastructure/fixture";
import { OpenAIProvider } from "@/infrastructure/openai-provider";
import type { ModelProvider, ModelProviderResponse } from "./model-provider";
import { workflowStageRunId } from "./workflow";

const instructionChecksum = "5e783a6af1ac1355a7b211296da1ebaaeb72c1780a74c46d63207a948e5a16b8";
const stageCode = "CLAIM_EXTRACTION";
const requestSchemaVersion = "phase2b1-claim-extraction-v1";
const responseSchemaVersion = "phase2b1-claim-extraction-v1";
const promptVersion = "phase2b1-claim-extraction-v1";

export type OpenAIClaimExtractionRunResult = {
  runId: string;
  provider: string;
  model: string;
  success: boolean;
  schemaValid: boolean;
  claimCount: number;
  researchRunWrites: number;
  workflowStageRunWrites: number;
  modelCallWrites: number;
  claimWrites: number;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  estimatedCost: number;
  latencyMs: number;
  invalidSourceIds: string[];
  competitorEvidenceMigration: boolean;
  errorCode: string | null;
  warning: string | null;
};

export type ClaimExtractionSmokeOptions = {
  prisma: PrismaClient;
  provider?: ModelProvider;
  runId?: string;
  dataOrigin?: string;
  maxOutputTokens?: number;
  sourceIds?: string[];
  maxClaims?: number;
  diagnostics?: boolean;
};

export const selectedSmokeSourceIds = ["SRC-001", "SRC-003", "SRC-004", "SRC-005", "SRC-006"];

const toSourceRecord = (source: Awaited<ReturnType<PrismaClient["source"]["findMany"]>>[number]): SourceRecord => ({
  id: source.id,
  title: source.title,
  url: source.url,
  sourceType: source.sourceType,
  evidenceCarrier: source.evidenceCarrier,
  accessedAt: source.accessedAt,
  accessStatus: source.accessStatus,
  targetEntity: source.targetEntity,
  skuOrVariant: source.skuOrVariant,
  market: source.market,
  notes: source.notes,
});

export const buildClaimExtractionPrompt = (input: {
  runSpec: Awaited<ReturnType<typeof loadT21Fixture>>["runspec"];
  sources: SourceRecord[];
  maxClaims?: number;
}): string => `你是商品尽调Claim抽取器。只基于给定RunSpec与Source生成结构化JSON，不新增外部事实，不联网。

只输出一个合法JSON对象，不得输出Markdown、解释或空白内容。

必须输出严格JSON对象，完整结构示例为：
{"claims":[{"atomicClaim":"","informationNature":"","verificationStatus":"","runSpecApplicability":"","dataCompleteness":"","decisionUse":"","confidence":"","sourceId":"","missingEvidence":"","notes":""}]}

约束：
- 只允许使用这些Source ID：${input.sources.map((source) => source.id).join(", ")}
- 最多输出${input.maxClaims ?? 8}条Claim。
- 不允许输出不存在的Source ID。
- 竞品Source只能说明竞品自身，不得自动适用于目标商品，不得作为目标商品直接决策证据。
- 模型推断必须为低置信度，且decisionUse不得为直接决策证据。
- 未确认字段必须保留未知或关键字段缺失。

RunSpec:
${JSON.stringify(input.runSpec, null, 2)}

Sources:
${JSON.stringify(input.sources, null, 2)}
`;

const parseProviderPayload = (response: ModelProviderResponse): unknown => {
  const outputText = typeof response.payload.outputText === "string" ? response.payload.outputText : "";
  if (!outputText) {
    return {};
  }
  try {
    return JSON.parse(outputText);
  } catch {
    const match = /\{[\s\S]*\}/.exec(outputText);
    if (!match) {
      return {};
    }
    try {
      return JSON.parse(match[0] ?? "{}");
    } catch {
      return {};
    }
  }
};

const ensureFixtureCore = async (prisma: PrismaClient): Promise<void> => {
  const fixture = await loadT21Fixture();
  await prisma.project.upsert({
    where: { id: fixture.project.id },
    create: {
      id: fixture.project.id,
      name: fixture.project.name,
      mode: fixture.project.mode,
      targetMarket: fixture.project.targetMarket,
      status: fixture.project.status,
      dataOrigin: fixture.project.dataOrigin,
    },
    update: {},
  });

  await prisma.runSpec.upsert({
    where: { id: fixture.runspec.id },
    create: {
      id: fixture.runspec.id,
      projectId: fixture.project.id,
      version: fixture.runspec.version,
      isCurrent: fixture.runspec.isCurrent,
      productName: fixture.runspec.productName,
      productUrl: fixture.runspec.productUrl,
      sku: fixture.runspec.sku,
      variant: fixture.runspec.variant,
      packageSpec: fixture.runspec.packageSpec,
      targetCountry: fixture.runspec.targetCountry,
      targetUser: fixture.runspec.targetUser,
      salePrice: fixture.runspec.salePrice,
      saleCurrency: fixture.runspec.saleCurrency,
      offer: fixture.runspec.offer,
      acquisitionChannel: fixture.runspec.acquisitionChannel,
      fulfillmentMode: fixture.runspec.fulfillmentMode,
      supplierCost: fixture.runspec.supplierCost,
      packagingCost: fixture.runspec.packagingCost,
      domesticShipping: fixture.runspec.domesticShipping,
      internationalShipping: fixture.runspec.internationalShipping,
      testBudget: fixture.runspec.testBudget,
      prohibitedConditions: JSON.stringify(fixture.runspec.prohibitedConditions),
      completenessStatus: fixture.runspec.completenessStatus,
      supersedesRunSpecId: null,
    },
    update: {},
  });

  for (const entity of fixture.entities) {
    await prisma.entity.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        projectId: entity.projectId,
        type: entity.type,
        name: entity.name,
        url: entity.url,
        sku: entity.sku,
        variant: entity.variant,
        market: entity.market,
        relationship: entity.relationship,
      },
      update: {},
    });
  }

  await prisma.researchRun.upsert({
    where: { id: fixture.validation.run_id },
    create: {
      id: fixture.validation.run_id,
      projectId: fixture.project.id,
      runSpecId: fixture.runspec.id,
      provider: "fixture",
      model: "t21-source-anchor",
      instructionVersion: "v1.5-8K",
      instructionChecksum,
      status: "completed",
      startedAt: new Date("2026-07-14T15:00:00.000Z"),
      completedAt: new Date("2026-07-14T15:30:00.000Z"),
      error: null,
      tokenUsage: 0,
      estimatedCost: 0,
      currency: "USD",
      dataOrigin: "fixture",
    },
    update: {},
  });

  for (const source of fixture.sources.filter((item) => selectedSmokeSourceIds.includes(item.id))) {
    await prisma.source.upsert({
      where: { id: source.id },
      create: {
        id: source.id,
        researchRunId: fixture.validation.run_id,
        entityId: source.id === "SRC-003" || source.id === "SRC-004" ? "entity-supplier" : "entity-target-product",
        title: source.title,
        url: source.url,
        sourceType: source.sourceType,
        evidenceCarrier: source.evidenceCarrier,
        accessedAt: source.accessedAt,
        accessStatus: source.accessStatus,
        targetEntity: source.targetEntity,
        skuOrVariant: source.skuOrVariant,
        market: source.market,
        notes: source.notes,
      },
      update: {},
    });
  }
};

const persistAttempt = async ({
  prisma,
  runId,
  attempt,
  providerResponse,
  retryOfId,
  status,
  errorCode,
  warning,
  promptChecksum,
}: {
  prisma: PrismaClient;
  runId: string;
  attempt: number;
  providerResponse: ModelProviderResponse;
  retryOfId: string | null;
  status: "succeeded" | "failed";
  errorCode: string | null;
  warning: string | null;
  promptChecksum: string;
}): Promise<void> => {
  const stageRunId = workflowStageRunId(runId, stageCode, attempt);
  const now = new Date();
  await prisma.workflowStageRun.create({
    data: {
      id: stageRunId,
      researchRunId: runId,
      stageCode,
      attempt,
      status,
      inputArtifactRef: `artifacts/${runId}/claim-extraction-input-${promptChecksum}.json`,
      outputArtifactRef: status === "succeeded" ? `artifacts/${runId}/claim-extraction-output-attempt-${attempt}.json` : null,
      startedAt: new Date(now.getTime() - providerResponse.latencyMs),
      completedAt: now,
      errorCode,
      errorMessage: warning,
      retryOfId,
      log: JSON.stringify([
        `stage.started:${stageCode}:attempt=${attempt}`,
        status === "succeeded" ? `stage.succeeded:${stageCode}:attempt=${attempt}` : `stage.failed:${stageCode}:attempt=${attempt}`,
      ]),
    },
  });

  await prisma.modelCall.create({
    data: {
      id: `call-${stageRunId}`,
      researchRunId: runId,
      workflowStageRunId: stageRunId,
      provider: providerResponse.provider,
      model: providerResponse.model,
      taskKind: stageCode,
      requestSchemaVersion,
      responseSchemaVersion,
      promptVersion,
      instructionChecksum,
      idempotencyKey: `${runId}-${stageCode}-${attempt}`,
      status: providerResponse.status,
      startedAt: new Date(now.getTime() - providerResponse.latencyMs),
      completedAt: now,
      latencyMs: providerResponse.latencyMs,
      inputTokens: providerResponse.tokenUsage.inputTokens,
      outputTokens: providerResponse.tokenUsage.outputTokens,
      estimatedCost: providerResponse.estimatedCost,
      currency: "USD",
      responseArtifactRef: status === "succeeded" ? `artifacts/${runId}/claim-extraction-output-attempt-${attempt}.json` : null,
      responseChecksum: providerResponse.responseChecksum,
      warning,
      errorCode,
      errorMessage: warning,
    },
  });
};

export const runOpenAIClaimExtractionSmoke = async ({
  prisma,
  provider = new OpenAIProvider(),
  runId = `T21-openai-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  dataOrigin = "openai_smoke_t21_fixture",
  maxOutputTokens = 1600,
  sourceIds = selectedSmokeSourceIds,
  maxClaims = 8,
  diagnostics = false,
}: ClaimExtractionSmokeOptions): Promise<OpenAIClaimExtractionRunResult> => {
  const fixture = await loadT21Fixture();
  await ensureFixtureCore(prisma);

  const sourceRows = await prisma.source.findMany({
    where: { id: { in: sourceIds } },
  });
  const sourceById = new Map(sourceRows.map((source) => [source.id, source]));
  const missingSourceIds = sourceIds.filter((sourceId) => !sourceById.has(sourceId));
  if (missingSourceIds.length > 0) {
    throw new Error(`Smoke Test缺少T21 Source，请先执行npm run db:seed: ${missingSourceIds.join(", ")}`);
  }

  const sources = sourceIds.map((sourceId) => {
    const source = sourceById.get(sourceId);
    if (!source) {
      throw new Error(`Smoke Test缺少T21 Source: ${sourceId}`);
    }
    return toSourceRecord(source);
  });
  const prompt = buildClaimExtractionPrompt({ runSpec: fixture.runspec, sources, maxClaims });
  const promptChecksum = createHash("sha256").update(prompt).digest("hex").slice(0, 16);
  const startedAt = new Date();

  await prisma.researchRun.create({
    data: {
      id: runId,
      projectId: fixture.project.id,
      runSpecId: fixture.runspec.id,
      provider: provider.id,
      model: provider.model,
      instructionVersion: "v1.5-8K",
      instructionChecksum,
      status: "running",
      startedAt,
      completedAt: null,
      error: null,
      tokenUsage: 0,
      estimatedCost: 0,
      currency: "USD",
      dataOrigin,
    },
  });

  let attempt = 1;
  let retryOfId: string | null = null;
  let finalResponse: ModelProviderResponse | null = null;
  let schemaValid = false;
  let claimWrites = 0;
  let invalidSourceIds: string[] = [];
  let competitorEvidenceMigration = false;
  let finalErrorCode: string | null = null;
  let finalWarning: string | null = null;

  while (attempt <= 2) {
    const response = await provider.complete({
      stage: stageCode,
      instructionVersion: "v1.5-8K",
      promptVersion,
      schemaVersion: requestSchemaVersion,
      prompt,
      maxOutputTokens,
      diagnostics: { enabled: diagnostics, sourceCount: sources.length },
    });
    finalResponse = response;

    let attemptStatus: "succeeded" | "failed" = response.status;
    let attemptErrorCode = response.errorCode;
    let attemptWarning = response.warning;

    if (response.status === "succeeded") {
      const validation = validateExtractedClaims(parseProviderPayload(response), sources);
      invalidSourceIds = validation.invalidSourceIds;
      competitorEvidenceMigration = validation.competitorMigrationClaimIndexes.length > 0;
      if (validation.ok) {
        schemaValid = true;
        const sourceRecordById = new Map(sources.map((source) => [source.id, source]));
        for (const [index, claim] of validation.claims.entries()) {
          const source = sourceRecordById.get(claim.sourceId);
          if (!source) {
            throw new Error(`校验后仍缺少Source: ${claim.sourceId}`);
          }
          const entityId = source.id === "SRC-003" || source.id === "SRC-004" ? "entity-supplier" : "entity-target-product";
          const persistable = toPersistableClaim({ claim, index, runId, source, entityId });
          await prisma.claim.create({
            data: {
              id: persistable.id,
              researchRunId: runId,
              sourceId: persistable.sourceId,
              entityId: persistable.entityId,
              atomicClaim: persistable.atomicClaim,
              dataNature: persistable.dataNature,
              sourceType: persistable.sourceType,
              evidenceCarrier: persistable.evidenceCarrier,
              sourceLocation: persistable.sourceLocation,
              linkSpecificity: persistable.linkSpecificity,
              observedAt: persistable.observedAt,
              informationNature: persistable.informationNature,
              verificationStatus: persistable.verificationStatus,
              timeStatus: persistable.timeStatus,
              runSpecApplicability: persistable.runSpecApplicability,
              dataCompleteness: persistable.dataCompleteness,
              decisionUse: persistable.decisionUse,
              confidence: persistable.confidence,
              inferenceBasis: persistable.inferenceBasis,
              missingEvidence: persistable.missingEvidence,
              notes: persistable.notes,
            },
          });
          claimWrites += 1;
        }
      } else {
        attemptStatus = "failed";
        attemptErrorCode = validation.errorCode;
        attemptWarning = validation.errorMessage;
      }
    }

    await persistAttempt({
      prisma,
      runId,
      attempt,
      providerResponse: response,
      retryOfId,
      status: attemptStatus,
      errorCode: attemptErrorCode,
      warning: attemptWarning,
      promptChecksum,
    });

    if (attemptStatus === "succeeded") {
      break;
    }
    finalErrorCode = attemptErrorCode;
    finalWarning = attemptWarning;
    if (!response.retryable || attempt === 2 || attemptErrorCode === "SCHEMA_ERROR" || attemptErrorCode === "INVALID_SOURCE_ID") {
      break;
    }
    retryOfId = workflowStageRunId(runId, stageCode, attempt);
    attempt += 1;
  }

  const claimRows = await prisma.claim.findMany({ where: { researchRunId: runId } });
  const integrity = validateClaimSourceIntegrity(sources, claimRows);
  const success = schemaValid && integrity.forwardReferenceValid && !competitorEvidenceMigration;
  const completedAt = new Date();
  const totalTokens = (finalResponse?.tokenUsage.inputTokens ?? 0) + (finalResponse?.tokenUsage.outputTokens ?? 0);
  await prisma.researchRun.update({
    where: { id: runId },
    data: {
      status: success ? "completed" : "failed",
      completedAt,
      error: success ? null : (finalErrorCode ?? "CLAIM_EXTRACTION_FAILED"),
      tokenUsage: totalTokens,
      estimatedCost: finalResponse?.estimatedCost ?? 0,
    },
  });

  return {
    runId,
    provider: provider.id,
    model: provider.model,
    success,
    schemaValid,
    claimCount: claimRows.length,
    researchRunWrites: 1,
    workflowStageRunWrites: await prisma.workflowStageRun.count({ where: { researchRunId: runId } }),
    modelCallWrites: await prisma.modelCall.count({ where: { researchRunId: runId } }),
    claimWrites,
    tokenUsage: {
      inputTokens: finalResponse?.tokenUsage.inputTokens ?? 0,
      outputTokens: finalResponse?.tokenUsage.outputTokens ?? 0,
      totalTokens,
    },
    estimatedCost: finalResponse?.estimatedCost ?? 0,
    latencyMs: finalResponse?.latencyMs ?? 0,
    invalidSourceIds,
    competitorEvidenceMigration,
    errorCode: success ? null : (finalErrorCode ?? finalResponse?.errorCode ?? null),
    warning: success ? null : (finalWarning ?? finalResponse?.warning ?? null),
  };
};

export const createStaticProvider = (response: ModelProviderResponse): ModelProvider => ({
  id: response.provider,
  model: response.model,
  complete: async () => response,
});

export const createProviderResponse = (payload: unknown, overrides: Partial<ModelProviderResponse> = {}): ModelProviderResponse => {
  const outputText = JSON.stringify(payload);
  return {
    provider: "openai",
    model: "test-model",
    stage: stageCode,
    status: "succeeded",
    retryable: false,
    tokenUsage: { inputTokens: 10, outputTokens: 20 },
    estimatedCost: 0.00001,
    latencyMs: 5,
    responseChecksum: createHash("sha256").update(outputText).digest("hex"),
    warning: null,
    errorCode: null,
    payload: { outputText },
    ...overrides,
  };
};
