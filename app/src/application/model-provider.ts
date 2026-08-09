import type { ProviderScenario, WorkflowStageCode } from "@/domain/types";

export type ModelProviderRequest = {
  stage: WorkflowStageCode;
  instructionVersion: string;
  promptVersion: string;
  schemaVersion: string;
  scenario?: ProviderScenario;
  prompt?: string;
  maxOutputTokens?: number;
  diagnostics?: {
    enabled?: boolean;
    sourceCount?: number;
  };
};

export type ModelProviderResponse = {
  provider: string;
  model: string;
  stage: WorkflowStageCode;
  status: "succeeded" | "failed";
  retryable: boolean;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
  estimatedCost: number;
  latencyMs: number;
  responseChecksum: string | null;
  warning: string | null;
  errorCode: string | null;
  payload: Record<string, string | number | boolean | null>;
};

export type ModelProvider = {
  id: string;
  model: string;
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse>;
};
