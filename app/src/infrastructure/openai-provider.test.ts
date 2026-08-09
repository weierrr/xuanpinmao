import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { OpenAIProvider } from "./openai-provider";
import { DeepSeekProvider } from "./deepseek-provider";
import {
  buildClaimExtractionPrompt,
  createProviderResponse,
  createStaticProvider,
  runOpenAIClaimExtractionSmoke,
} from "@/application/openai-claim-extraction-runner";

const root = process.cwd();
const dbName = "phase2b1_provider_test.db";
const dbPath = path.join(root, "prisma", dbName);
const dbUrl = `file:./${dbName}`;

const cleanDb = (): void => {
  for (const suffix of ["", "-journal"]) {
    const filePath = `${dbPath}${suffix}`;
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
};

const migrate = (): void => {
  cleanDb();
  const result = spawnSync("npm", ["run", "db:migrate"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: dbUrl },
    encoding: "utf8",
  });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
};

const withClient = async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = dbUrl;
  const client = new PrismaClient();
  try {
    return await fn(client);
  } finally {
    await client.$disconnect();
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
  }
};

const validClaim = {
  atomicClaim: "用户输入将目标商品描述为女士塑形压缩短袖上衣。",
  informationNature: "事实观察",
  verificationStatus: "已验证",
  runSpecApplicability: "适用",
  dataCompleteness: "完整",
  decisionUse: "背景证据",
  confidence: "高",
  sourceId: "SRC-001",
  missingEvidence: "",
  notes: "仅基于固定T21 Source抽取。",
};

const deepSeekJsonResponse = (payload: unknown, status = 200): Response =>
  new Response(
    JSON.stringify(
      status === 200
        ? {
            choices: [{ finish_reason: "stop", message: { content: typeof payload === "string" ? payload : JSON.stringify(payload) } }],
            usage: { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 },
          }
        : { error: { message: typeof payload === "string" ? payload : "request failed" } },
    ),
    { status, headers: { "content-type": "application/json" } },
  );

describe("OpenAIProvider", () => {
  it("fails safely when OPENAI_API_KEY is missing", async () => {
    const provider = new OpenAIProvider({ apiKey: "", model: "test-model" });

    const response = await provider.complete({
      stage: "CLAIM_EXTRACTION",
      instructionVersion: "v1.5-8K",
      promptVersion: "test",
      schemaVersion: "test",
      prompt: "test",
    });

    expect(response.status).toBe("failed");
    expect(response.errorCode).toBe("MISSING_API_KEY");
    expect(JSON.stringify(response)).not.toContain("sk-");
  });
});

describe("OpenAI claim extraction runner", () => {
  beforeAll(() => {
    migrate();
  });

  afterAll(() => {
    cleanDb();
  });

  it("rejects nonexistent Source IDs", async () => {
    await withClient(async (client) => {
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-invalid-source",
        provider: createStaticProvider(createProviderResponse({ claims: [{ ...validClaim, sourceId: "SRC-999" }] })),
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("INVALID_SOURCE_ID");
      expect(result.invalidSourceIds).toEqual(["SRC-999"]);
      expect(await client.claim.count({ where: { researchRunId: result.runId } })).toBe(0);
    });
  });

  it("does not write Claims when schema validation fails", async () => {
    await withClient(async (client) => {
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-schema-error",
        provider: createStaticProvider(createProviderResponse({ claims: [{ atomicClaim: "字段不完整" }] })),
      });

      expect(result.success).toBe(false);
      expect(result.schemaValid).toBe(false);
      expect(result.errorCode).toBe("SCHEMA_ERROR");
      expect(await client.claim.count({ where: { researchRunId: result.runId } })).toBe(0);
    });
  });

  it("blocks competitor Claims from becoming target direct decision evidence", async () => {
    await withClient(async (client) => {
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-competitor-migration",
        provider: createStaticProvider(
          createProviderResponse({
            claims: [
              {
                ...validClaim,
                atomicClaim: "Getionix竞品页面展示塑形T恤。",
                sourceId: "SRC-005",
                runSpecApplicability: "适用",
                decisionUse: "直接决策证据",
              },
            ],
          }),
        ),
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("COMPETITOR_EVIDENCE_MIGRATION");
      expect(result.competitorEvidenceMigration).toBe(true);
      expect(await client.claim.count({ where: { researchRunId: result.runId } })).toBe(0);
    });
  });

  it("writes validated Claims to SQLite", async () => {
    await withClient(async (client) => {
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-success",
        provider: createStaticProvider(createProviderResponse({ claims: [validClaim] })),
      });

      expect(result.success).toBe(true);
      expect(result.schemaValid).toBe(true);
      expect(result.claimWrites).toBe(1);
      expect(await client.claim.count({ where: { researchRunId: result.runId } })).toBe(1);
    });
  });

  it("persists ModelCall and WorkflowStageRun attempts", async () => {
    await withClient(async (client) => {
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-persistence",
        provider: createStaticProvider(createProviderResponse({ claims: [validClaim] })),
      });

      expect(result.workflowStageRunWrites).toBe(1);
      expect(result.modelCallWrites).toBe(1);
      const modelCall = await client.modelCall.findFirstOrThrow({ where: { researchRunId: result.runId } });
      expect(modelCall.provider).toBe("openai");
      expect(modelCall.inputTokens).toBe(10);
      expect(modelCall.outputTokens).toBe(20);
      expect(modelCall.responseChecksum).not.toBeNull();
    });
  });

  it("redacts API keys from persisted errors", async () => {
    await withClient(async (client) => {
      const fakeFetch: typeof fetch = async (): Promise<Response> =>
        new Response(JSON.stringify({ error: { message: "bad key sk-testsecret123", code: "invalid_api_key" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-redaction",
        provider: new OpenAIProvider({ apiKey: "sk-testsecret123", model: "test-model", fetchImpl: fakeFetch }),
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("AUTH_FAILED");
      const [run, stage, call] = await Promise.all([
        client.researchRun.findUniqueOrThrow({ where: { id: result.runId } }),
        client.workflowStageRun.findFirstOrThrow({ where: { researchRunId: result.runId } }),
        client.modelCall.findFirstOrThrow({ where: { researchRunId: result.runId } }),
      ]);
      expect(JSON.stringify({ run, stage, call })).not.toContain("sk-testsecret123");
      expect(call.warning).toContain("[REDACTED_KEY]");
    });
  });
});

describe("DeepSeekProvider and claim extraction runner", () => {
  beforeAll(() => {
    migrate();
  });

  afterAll(() => {
    cleanDb();
  });

  it("fails safely when DEEPSEEK_API_KEY is missing", async () => {
    const provider = new DeepSeekProvider({ apiKey: "", model: "deepseek-v4-flash" });

    const response = await provider.complete({
      stage: "CLAIM_EXTRACTION",
      instructionVersion: "v1.5-8K",
      promptVersion: "test",
      schemaVersion: "test",
      prompt: "test",
    });

    expect(response.status).toBe("failed");
    expect(response.errorCode).toBe("MISSING_API_KEY");
    expect(JSON.stringify(response)).not.toContain("sk-");
  });

  it("builds a strict JSON-only prompt with configurable Source and Claim limits", () => {
    const prompt = buildClaimExtractionPrompt({
      runSpec: {
        id: "runspec-test",
        projectId: "project-test",
        version: 1,
        isCurrent: true,
        productName: "测试商品",
        productUrl: null,
        sku: null,
        variant: null,
        packageSpec: null,
        targetCountry: "US",
        targetUser: null,
        salePrice: null,
        saleCurrency: "USD",
        offer: null,
        acquisitionChannel: "test",
        fulfillmentMode: "test",
        supplierCost: null,
        packagingCost: null,
        domesticShipping: null,
        internationalShipping: null,
        testBudget: null,
        prohibitedConditions: [],
        completenessStatus: "test",
      },
      sources: [
        {
          id: "SRC-001",
          title: "Source 1",
          url: "internal",
          sourceType: "用户输入",
          evidenceCarrier: "fixture",
          accessedAt: "2026-07-17",
          accessStatus: "已读取",
          targetEntity: "目标商品",
          skuOrVariant: null,
          market: "US",
          notes: null,
        },
        {
          id: "SRC-003",
          title: "Source 3",
          url: "internal",
          sourceType: "供应商声明",
          evidenceCarrier: "fixture",
          accessedAt: "2026-07-17",
          accessStatus: "已读取",
          targetEntity: "供应商商品",
          skuOrVariant: null,
          market: "CN",
          notes: null,
        },
      ],
      maxClaims: 3,
    });

    expect(prompt).toContain("只输出一个合法JSON对象，不得输出Markdown、解释或空白内容");
    expect(prompt).toContain("完整结构示例");
    expect(prompt).toContain("只允许使用这些Source ID：SRC-001, SRC-003");
    expect(prompt).toContain("最多输出3条Claim");
  });

  it("sends non-streaming DeepSeek JSON request parameters and redacted diagnostics", async () => {
    const diagnosticsSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let capturedBody: unknown;
    const provider = new DeepSeekProvider({
      apiKey: "sk-testsecret",
      model: "deepseek-v4-flash",
      fetchImpl: async (_url, init) => {
        capturedBody = JSON.parse(String(init?.body));
        return deepSeekJsonResponse({ claims: [validClaim] });
      },
    });

    const response = await provider.complete({
      stage: "CLAIM_EXTRACTION",
      instructionVersion: "v1.5-8K",
      promptVersion: "test",
      schemaVersion: "test",
      prompt: "prompt",
      maxOutputTokens: 1200,
      diagnostics: { enabled: true, sourceCount: 2 },
    });

    expect(response.status).toBe("succeeded");
    expect(capturedBody).toMatchObject({
      model: "deepseek-v4-flash",
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1200,
      stream: false,
    });
    expect(diagnosticsSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"deepseek.request.diagnostics"'),
    );
    expect(diagnosticsSpy.mock.calls.join("\n")).not.toContain("sk-testsecret");
    diagnosticsSpy.mockRestore();
  });

  it("does not retry 401 or 402 responses", async () => {
    await withClient(async (client) => {
      let authCalls = 0;
      const authFetch: typeof fetch = async () => {
        authCalls += 1;
        return deepSeekJsonResponse("bad key sk-testsecret", 401);
      };
      const authResult = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-deepseek-401",
        provider: new DeepSeekProvider({ apiKey: "sk-testsecret", model: "deepseek-v4-flash", fetchImpl: authFetch }),
        dataOrigin: "deepseek_test",
      });

      let balanceCalls = 0;
      const balanceFetch: typeof fetch = async () => {
        balanceCalls += 1;
        return deepSeekJsonResponse("insufficient balance", 402);
      };
      const balanceResult = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-deepseek-402",
        provider: new DeepSeekProvider({ apiKey: "sk-testsecret", model: "deepseek-v4-flash", fetchImpl: balanceFetch }),
        dataOrigin: "deepseek_test",
      });

      expect(authResult.errorCode).toBe("AUTH_FAILED");
      expect(balanceResult.errorCode).toBe("INSUFFICIENT_BALANCE");
      expect(authCalls).toBe(1);
      expect(balanceCalls).toBe(1);
      expect(authResult.workflowStageRunWrites).toBe(1);
      expect(balanceResult.workflowStageRunWrites).toBe(1);
    });
  });

  it("retries 429 and 503 at most once", async () => {
    await withClient(async (client) => {
      let rateLimitCalls = 0;
      const rateLimitFetch: typeof fetch = async () => {
        rateLimitCalls += 1;
        return rateLimitCalls === 1 ? deepSeekJsonResponse("rate limited", 429) : deepSeekJsonResponse({ claims: [validClaim] });
      };
      const rateLimitResult = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-deepseek-429",
        provider: new DeepSeekProvider({ apiKey: "sk-testsecret", model: "deepseek-v4-flash", fetchImpl: rateLimitFetch }),
        dataOrigin: "deepseek_test",
      });

      let overloadedCalls = 0;
      const overloadedFetch: typeof fetch = async () => {
        overloadedCalls += 1;
        return deepSeekJsonResponse("overloaded", 503);
      };
      const overloadedResult = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-deepseek-503",
        provider: new DeepSeekProvider({ apiKey: "sk-testsecret", model: "deepseek-v4-flash", fetchImpl: overloadedFetch }),
        dataOrigin: "deepseek_test",
      });

      expect(rateLimitResult.success).toBe(true);
      expect(rateLimitCalls).toBe(2);
      expect(rateLimitResult.workflowStageRunWrites).toBe(2);
      expect(overloadedResult.success).toBe(false);
      expect(overloadedResult.errorCode).toBe("SERVER_OVERLOADED");
      expect(overloadedCalls).toBe(2);
      expect(overloadedResult.workflowStageRunWrites).toBe(2);
    });
  });

  it("does not write Claims for empty content", async () => {
    await withClient(async (client) => {
      const emptyFetch: typeof fetch = async () =>
        new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-deepseek-empty",
        provider: new DeepSeekProvider({ apiKey: "sk-testsecret", model: "deepseek-v4-flash", fetchImpl: emptyFetch }),
        dataOrigin: "deepseek_test",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("EMPTY_RESPONSE");
      expect(await client.claim.count({ where: { researchRunId: result.runId } })).toBe(0);
    });
  });

  it.each([
    ["length", "OUTPUT_LENGTH"],
    ["content_filter", "CONTENT_FILTER"],
    ["insufficient_system_resource", "INSUFFICIENT_SYSTEM_RESOURCE"],
  ])("does not write Claims for finish_reason=%s", async (finishReason, errorCode) => {
    await withClient(async (client) => {
      const fetchImpl: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: finishReason, message: { content: JSON.stringify({ claims: [validClaim] }) } }],
            usage: { prompt_tokens: 3, completion_tokens: 4 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: `phase2b1-deepseek-finish-${finishReason}`,
        provider: new DeepSeekProvider({ apiKey: "sk-testsecret", model: "deepseek-v4-flash", fetchImpl }),
        dataOrigin: "deepseek_test",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(errorCode);
      expect(await client.claim.count({ where: { researchRunId: result.runId } })).toBe(0);
    });
  });

  it("does not write Claims for invalid JSON", async () => {
    await withClient(async (client) => {
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-deepseek-invalid-json",
        provider: new DeepSeekProvider({
          apiKey: "sk-testsecret",
          model: "deepseek-v4-flash",
          fetchImpl: async () => deepSeekJsonResponse("not-json"),
        }),
        dataOrigin: "deepseek_test",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("SCHEMA_ERROR");
      expect(await client.claim.count({ where: { researchRunId: result.runId } })).toBe(0);
    });
  });

  it("rejects invalid DeepSeek Source IDs", async () => {
    await withClient(async (client) => {
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-deepseek-invalid-source",
        provider: new DeepSeekProvider({
          apiKey: "sk-testsecret",
          model: "deepseek-v4-flash",
          fetchImpl: async () => deepSeekJsonResponse({ claims: [{ ...validClaim, sourceId: "SRC-DOES-NOT-EXIST" }] }),
        }),
        dataOrigin: "deepseek_test",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("INVALID_SOURCE_ID");
      expect(result.invalidSourceIds).toEqual(["SRC-DOES-NOT-EXIST"]);
      expect(await client.claim.count({ where: { researchRunId: result.runId } })).toBe(0);
    });
  });

  it("writes valid DeepSeek Claims to SQLite", async () => {
    await withClient(async (client) => {
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-deepseek-success",
        provider: new DeepSeekProvider({
          apiKey: "sk-testsecret",
          model: "deepseek-v4-flash",
          fetchImpl: async () => deepSeekJsonResponse({ claims: [validClaim] }),
        }),
        dataOrigin: "deepseek_test",
      });

      expect(result.success).toBe(true);
      expect(result.schemaValid).toBe(true);
      expect(result.claimWrites).toBe(1);
      expect(result.tokenUsage).toEqual({ inputTokens: 11, outputTokens: 22, totalTokens: 33 });
      expect(await client.claim.count({ where: { researchRunId: result.runId } })).toBe(1);
    });
  });

  it("redacts DeepSeek API keys from persisted errors", async () => {
    await withClient(async (client) => {
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-deepseek-redaction",
        provider: new DeepSeekProvider({
          apiKey: "sk-testsecret",
          model: "deepseek-v4-flash",
          fetchImpl: async () => deepSeekJsonResponse("bad key sk-testsecret", 401),
        }),
        dataOrigin: "deepseek_test",
      });

      const [run, stage, call] = await Promise.all([
        client.researchRun.findUniqueOrThrow({ where: { id: result.runId } }),
        client.workflowStageRun.findFirstOrThrow({ where: { researchRunId: result.runId } }),
        client.modelCall.findFirstOrThrow({ where: { researchRunId: result.runId } }),
      ]);
      expect(JSON.stringify({ run, stage, call })).not.toContain("sk-testsecret");
      expect(call.warning).toContain("[REDACTED_KEY]");
    });
  });

  it("records TIMEOUT once and does not write Claims", async () => {
    await withClient(async (client) => {
      const timeoutFetch: typeof fetch = async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      const result = await runOpenAIClaimExtractionSmoke({
        prisma: client,
        runId: "phase2b1-deepseek-timeout",
        provider: new DeepSeekProvider({
          apiKey: "sk-testsecret",
          model: "deepseek-v4-flash",
          timeoutMs: 5,
          fetchImpl: timeoutFetch,
        }),
        dataOrigin: "deepseek_test",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("TIMEOUT");
      expect(result.workflowStageRunWrites).toBe(1);
      expect(result.modelCallWrites).toBe(1);
      expect(await client.claim.count({ where: { researchRunId: result.runId } })).toBe(0);
    });
  });
});
