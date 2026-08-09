import path from "node:path";
import { access } from "node:fs/promises";
import { createEvidencePackage, readEvidencePackage, validateEvidencePackage as validateEvidencePackageIntegrity } from "./evidence-package";
import { importResearchPackage } from "./import-service";
import { createResearchPlan, createResearchRunId as createPlanResearchRunId } from "./research-planner";
import type { PrismaClient } from "@prisma/client";
import type { ResearchImportResult, ResearchInput, ResearchPackageValidationResult, ResearchRunnerInitResult } from "./types";
import { initializeLiveResearchStatus } from "./live-research";

export const createResearchRunId = (input: ResearchInput): string => createPlanResearchRunId(input);

export const initializeResearchPackage = async (
  input: ResearchInput,
  outputRoot = path.join(process.cwd(), "output", "research"),
  now = new Date(),
  options: { resume?: boolean } = {},
): Promise<ResearchRunnerInitResult> => {
  const plan = createResearchPlan(input, now);
  const researchRunId = plan.researchRunId;
  const packagePath = path.join(outputRoot, researchRunId);
  const packageExists = await access(packagePath).then(() => true).catch(() => false);
  if (packageExists && options.resume) {
    const evidencePackage = await readEvidencePackage(packagePath);
    return { packagePath, researchRunId: evidencePackage.researchPlan.researchRunId, plan: evidencePackage.researchPlan };
  }
  await createEvidencePackage(packagePath, plan, {
    researchLog: `# Research Log\n\nCreated: ${plan.createdAt}\n\nNo web-access execution has been run yet.\n`,
  });
  return { packagePath, researchRunId, plan };
};

export const validateResearchPackage = async (packagePath: string): Promise<ResearchPackageValidationResult> =>
  validateEvidencePackageIntegrity(packagePath);

export const importResearchRunPackage = async (prisma: PrismaClient, packagePath: string): Promise<ResearchImportResult> =>
  importResearchPackage(prisma, packagePath);

export type ResearchRunnerInput = ResearchInput & {
  mode: "fixture" | "live";
};

export const ResearchRunner = {
  async run(
    input: ResearchRunnerInput,
    options: { outputRoot?: string; resume?: boolean; now?: Date } = {},
  ): Promise<ResearchRunnerInitResult & { mode: ResearchRunnerInput["mode"]; nextAction: string }> {
    const result = await initializeResearchPackage(
      input,
      options.outputRoot,
      options.now,
      { resume: options.resume },
    );

    if (input.mode === "live") {
      const statusPath = path.join(result.packagePath, "research_status.json");
      const hasStatus = await access(statusPath).then(() => true).catch(() => false);
      if (!hasStatus) {
        await initializeLiveResearchStatus(result.packagePath, result.researchRunId, options.now);
      }
    }

    return {
      ...result,
      mode: input.mode,
      nextAction:
        input.mode === "live"
          ? "Codex must load web-access, collect public evidence into this package, then run research:live with --package and --finalize."
          : "Populate the fixture package and validate it.",
    };
  },
};
