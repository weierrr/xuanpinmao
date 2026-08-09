import { demandFieldTextZh } from "../demand-field/presentation";
import type { DemandFieldArtifact } from "../demand-field/types";
import {
  conceptMessageArchitectureSchema,
  type ConceptMessageArchitecture,
  type MarketingEvidenceRef,
} from "./types";

type AdjacentOpportunity = DemandFieldArtifact["adjacent_opportunities"][number];

const uniqueRefs = (refs: MarketingEvidenceRef[]): MarketingEvidenceRef[] => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.objectType}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const prohibitedClaims = () => [
  {
    claim: "医疗、改善循环、治疗或健康效果",
    reason: "当前研究没有目标商品的临床或科学实证。",
    category: "medical" as const,
    evidenceStatus: "prohibited" as const,
  },
  {
    claim: "永久效果、认证、专利、性能数字或稀缺性",
    reason: "此类承诺必须在独立 Research Run 中取得目标 SKU 可审计证据。",
    category: "target_sku_unverified" as const,
    evidenceStatus: "prohibited" as const,
  },
];
const phrase = (value: string): string => demandFieldTextZh(value).replace(/[。！？.!?]+$/u, "");

export const buildConceptMessageArchitecture = (
  artifact: DemandFieldArtifact,
  opportunity: AdjacentOpportunity,
): ConceptMessageArchitecture => {
  const audience = artifact.audience_clusters.find((item) => opportunity.audience_cluster_ids.includes(item.id));
  const needs = artifact.need_atoms.filter((item) => opportunity.need_atom_ids.includes(item.id));
  const scenarios = artifact.scenarios.filter((item) => opportunity.scenario_ids.includes(item.id));
  const taskSteps = artifact.task_chain.filter((item) => opportunity.task_step_ids.includes(item.id));
  const refs = uniqueRefs([
    ...opportunity.audience_cluster_ids.map((id) => ({ objectType: "voc_cluster" as const, id })),
    ...opportunity.need_atom_ids.map((id) => ({ objectType: "demand_field_need" as const, id })),
    ...opportunity.supporting_observation_ids.map((id) => ({ objectType: "voc_observation" as const, id })),
  ]);
  const pillarInputs = needs.length >= 2
    ? needs.slice(0, 4)
    : [...needs, ...taskSteps.map((step) => ({
        id: step.id,
        label: step.label,
        statement: step.job,
        evidence_status: opportunity.evidence_status,
        supporting_observation_ids: opportunity.supporting_observation_ids,
      }))].slice(0, 2);

  const messagePillars = pillarInputs.map((need, index) => {
    const scenario = scenarios[index % Math.max(scenarios.length, 1)];
    const useScenario = phrase(scenario?.label ?? taskSteps[index]?.label ?? "目标使用场景");
    const benefit = phrase(need.statement);
    const sellingPoint = `${demandFieldTextZh(opportunity.candidate_category)}：${demandFieldTextZh(need.label)}`;
    return {
      id: `${opportunity.id}-MSG-${String(index + 1).padStart(2, "0")}`,
      productSellingPoint: sellingPoint,
      customerBenefit: benefit,
      useScenario,
      emotionalValue: "减少额外处理和选择不确定性，让用户在连续任务中更安心。",
      marketingCopy: `${sellingPoint}，帮助用户在${useScenario}中获得更顺畅、可控的体验。`,
      evidenceStatus: opportunity.evidence_status,
      evidenceRefs: uniqueRefs([
        { objectType: "demand_field_need" as const, id: need.id },
        ...need.supporting_observation_ids.map((id) => ({ objectType: "voc_observation" as const, id })),
      ]),
      supportingClaimIds: [],
      validationNeeded: opportunity.validation_questions.map(demandFieldTextZh),
    };
  });

  return conceptMessageArchitectureSchema.parse({
    status: "draft_for_validation",
    targetSegment: demandFieldTextZh(audience?.label ?? "当前证据支持的聚合用户群"),
    coreJobOrPain: demandFieldTextZh(needs[0]?.statement ?? opportunity.rationale),
    differentiatedProductStructure: `${demandFieldTextZh(opportunity.candidate_category)}，围绕${needs.map((item) => demandFieldTextZh(item.label)).join("、")}进行结构设计。`,
    valueProposition: `为${demandFieldTextZh(audience?.label ?? "目标用户")}提供${demandFieldTextZh(opportunity.candidate_category)}，减少当前替代方案中的额外步骤与不确定性。`,
    messagePillars,
    useScenarios: scenarios.map((item) => demandFieldTextZh(item.label)),
    functionalBenefits: needs.map((item) => demandFieldTextZh(item.statement)),
    emotionalValues: ["更安心地完成连续任务", "减少选择和使用过程中的不确定感"],
    oneSentenceConcept: `${demandFieldTextZh(opportunity.title)}：面向${demandFieldTextZh(audience?.label ?? "目标用户")}的概念测试草案。`,
    evidenceRefs: refs,
    evidenceStrength: opportunity.evidence_status,
    hypothesesToValidate: [...opportunity.validation_questions.map(demandFieldTextZh), demandFieldTextZh(opportunity.why_not_approved)],
    prohibitedClaims: prohibitedClaims(),
  });
};
