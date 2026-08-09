import type { PrismaClient } from "@prisma/client";
import type { WorkflowExecution } from "@/application/workflow";
import { workflowStageRunId } from "@/application/workflow";

const instructionChecksum = "5e783a6af1ac1355a7b211296da1ebaaeb72c1780a74c46d63207a948e5a16b8";

export type PersistWorkflowOptions = {
  prisma: PrismaClient;
  workflow: WorkflowExecution;
  projectId: string;
  runSpecId: string;
  provider: string;
  model: string;
  dataOrigin: string;
  createDecision?: {
    formalStatus: string;
    applicableRunSpecId: string;
    determiningClaimIds: string;
    secondaryRisks: string;
    listingAllowed: boolean;
    adTestAllowed: boolean;
    rationale: string;
  };
};

export const persistWorkflowExecution = async ({
  prisma,
  workflow,
  projectId,
  runSpecId,
  provider,
  model,
  dataOrigin,
  createDecision,
}: PersistWorkflowOptions): Promise<void> => {
  const startedAt = workflow.attempts[0]?.startedAt ?? new Date();
  const completedAt = workflow.status === "completed" ? (workflow.attempts.at(-1)?.completedAt ?? new Date()) : null;
  const tokenUsage = workflow.attempts.reduce(
    (sum, attempt) =>
      sum + (attempt.modelCall?.tokenUsage.inputTokens ?? 0) + (attempt.modelCall?.tokenUsage.outputTokens ?? 0),
    0,
  );

  await prisma.researchRun.upsert({
    where: { id: workflow.runId },
    create: {
      id: workflow.runId,
      projectId,
      runSpecId,
      provider,
      model,
      instructionVersion: "v1.5-8K",
      instructionChecksum,
      status: workflow.status,
      startedAt,
      completedAt,
      error: workflow.status === "failed" ? (workflow.attempts.at(-1)?.errorCode ?? "FAILED") : null,
      tokenUsage,
      estimatedCost: 0,
      currency: "USD",
      dataOrigin,
    },
    update: {
      status: workflow.status,
      completedAt,
      error: workflow.status === "failed" ? (workflow.attempts.at(-1)?.errorCode ?? "FAILED") : null,
      tokenUsage,
      estimatedCost: 0,
      currency: "USD",
      dataOrigin,
    },
  });

  for (const attempt of workflow.attempts) {
    const stageRunId = workflowStageRunId(workflow.runId, attempt.stageCode, attempt.attempt);
    await prisma.workflowStageRun.upsert({
      where: {
        researchRunId_stageCode_attempt: {
          researchRunId: workflow.runId,
          stageCode: attempt.stageCode,
          attempt: attempt.attempt,
        },
      },
      create: {
        id: stageRunId,
        researchRunId: workflow.runId,
        stageCode: attempt.stageCode,
        attempt: attempt.attempt,
        status: attempt.status,
        inputArtifactRef: attempt.inputArtifactRef,
        outputArtifactRef: attempt.outputArtifactRef,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        errorCode: attempt.errorCode,
        errorMessage: attempt.errorMessage,
        retryOfId: attempt.retryOfId,
        log: JSON.stringify(attempt.log),
      },
      update: {
        status: attempt.status,
        outputArtifactRef: attempt.outputArtifactRef,
        completedAt: attempt.completedAt,
        errorCode: attempt.errorCode,
        errorMessage: attempt.errorMessage,
        retryOfId: attempt.retryOfId,
        log: JSON.stringify(attempt.log),
      },
    });

    if (attempt.modelCall) {
      await prisma.modelCall.upsert({
        where: { id: `call-${stageRunId}` },
        create: {
          id: `call-${stageRunId}`,
          researchRunId: workflow.runId,
          workflowStageRunId: stageRunId,
          provider: attempt.modelCall.provider,
          model: attempt.modelCall.model,
          taskKind: attempt.stageCode,
          requestSchemaVersion: "phase2a-v1",
          responseSchemaVersion: "phase2a-v1",
          promptVersion: "phase2a-fixture-v1",
          instructionChecksum,
          idempotencyKey: `${workflow.runId}-${attempt.stageCode}-${attempt.attempt}`,
          status: attempt.modelCall.status,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
          latencyMs: attempt.modelCall.latencyMs,
          inputTokens: attempt.modelCall.tokenUsage.inputTokens,
          outputTokens: attempt.modelCall.tokenUsage.outputTokens,
          estimatedCost: attempt.modelCall.estimatedCost,
          currency: "USD",
          responseArtifactRef: attempt.outputArtifactRef,
          responseChecksum: attempt.modelCall.responseChecksum,
          warning: attempt.modelCall.warning,
          errorCode: attempt.modelCall.errorCode,
          errorMessage: attempt.modelCall.warning,
        },
        update: {
          status: attempt.modelCall.status,
          completedAt: attempt.completedAt,
          latencyMs: attempt.modelCall.latencyMs,
          inputTokens: attempt.modelCall.tokenUsage.inputTokens,
          outputTokens: attempt.modelCall.tokenUsage.outputTokens,
          responseArtifactRef: attempt.outputArtifactRef,
          responseChecksum: attempt.modelCall.responseChecksum,
          warning: attempt.modelCall.warning,
          errorCode: attempt.modelCall.errorCode,
          errorMessage: attempt.modelCall.warning,
        },
      });
    }
  }

  if (createDecision) {
    await prisma.decision.upsert({
      where: { researchRunId: workflow.runId },
      create: {
        id: `decision-${workflow.runId}`,
        researchRunId: workflow.runId,
        ...createDecision,
      },
      update: createDecision,
    });
  }
};
