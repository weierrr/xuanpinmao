import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  codexNativeRunPath,
  firstPrinciplesPaths,
  researchPackagePath,
} from "../first-principles/service";
import { firstPrinciplesBundleSchema } from "../first-principles/types";
import { liveResearchPaths, readLiveResearchArtifacts } from "../research/live-research";
import { vocPaths } from "../voc/service";
import { vocCorpusSchema } from "../voc/types";
import {
  consumerDecisionStagePresentation,
  consumerPsychologyEvidenceStatusLabel,
  consumerPsychologyMechanismLabel,
  consumerPsychologyScopeLabel,
} from "./presentation";
import {
  consumerDecisionChainArtifactSchema,
  type ConsumerDecisionChainArtifact,
} from "./types";
import { validateConsumerDecisionChain } from "./validation";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const consumerPsychologyPaths = (runId: string) => {
  const root = codexNativeRunPath(runId);
  return {
    root,
    task: path.join(root, "consumer-psychology-task.json"),
    artifact: path.join(root, "consumer-decision-chain.json"),
    validation: path.join(root, "consumer-psychology-validation.json"),
    summary: path.join(root, "consumer-psychology-summary.md"),
  };
};

const readInputs = async (runId: string) => {
  const packagePath = researchPackagePath(runId);
  const [corpus, firstPrinciples, liveArtifacts] = await Promise.all([
    readFile(vocPaths(runId).corpus, "utf8").then((body) => vocCorpusSchema.parse(JSON.parse(body))),
    readFile(firstPrinciplesPaths(runId).bundle, "utf8").then((body) => firstPrinciplesBundleSchema.parse(JSON.parse(body))),
    readLiveResearchArtifacts(packagePath),
  ]);
  return { corpus, firstPrinciples, claims: liveArtifacts.claims };
};

export const prepareConsumerPsychology = async (runId: string) => {
  const { corpus, firstPrinciples, claims } = await readInputs(runId);
  const paths = consumerPsychologyPaths(runId);
  await mkdir(paths.root, { recursive: true });
  const task = {
    task_version: "1.0",
    task: "consumer-psychology-decision-chain",
    research_run_id: runId,
    product: corpus.product,
    market: corpus.market,
    input_files: {
      voc_corpus: path.relative(process.cwd(), vocPaths(runId).corpus),
      first_principles_bundle: path.relative(process.cwd(), firstPrinciplesPaths(runId).bundle),
      claims: path.relative(process.cwd(), liveResearchPaths(researchPackagePath(runId)).claims),
    },
    allowed_observation_ids: corpus.observations.map((item) => item.observation_id),
    allowed_claim_ids: claims.map((item) => item.id),
    allowed_demand_atom_ids: firstPrinciples.demand_atoms.map((item) => item.id),
    required_stage_order: [
      "situational_trigger",
      "tension_activation",
      "identity_projection",
      "outcome_imagination",
      "belief_formation",
      "risk_reduction",
    ],
    guardrails: [
      "Use only current-run VOC Observations, Claims and Demand Atoms",
      "Do not diagnose people or infer sensitive traits",
      "Do not manufacture shame, disease fear or permanent-change promises",
      "Keep competitor hooks separate from target-product performance",
      "Keep derived psychology directional or hypothetical unless a user directly expressed it",
      "Show counterevidence, unknowns and validation requirements",
      "Do not change the current product decision or unlock Listing or Ad Test",
    ],
    output_file: path.relative(process.cwd(), paths.artifact),
  };
  await writeFile(paths.task, json(task), "utf8");
  return { status: "prepared", taskFile: paths.task, artifactFile: paths.artifact, task };
};

export const validateConsumerPsychologyFile = async (runId: string, filePath: string) => {
  const { corpus, firstPrinciples, claims } = await readInputs(runId);
  const raw = JSON.parse(await readFile(path.resolve(filePath), "utf8")) as unknown;
  const validation = validateConsumerDecisionChain(raw, corpus, firstPrinciples, claims);
  const paths = consumerPsychologyPaths(runId);
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.validation, json(validation), "utf8");
  return { ...validation, file: path.resolve(filePath), validationFile: paths.validation };
};

export const readConsumerDecisionChain = async (
  runId: string,
): Promise<ConsumerDecisionChainArtifact | null> => {
  try {
    const paths = consumerPsychologyPaths(runId);
    const raw = JSON.parse(await readFile(paths.artifact, "utf8")) as unknown;
    const artifact = consumerDecisionChainArtifactSchema.parse(raw);
    const { corpus, firstPrinciples, claims } = await readInputs(runId);
    const validation = validateConsumerDecisionChain(artifact, corpus, firstPrinciples, claims);
    if (!validation.valid) {
      throw new Error(
        `Consumer psychology validation failed for ${runId}: ${validation.errors.map((item) => item.code).join(", ")}`,
      );
    }
    return artifact;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

export const consumerPsychologySummaryMarkdown = (
  artifact: ConsumerDecisionChainArtifact,
): string => `# 用户心理决策链：${artifact.product} / ${artifact.market}

> ${artifact.overall_boundary}

${artifact.stages.map((stage, index) => {
  const presentation = consumerDecisionStagePresentation[stage.stage];
  return `## ${index + 1}. ${presentation.label}：${presentation.shortLabel}

${stage.conclusion}

- 核心问题：${presentation.question}
- 心理机制：${consumerPsychologyMechanismLabel[stage.mechanism]}
- 证据状态：${consumerPsychologyEvidenceStatusLabel[stage.evidence_status]}
- 作用范围：${consumerPsychologyScopeLabel[stage.scope]}
- 支持观察：${stage.supporting_observation_ids.length}
- 支持 Claim：${stage.supporting_claim_ids.length}
- 支持 Demand Atom：${stage.supporting_demand_atom_ids.length}
- 反证：${stage.counterevidence_observation_ids.length + stage.counterevidence_claim_ids.length}
- Claim 边界：${stage.claim_boundary}

关键未知：
${stage.unknowns.length > 0 ? stage.unknowns.map((item) => `- ${item}`).join("\n") : "- 无"}

下一步验证：
${stage.validation_needed.length > 0 ? stage.validation_needed.map((item) => `- ${item}`).join("\n") : "- 无"}
`;
}).join("\n")}

## 决策边界

- 当前商品决策保持不变：是
- 目标 SKU 性能已经证明：否
- 营销表达仍是待验证草案：是
- 自动开放 Listing 或广告：否
`;

export const writeConsumerPsychologySummary = async (runId: string) => {
  const paths = consumerPsychologyPaths(runId);
  await access(paths.artifact);
  const artifact = await readConsumerDecisionChain(runId);
  if (!artifact) throw new Error(`Consumer psychology artifact is missing for ${runId}`);
  const markdown = consumerPsychologySummaryMarkdown(artifact);
  await writeFile(paths.summary, markdown, "utf8");
  return { status: "summarized", summaryFile: paths.summary, markdown };
};
