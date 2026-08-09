import { createHash } from "node:crypto";
import type { ProviderScenario, StageStatus, WorkflowStageCode } from "@/domain/types";
import type { ModelProvider, ModelProviderResponse } from "./model-provider";

export type WorkflowAttempt = {
  stageCode: WorkflowStageCode;
  attempt: number;
  status: StageStatus;
  inputArtifactRef: string;
  outputArtifactRef: string | null;
  startedAt: Date;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryOfId: string | null;
  log: string[];
  modelCall: ModelProviderResponse | null;
};

export type WorkflowExecution = {
  runId: string;
  status: "completed" | "failed";
  attempts: WorkflowAttempt[];
};

export const workflowStages: WorkflowStageCode[] = [
  "PROJECT_SETUP",
  "MODE_DETECTION",
  "RUNSPEC_BUILD",
  "ENTITY_RESOLUTION",
  "RESEARCH_PLANNING",
  "PUBLIC_RESEARCH",
  "CLAIM_EXTRACTION",
  "EVIDENCE_VALIDATION",
  "RISK_ROUTING",
  "UNIT_ECONOMICS",
  "FORMAL_DECISION",
  "REPORT_GENERATION",
  "FINAL_VALIDATION",
];

const providerStages = new Set<WorkflowStageCode>([
  "ENTITY_RESOLUTION",
  "RESEARCH_PLANNING",
  "PUBLIC_RESEARCH",
  "CLAIM_EXTRACTION",
]);

const artifact = (runId: string, stageCode: WorkflowStageCode, attempt: number, kind: "input" | "output"): string =>
  `artifacts/${runId}/${stageCode.toLowerCase()}-${kind}-attempt-${attempt}.json`;

const stageId = (runId: string, stageCode: WorkflowStageCode, attempt: number): string =>
  createHash("sha256").update(`${runId}:${stageCode}:${attempt}`).digest("hex").slice(0, 20);

export const runFixtureWorkflow = async (
  runId: string,
  provider: ModelProvider,
  scenarioByStage: Partial<Record<WorkflowStageCode, ProviderScenario>> = {},
): Promise<WorkflowExecution> => {
  const attempts: WorkflowAttempt[] = [];
  for (const stageCode of workflowStages) {
    let attempt = 1;
    let retryOfId: string | null = null;
    let finished = false;

    while (!finished) {
      const startedAt = new Date();
      const scenario = scenarioByStage[stageCode] ?? "success";
      const shouldUseProvider = providerStages.has(stageCode);
      const modelCall = shouldUseProvider
        ? await provider.complete({
            stage: stageCode,
            instructionVersion: "v1.5-8K",
            promptVersion: "phase2a-fixture-v1",
            schemaVersion: "phase2a-v1",
            scenario: attempt === 1 ? scenario : "success",
          })
        : null;
      const succeeded = modelCall === null || modelCall.status === "succeeded";
      const completedAt = new Date();
      const currentAttempt: WorkflowAttempt = {
        stageCode,
        attempt,
        status: succeeded ? "succeeded" : "failed",
        inputArtifactRef: artifact(runId, stageCode, attempt, "input"),
        outputArtifactRef: succeeded ? artifact(runId, stageCode, attempt, "output") : null,
        startedAt,
        completedAt,
        errorCode: modelCall?.errorCode ?? null,
        errorMessage: modelCall?.warning ?? null,
        retryOfId,
        log: [
          `stage.started:${stageCode}:attempt=${attempt}`,
          succeeded ? `stage.succeeded:${stageCode}:attempt=${attempt}` : `stage.failed:${stageCode}:attempt=${attempt}`,
        ],
        modelCall,
      };
      attempts.push(currentAttempt);

      if (succeeded) {
        finished = true;
      } else if (modelCall.retryable && attempt < 2) {
        retryOfId = stageId(runId, stageCode, attempt);
        attempt += 1;
      } else {
        return { runId, status: "failed", attempts };
      }
    }
  }

  return { runId, status: "completed", attempts };
};

export const workflowStageRunId = stageId;
