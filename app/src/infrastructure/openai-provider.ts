import { createHash } from "node:crypto";
import type { ModelProvider, ModelProviderRequest, ModelProviderResponse } from "@/application/model-provider";

type OpenAIProviderOptions = {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type OpenAIUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

type OpenAIResponse = {
  output_text?: string;
  usage?: OpenAIUsage;
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
};

export class OpenAIProvider implements ModelProvider {
  readonly id = "openai";

  readonly model: string;

  private readonly apiKey: string | undefined;

  private readonly timeoutMs: number;

  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "";
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const startedAt = Date.now();
    if (!this.apiKey) {
      return this.failure(request, startedAt, "MISSING_API_KEY", "OPENAI_API_KEY未配置", false);
    }
    if (!this.model) {
      return this.failure(request, startedAt, "MISSING_MODEL", "OPENAI_MODEL未配置", false);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: request.prompt,
          temperature: 0,
          max_output_tokens: request.maxOutputTokens ?? 1600,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const body = (await response.json().catch(() => ({}))) as OpenAIResponse;
      if (!response.ok) {
        return this.failure(
          request,
          startedAt,
          this.mapStatusToErrorCode(response.status, body.error?.code),
          this.safeWarning(response.status, body.error?.message),
          response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
          body.usage,
        );
      }

      const outputText = body.output_text ?? "";
      const payload: Record<string, string | number | boolean | null> = outputText ? { outputText } : {};
      return {
        provider: this.id,
        model: this.model,
        stage: request.stage,
        status: "succeeded",
        retryable: false,
        tokenUsage: {
          inputTokens: body.usage?.input_tokens ?? 0,
          outputTokens: body.usage?.output_tokens ?? 0,
        },
        estimatedCost: estimateOpenAICost(this.model, body.usage?.input_tokens ?? 0, body.usage?.output_tokens ?? 0),
        latencyMs: Date.now() - startedAt,
        responseChecksum: checksum(outputText),
        warning: null,
        errorCode: null,
        payload,
      };
    } catch (error) {
      clearTimeout(timeout);
      const aborted = error instanceof Error && error.name === "AbortError";
      return this.failure(
        request,
        startedAt,
        aborted ? "TIMEOUT" : "NETWORK_FAILED",
        aborted ? "OpenAI请求超时" : "OpenAI网络请求失败",
        true,
      );
    }
  }

  private failure(
    request: ModelProviderRequest,
    startedAt: number,
    errorCode: string,
    warning: string,
    retryable: boolean,
    usage?: OpenAIUsage,
  ): ModelProviderResponse {
    return {
      provider: this.id,
      model: this.model || "missing",
      stage: request.stage,
      status: "failed",
      retryable,
      tokenUsage: {
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
      },
      estimatedCost: estimateOpenAICost(this.model, usage?.input_tokens ?? 0, usage?.output_tokens ?? 0),
      latencyMs: Date.now() - startedAt,
      responseChecksum: null,
      warning,
      errorCode,
      payload: {},
    };
  }

  private mapStatusToErrorCode(status: number, apiCode?: string): string {
    if (status === 401 || status === 403) {
      return "AUTH_FAILED";
    }
    if (status === 408) {
      return "TIMEOUT";
    }
    if (status === 429) {
      return "RATE_LIMIT";
    }
    if (apiCode === "content_policy_violation" || status === 400) {
      return apiCode === "content_policy_violation" ? "CONTENT_BLOCKED" : "OPENAI_BAD_REQUEST";
    }
    return status >= 500 ? "NETWORK_FAILED" : "OPENAI_ERROR";
  }

  private safeWarning(status: number, message?: string): string {
    const cleanMessage = message?.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED_KEY]").slice(0, 240);
    return `OpenAI HTTP ${status}${cleanMessage ? `: ${cleanMessage}` : ""}`;
  }
}

const checksum = (value: string): string => createHash("sha256").update(value).digest("hex");

export const estimateOpenAICost = (model: string, inputTokens: number, outputTokens: number): number => {
  const normalized = model.toLowerCase();
  const rates =
    normalized.includes("gpt-4.1-mini") || normalized.includes("gpt-4o-mini")
      ? { inputPerMillion: 0.4, outputPerMillion: 1.6 }
      : normalized.includes("gpt-4.1-nano")
        ? { inputPerMillion: 0.1, outputPerMillion: 0.4 }
        : { inputPerMillion: 0, outputPerMillion: 0 };

  return Number(((inputTokens / 1_000_000) * rates.inputPerMillion + (outputTokens / 1_000_000) * rates.outputPerMillion).toFixed(8));
};
