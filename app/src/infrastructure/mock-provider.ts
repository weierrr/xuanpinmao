import { createHash } from "node:crypto";
import type { ProviderScenario } from "@/domain/types";
import type { ModelProvider, ModelProviderRequest, ModelProviderResponse } from "@/application/model-provider";

const checksum = (value: string): string => createHash("sha256").update(value).digest("hex");

const errorMap: Record<Exclude<ProviderScenario, "success">, { code: string; retryable: boolean; warning: string }> = {
  schema_error: { code: "SCHEMA_ERROR", retryable: true, warning: "Mock schema validation failed" },
  timeout: { code: "TIMEOUT", retryable: true, warning: "Mock provider timeout" },
  rate_limit: { code: "RATE_LIMIT", retryable: true, warning: "Mock provider rate limited" },
  content_blocked: { code: "CONTENT_BLOCKED", retryable: false, warning: "Mock content policy block" },
  user_cancelled: { code: "USER_CANCELLED", retryable: false, warning: "Mock user cancellation" },
  retryable_error: { code: "RETRYABLE_ERROR", retryable: true, warning: "Mock retryable error" },
  non_retryable_error: { code: "NON_RETRYABLE_ERROR", retryable: false, warning: "Mock non-retryable error" },
};

export class MockProvider implements ModelProvider {
  readonly id = "mock";

  readonly model = "t21-fixture-mock-v1";

  async complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const scenario = request.scenario ?? "success";
    const payload = {
      stage: request.stage,
      fixture: "T21",
      schemaVersion: request.schemaVersion,
      promptVersion: request.promptVersion,
    };

    if (scenario !== "success") {
      const failure = errorMap[scenario];
      return {
        provider: this.id,
        model: this.model,
        stage: request.stage,
        status: "failed",
        retryable: failure.retryable,
        tokenUsage: { inputTokens: 120, outputTokens: 0 },
        estimatedCost: 0,
        latencyMs: 12,
        responseChecksum: null,
        warning: failure.warning,
        errorCode: failure.code,
        payload,
      };
    }

    return {
      provider: this.id,
      model: this.model,
      stage: request.stage,
      status: "succeeded",
      retryable: false,
      tokenUsage: { inputTokens: 120, outputTokens: 80 },
      estimatedCost: 0,
      latencyMs: 18,
      responseChecksum: checksum(JSON.stringify(payload)),
      warning: null,
      errorCode: null,
      payload,
    };
  }
}
