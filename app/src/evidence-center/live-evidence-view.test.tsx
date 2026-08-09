import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LiveResearchAnalysis } from "../research/live-types";
import type { EvidencePackage } from "../research/types";
import type { VocSummary } from "../voc/types";
import type { LiveEvidenceCenter } from "./live-evidence";
import { LiveEvidenceCenterView } from "./live-evidence-view";

const evidencePackage = {
  sources: Array.from({ length: 29 }, (_, index) => ({
    id: `source-${index + 1}`,
    url: `https://example.com/${index + 1}`,
    title: `Source ${index + 1}`,
    sourceType: "customer",
    retrievedAt: "2026-07-30T00:00:00.000Z",
    targetEntity: "3D yoga pants users",
    accessMethod: "web-fetch",
    accessStatus: "accessible",
    evidenceStatus: "verified",
  })),
  unresolvedItems: [],
} as unknown as EvidencePackage;

const claims = Array.from({ length: 22 }, (_, index) => ({
  id: `claim-${index + 1}`,
  sourceId: `source-${(index % 22) + 1}`,
  statement: `Atomic claim ${index + 1}`,
  evidence: `Evidence ${index + 1}`,
  confidence: "Medium" as const,
  category: "customer" as const,
  targetScope: "market" as const,
}));

const vocSummary = {
  coverage: {
    valid_observations: 699,
    negative_or_neutral: 80,
    positive_or_counterevidence: 561,
    alternative_observations: 58,
    source_count: 16,
    source_family_count: 4,
    platform_count: 5,
    duplicate_count: 0,
    excluded_count: 0,
  },
  confidence: "HIGH",
  confidence_rationale: "多平台评论级证据已经过清洗和去重。",
  denominator_definition: "699 条通过质量校验的评论级观察。",
  top_pain_points: [],
  representative_excerpts: [],
} as unknown as VocSummary;

const evidence = {
  evidencePackage,
  claims,
  analysis: { unknowns: [] } as unknown as LiveResearchAnalysis,
  vocSummary,
  demandField: null,
  claimCountBySource: new Map(claims.map((claim) => [claim.sourceId, 1])),
  missingClaimSourceIds: [],
} satisfies LiveEvidenceCenter;

describe("LiveEvidenceCenterView", () => {
  it("shows live evidence layers and makes database lag explicit", () => {
    render(
      <LiveEvidenceCenterView
        runId="research-run-3d-yoga-pants"
        evidence={evidence}
        persistedSourceCount={22}
        persistedClaimCount={0}
      />,
    );

    expect(screen.getByText("真实研究")).toBeInTheDocument();
    expect(screen.getByText("VOC 有效观察").nextSibling).toHaveTextContent("699");
    expect(screen.getByText("公开来源页").nextSibling).toHaveTextContent("29");
    expect(screen.getAllByText("Atomic Claims")[1].nextSibling).toHaveTextContent("22");
    expect(screen.getByText("同步滞后：这里的差值不代表研究证据缺失。")).toBeInTheDocument();
    expect(screen.queryByText("测试数据")).not.toBeInTheDocument();
  });
});
