import { PrismaClient } from "@prisma/client";
import { runOpenAIClaimExtractionSmoke } from "../src/application/openai-claim-extraction-runner";

const prisma = new PrismaClient();

runOpenAIClaimExtractionSmoke({ prisma })
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
