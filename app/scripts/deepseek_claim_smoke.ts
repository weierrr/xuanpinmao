import { PrismaClient } from "@prisma/client";
import { runOpenAIClaimExtractionSmoke } from "../src/application/openai-claim-extraction-runner";
import { DeepSeekProvider } from "../src/infrastructure/deepseek-provider";

const prisma = new PrismaClient();

runOpenAIClaimExtractionSmoke({
  prisma,
  provider: new DeepSeekProvider(),
  runId: `T21-deepseek-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  dataOrigin: "deepseek_smoke_t21_fixture",
  maxOutputTokens: 1200,
  sourceIds: ["SRC-001", "SRC-003"],
  maxClaims: 3,
  diagnostics: true,
})
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.success) {
      process.exitCode = 1;
    }
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
