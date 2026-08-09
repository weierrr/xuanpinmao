import { createHash } from "node:crypto";
import type { ModelProvider, ModelProviderRequest, ModelProviderResponse } from "@/application/model-provider";

type DeepSeekProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type DeepSeekRequestBody = {
  model: string;
  messages: Array<{ role: "user"; content: string }>;
  thinking: { type: "disabled" };
  response_format: { type: "json_object" };
  temperature: 0.1;
  max_tokens: number;
  stream: false;
};

type DeepSeekUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type DeepSeekResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
    };
  }>;
  usage?: DeepSeekUsage;
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
};

export class DeepSeekProvider implements ModelProvider {
  readonly id = "deepseek";

  readonly model: string;

  private readonly apiKey: string | undefined;

  private readonly baseUrl: string;

  private readonly timeoutMs: number;

  private readonly fetchImpl: typeof fetch;

  constructor(options: DeepSeekProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    this.baseUrl = (options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
    this.model = options.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
    this.timeoutMs = options.timeoutMs ?? 120000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const startedAt = Date.now();
    if (!this.apiKey) {
      return this.failure(request, startedAt, "MISSING_API_KEY", "DEEPSEEK_API_KEY未配置", false);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const maxTokens = request.maxOutputTokens ?? 4000;
    const requestBody: DeepSeekRequestBody = {
      model: this.model,
      messages: [
        {
          role: "user",
          content: `${request.prompt ?? ""}\n\n只输出一个合法JSON对象，不得输出Markdown、解释或空白内容。`,
        },
      ],
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: maxTokens,
      stream: false,
    };
    if (request.diagnostics?.enabled) {
      console.error(
        JSON.stringify({
          type: "deepseek.request.diagnostics",
          model: this.model,
          sourceCount: request.diagnostics.sourceCount ?? null,
          promptChars: request.prompt?.length ?? 0,
          max_tokens: requestBody.max_tokens,
          stream: requestBody.stream,
          thinking: requestBody.thinking,
          response_format: requestBody.response_format,
        }),
      );
    }
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const body = (await response.json().catch(() => ({}))) as DeepSeekResponse;
      if (!response.ok) {
        const mapped = mapDeepSeekStatus(response.status);
        return this.failure(
          request,
          startedAt,
          mapped.errorCode,
          safeWarning(`DeepSeek HTTP ${response.status}${body.error?.message ? `: ${body.error.message}` : ""}`),
          mapped.retryable,
          body.usage,
        );
      }

      const choice = body.choices?.[0];
      if (choice?.finish_reason === "length") {
        return this.failure(request, startedAt, "OUTPUT_LENGTH", "DeepSeek finish_reason=length", false, body.usage);
      }
      if (choice?.finish_reason === "content_filter") {
        return this.failure(request, startedAt, "CONTENT_FILTER", "DeepSeek finish_reason=content_filter", false, body.usage);
      }
      if (choice?.finish_reason === "insufficient_system_resource") {
        return this.failure(
          request,
          startedAt,
          "INSUFFICIENT_SYSTEM_RESOURCE",
          "DeepSeek finish_reason=insufficient_system_resource",
          true,
          body.usage,
        );
      }
      const content = choice?.message?.content?.trim() ?? "";
      if (!content) {
        return this.failure(request, startedAt, "EMPTY_RESPONSE", "DeepSeek返回空content", true, body.usage);
      }
      try {
        JSON.parse(content);
      } catch {
        return this.failure(request, startedAt, "SCHEMA_ERROR", "DeepSeek返回非法JSON content", false, body.usage);
      }

      return {
        provider: this.id,
        model: this.model,
        stage: request.stage,
        status: "succeeded",
        retryable: false,
        tokenUsage: {
          inputTokens: body.usage?.prompt_tokens ?? 0,
          outputTokens: body.usage?.completion_tokens ?? 0,
        },
        estimatedCost: estimateDeepSeekCost(this.model, body.usage?.prompt_tokens ?? 0, body.usage?.completion_tokens ?? 0),
        latencyMs: Date.now() - startedAt,
        responseChecksum: checksum(content),
        warning: null,
        errorCode: null,
        payload: { outputText: content },
      };
    } catch (error) {
      clearTimeout(timeout);
      const aborted = controller.signal.aborted || (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError");
      return this.failure(
        request,
        startedAt,
        aborted ? "TIMEOUT" : "NETWORK_FAILED",
        aborted ? "DeepSeek请求超时" : "DeepSeek网络请求失败",
        !aborted,
      );
    }
  }

  private failure(
    request: ModelProviderRequest,
    startedAt: number,
    errorCode: string,
    warning: string,
    retryable: boolean,
    usage?: DeepSeekUsage,
  ): ModelProviderResponse {
    return {
      provider: this.id,
      model: this.model,
      stage: request.stage,
      status: "failed",
      retryable,
      tokenUsage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
      },
      estimatedCost: estimateDeepSeekCost(this.model, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
      latencyMs: Date.now() - startedAt,
      responseChecksum: null,
      warning: safeWarning(warning),
      errorCode,
      payload: {},
    };
  }
}

const checksum = (value: string): string => createHash("sha256").update(value).digest("hex");

const safeWarning = (value: string): string => value.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED_KEY]").slice(0, 240);

const mapDeepSeekStatus = (status: number): { errorCode: string; retryable: boolean } => {
  if (status === 400) {
    return { errorCode: "INVALID_REQUEST", retryable: false };
  }
  if (status === 401) {
    return { errorCode: "AUTH_FAILED", retryable: false };
  }
  if (status === 402) {
    return { errorCode: "INSUFFICIENT_BALANCE", retryable: false };
  }
  if (status === 422) {
    return { errorCode: "INVALID_PARAMETERS", retryable: false };
  }
  if (status === 429) {
    return { errorCode: "RATE_LIMIT", retryable: true };
  }
  if (status === 500) {
    return { errorCode: "SERVER_ERROR", retryable: true };
  }
  if (status === 503) {
    return { errorCode: "SERVER_OVERLOADED", retryable: true };
  }
  return { errorCode: status >= 500 ? "SERVER_ERROR" : "DEEPSEEK_ERROR", retryable: status >= 500 };
};

export const estimateDeepSeekCost = (model: string, inputTokens: number, outputTokens: number): number => {
  const normalized = model.toLowerCase();
  const rates = normalized.includes("deepseek") ? { inputPerMillion: 0, outputPerMillion: 0 } : { inputPerMillion: 0, outputPerMillion: 0 };
  return Number(((inputTokens / 1_000_000) * rates.inputPerMillion + (outputTokens / 1_000_000) * rates.outputPerMillion).toFixed(8));
};
