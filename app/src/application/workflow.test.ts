import { MockProvider } from "@/infrastructure/mock-provider";
import { runFixtureWorkflow, workflowStages } from "./workflow";

describe("fixture workflow", () => {
  it("runs T21 fixture through final validation", async () => {
    const workflow = await runFixtureWorkflow("test-run", new MockProvider());

    expect(workflow.status).toBe("completed");
    expect(workflow.attempts.filter((attempt) => attempt.status === "succeeded")).toHaveLength(workflowStages.length);
    expect(workflow.attempts.at(-1)?.stageCode).toBe("FINAL_VALIDATION");
  });

  it("creates a new attempt for retryable provider failures", async () => {
    const workflow = await runFixtureWorkflow("test-retry", new MockProvider(), {
      CLAIM_EXTRACTION: "rate_limit",
    });
    const claimExtractionAttempts = workflow.attempts.filter((attempt) => attempt.stageCode === "CLAIM_EXTRACTION");

    expect(workflow.status).toBe("completed");
    expect(claimExtractionAttempts).toHaveLength(2);
    expect(claimExtractionAttempts[0]?.status).toBe("failed");
    expect(claimExtractionAttempts[1]?.status).toBe("succeeded");
    expect(claimExtractionAttempts[1]?.retryOfId).not.toBeNull();
  });

  it("stops on non-retryable provider failures", async () => {
    const workflow = await runFixtureWorkflow("test-stop", new MockProvider(), {
      CLAIM_EXTRACTION: "content_blocked",
    });

    expect(workflow.status).toBe("failed");
    expect(workflow.attempts.at(-1)?.stageCode).toBe("CLAIM_EXTRACTION");
  });
});
