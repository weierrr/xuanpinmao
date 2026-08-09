import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MarketingTranslation } from "./types";
import { MarketingTranslationView } from "./marketing-translation-view";

const ref = { objectType: "claim" as const, id: "CLM-001" };
const translation = {
  status: "draft_for_validation",
  valueProposition: "用目标样品实测降低选择不确定性。",
  messagePillars: [{
    id: "MSG-01",
    productSellingPoint: "可测试的产品结构",
    customerBenefit: "减少购买前的不确定性",
    useScenario: "高要求使用场景",
    emotionalValue: "更安心地做出选择",
    marketingCopy: "先看实测，再相信承诺。",
    evidenceStatus: "directional",
    evidenceRefs: [ref],
    supportingClaimIds: ["CLM-001"],
    validationNeeded: ["完成目标样品测试"],
  }],
  channelDrafts: {
    listingTitle: { status: "draft_for_validation", text: "待验证 Listing 标题", evidenceStatus: "directional", evidenceRefs: [ref] },
    hero: { status: "draft_for_validation", headline: "先实测，再承诺", subheadline: "当前仅为概念草案", evidenceStatus: "directional", evidenceRefs: [ref] },
    adAngles: [{ status: "draft_for_validation", text: "广告角度草案", evidenceStatus: "hypothesis", evidenceRefs: [ref] }],
    contentHooks: [{ status: "draft_for_validation", text: "内容钩子草案", evidenceStatus: "hypothesis", evidenceRefs: [ref] }],
  },
  objections: [{ objection: "目标性能未知", responseDirection: "以样品实测回答", evidenceStatus: "hypothesis", evidenceRefs: [ref] }],
  nonGoals: ["不承诺医疗效果"],
  prohibitedClaims: [{ claim: "永久效果", reason: "没有目标商品证据", category: "permanent_effect", evidenceStatus: "prohibited" }],
  usageBoundaries: ["商品上架尚未开放"],
  validationExperiments: [{
    id: "MKT-EXP-01",
    name: "落地页概念测试",
    keyHypothesis: "目标用户能理解价值主张",
    marketingExpression: "先实测，再承诺",
    targetAudience: "目标用户",
    metric: "概念选择率",
    passThreshold: "达到预设阈值",
    failThreshold: "低于失败阈值",
    stopCondition: "样本不合格时停止",
    nextIfPass: "进入样品验证",
    nextIfFail: "重写表达",
  }],
} as MarketingTranslation;

describe("MarketingTranslationView", () => {
  it("shows the permission boundary, translation formula and validation plan", () => {
    render(<MarketingTranslationView translation={translation} />);
    expect(screen.getByText("当前文案状态：待验证草案")).toBeInTheDocument();
    expect(screen.getByText("产品卖点到用户价值")).toBeInTheDocument();
    expect(screen.getByText("先看实测，再相信承诺。")).toBeInTheDocument();
    expect(screen.getByText("禁用 Claim")).toBeInTheDocument();
    expect(screen.getByText("落地页概念测试")).toBeInTheDocument();
  });

  it("can hide internal evidence IDs in seller-facing views", () => {
    render(<MarketingTranslationView translation={translation} showEvidenceIds={false} />);
    expect(screen.queryByText(/claim:CLM-001/)).not.toBeInTheDocument();
    expect(screen.getByText("方向性证据")).toBeInTheDocument();
  });

  it("shows the psychology-to-marketing bridge when the unified chain exists", () => {
    const roles = ["hook", "promise", "proof", "offer", "cta"] as const;
    render(<MarketingTranslationView translation={{
      ...translation,
      decisionChain: {
        sourceArtifact: "consumer_psychology_decision_chain",
        sourceGeneratedAt: "2026-08-03T00:00:00.000Z",
        mappings: roles.map((role, index) => ({
          role,
          expression: `${role} 对应表达`,
          sourceStageIds: [`PSY-00${index + 1}`],
          evidenceStatus: "directional",
          evidenceRefs: [{ objectType: "consumer_psychology_stage", id: `PSY-00${index + 1}` }],
          validationNeeded: ["完成对应验证"],
        })),
        boundary: "营销表达不能比来源心理节点拥有更高证据等级。",
      },
    }} />);
    expect(screen.getByText("心理链如何转成营销表达")).toBeInTheDocument();
    expect(screen.getByText("Hook · 为什么停下来")).toBeInTheDocument();
    expect(screen.getByText("CTA · 下一步做什么")).toBeInTheDocument();
  });
});
