import { PrismaClient } from "@prisma/client";
import { runFixtureWorkflow } from "../src/application/workflow";
import { MockProvider } from "../src/infrastructure/mock-provider";
import { persistWorkflowExecution } from "../src/infrastructure/workflow-persistence";

const prisma = new PrismaClient();

const projectId = "project-t21-fixture";
const runSpecId = "runspec-t21-v1";

const persistScenario = async (runId: string, scenario: "rate_limit" | "content_blocked") => {
  const workflow = await runFixtureWorkflow(runId, new MockProvider(), {
    CLAIM_EXTRACTION: scenario,
  });
  await persistWorkflowExecution({
    prisma,
    workflow,
    projectId,
    runSpecId,
    provider: "mock",
    model: "t21-fixture-mock-v1",
    dataOrigin: "fixture",
  });
  return workflow;
};

const main = async (): Promise<void> => {
  const retryable = await persistScenario("T21-accept-retry-rate-limit", "rate_limit");
  const blocked = await persistScenario("T21-accept-blocked-content", "content_blocked");
  console.log(
    JSON.stringify(
      {
        retryable: {
          runId: retryable.runId,
          status: retryable.status,
          attempts: retryable.attempts.filter((attempt) => attempt.stageCode === "CLAIM_EXTRACTION").length,
        },
        blocked: {
          runId: blocked.runId,
          status: blocked.status,
          attempts: blocked.attempts.filter((attempt) => attempt.stageCode === "CLAIM_EXTRACTION").length,
        },
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
