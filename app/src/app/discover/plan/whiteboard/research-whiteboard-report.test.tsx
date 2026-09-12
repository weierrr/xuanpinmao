import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResearchWhiteboardReport } from "./research-whiteboard-report";
import type { ResearchWhiteboardReportModule, ResearchWhiteboardSource } from "@/research-whiteboard/types";

const modules: ResearchWhiteboardReportModule[] = [{
  code: "market",
  title: "市场与机会",
  question: "有没有市场。",
  conclusion: "有需求，但需要继续验证。",
  items: [{ text: "需求仍然存在。", level: "fact", sourceIds: ["SRC-001", "SRC-002"] }],
  unknowns: [],
  updatedAt: "2026-08-11T00:00:00.000Z",
}];

const sources: ResearchWhiteboardSource[] = [
  { id: "SRC-001", label: "市场趋势资料", url: "https://example.com/market", kind: "market", status: "verified" },
  { id: "SRC-002", label: "用户讨论", url: "https://example.com/community", kind: "community", status: "candidate" },
];

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("research whiteboard report sources", () => {
  it("opens the referenced source list instead of showing only source codes", () => {
    render(<ResearchWhiteboardReport modules={modules} sources={sources} />);

    expect(screen.queryByText(/SRC-001、SRC-002/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看 2 个信源" }));

    expect(screen.getByRole("dialog", { name: "本条结论引用的信源" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /市场趋势资料/ })).toHaveAttribute("href", "https://example.com/market");
    expect(screen.getByRole("link", { name: /用户讨论/ })).toHaveAttribute("href", "https://example.com/community");
  });

  it("switches report modules through presentation-style tabs", () => {
    const second = { ...modules[0], code: "customer" as const, title: "用户画像", conclusion: "用户关注兼容与安装。" };
    render(<ResearchWhiteboardReport modules={[modules[0], second]} sources={sources} />);
    expect(screen.getByRole("heading", { name: "市场与机会" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /用户画像/ }));
    expect(screen.getByRole("heading", { name: "用户画像" })).toBeInTheDocument();
    expect(screen.getAllByText("人群与任务明确，规模待验证").length).toBeGreaterThan(0);
    expect(screen.queryByText("基于当前 Run")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "市场与机会" })).not.toBeInTheDocument();
  });

  it("summarizes the active market module from current run data", () => {
    render(<ResearchWhiteboardReport modules={modules} sources={sources} />);
    expect(screen.getByText("公开市场信源")).toBeInTheDocument();
    expect(screen.getAllByText("2 个").length).toBeGreaterThan(0);
    expect(screen.getByText("1 条")).toBeInTheDocument();
  });

  it("uses the active module conclusion instead of a category-specific fallback", () => {
    render(<ResearchWhiteboardReport modules={modules} sources={sources} />);
    expect(screen.getAllByText("有需求，但需要继续验证。").length).toBeGreaterThan(0);
    expect(screen.queryByText(/EDR1RXD1|冰箱滤芯/)).not.toBeInTheDocument();
  });

  it("splits a long conclusion into a lead judgment and scannable points", () => {
    render(<ResearchWhiteboardReport modules={[{
      ...modules[0],
      conclusion: "值得继续研究，但不是低竞争机会。需求真实存在；12/15 名用户通过后再升级。RESEARCH_MORE：暂不买样。",
    }]} sources={sources} />);

    const conclusion = screen.getByRole("region", { name: "核心结论" });
    expect(within(conclusion).getByText("值得继续研究，但不是低竞争机会。")).toBeInTheDocument();
    expect(within(conclusion).getByText(/需求真实存在/)).toBeInTheDocument();
    expect(within(conclusion).getByText("12/15 名", { selector: "mark" })).toBeInTheDocument();
    expect(within(conclusion).getByText("RESEARCH_MORE", { selector: "mark" })).toBeInTheDocument();
    expect(within(conclusion).getByText(/暂不买样/)).toBeInTheDocument();
    expect(within(conclusion).getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows the current research basis instead of leaving metrics without scope", () => {
    render(<ResearchWhiteboardReport modules={modules} sources={sources} scope={{
      product: "厨卫清洁起步系统",
      market: "US",
      channel: "independent_dtc",
      researchRunId: "research-run-current",
      updatedAt: "2026-08-17T12:00:00.000Z",
      queryCount: 25,
      recordCount: 20,
    }} />);

    const basis = screen.getByRole("region", { name: "研究口径" });
    expect(within(basis).getByText("厨卫清洁起步系统")).toBeInTheDocument();
    expect(within(basis).getByText("US · independent_dtc")).toBeInTheDocument();
    expect(within(basis).getByText("research-run-current")).toBeInTheDocument();
    expect(within(basis).getByText("25 条")).toBeInTheDocument();
  });

  it("shows cited source-family coverage and an explicit action gate", () => {
    render(<ResearchWhiteboardReport modules={[{
      ...modules[0],
      items: [
        ...modules[0].items,
        { text: "行动验收：补齐同口径趋势和价格矩阵后再升级。", level: "hypothesis", sourceIds: ["SRC-001"] },
      ],
      unknowns: ["连续趋势仍未取得。"],
    }]} sources={sources} />);

    const insight = screen.getByRole("region", { name: "证据覆盖与行动验收" });
    expect(within(insight).getByText("市场数据")).toBeInTheDocument();
    expect(within(insight).getByText("用户社区")).toBeInTheDocument();
    expect(within(insight).getByText("补齐同口径趋势和价格矩阵后再升级。")).toBeInTheDocument();
    expect(within(insight).getByText("连续趋势仍未取得。")).toBeInTheDocument();
  });

  it("shows structured VOC without inventing sentiment percentages", () => {
    const customer: ResearchWhiteboardReportModule = {
      ...modules[0],
      code: "customer",
      title: "用户画像",
      items: [
        { text: "用户原声证据：希望减少清洁用品。", level: "fact", sourceIds: ["SRC-002"] },
        { text: "焦虑：不知道该买什么。", level: "fact", sourceIds: ["SRC-002"] },
      ],
      unknowns: ["Marketplace 评论正文：0 条"],
      voc: {
        unit: "discussion_thread",
        totalRecords: 20,
        channels: [{ key: "reddit", label: "Reddit / r/CleaningTips", count: 20, sourceIds: ["SRC-002"] }],
        sentiments: [{ key: "unknown", label: "未逐条编码", count: 20 }],
        themes: [{ key: "simplify", label: "减少选择负担", count: 8, sourceIds: ["SRC-002"] }],
        scenarios: [{ key: "first-home", label: "首次独立居住", count: 4, sourceIds: ["SRC-002"] }],
        sampleBoundary: "自选社区讨论，只表示当前语料覆盖，不代表总体发生率。",
        gaps: ["Marketplace 评论正文：0 条"],
      },
    };
    render(<ResearchWhiteboardReport modules={[customer]} sources={sources} />);

    const voc = screen.getByRole("region", { name: "用户声音覆盖" });
    expect(within(voc).getByText("Reddit / r/CleaningTips")).toBeInTheDocument();
    expect(within(voc).getByText("未逐条编码")).toBeInTheDocument();
    expect(within(voc).getByText("本轮没有逐条情绪标注，禁止推断满意度。")).toBeInTheDocument();
    expect(within(voc).getByText("Marketplace 评论正文：0 条")).toBeInTheDocument();
    expect(screen.getAllByText("用户原声证据：希望减少清洁用品。").length).toBeGreaterThan(0);
    expect(within(voc).queryByText(/正面 \d+%|负面 \d+%/)).not.toBeInTheDocument();
  });

  it("externalizes the score formula and the information required for a full score", () => {
    render(<ResearchWhiteboardReport modules={modules} sources={sources} />);
    fireEvent.click(screen.getByRole("button", { name: "查看评分依据与满分缺口" }));
    expect(screen.getByText("计算公式")).toBeInTheDocument();
    expect(screen.getByText(/总分 = 各维度得分之和/)).toBeInTheDocument();
    expect(screen.getAllByText("计分规则").length).toBeGreaterThan(0);
    expect(screen.getAllByText("满分条件").length).toBeGreaterThan(0);
    expect(screen.getByText(/当前还差/)).toBeInTheDocument();
  });

  it("filters the active module by evidence level", () => {
    const filterModules: ResearchWhiteboardReportModule[] = [{
      ...modules[0],
      items: [
        { text: "已经核验的市场事实。", level: "fact", sourceIds: ["SRC-001"] },
        { text: "仍需交叉验证的趋势。", level: "directional", sourceIds: ["SRC-002"] },
        { text: "准备通过样品验证的假设。", level: "hypothesis", sourceIds: [] },
      ],
    }];
    render(<ResearchWhiteboardReport modules={filterModules} sources={sources} />);

    const evidenceTitle = screen.getByText("证据与行动");
    const evidenceFilter = screen.getByRole("region", { name: "按证据等级快速筛选" });
    expect(evidenceTitle.compareDocumentPosition(evidenceFilter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "事实证据 1" }));
    const evidenceList = document.querySelector(".research-whiteboard-report-evidence-list");
    expect(evidenceList).not.toBeNull();
    expect(within(evidenceList as HTMLElement).getByText("已经核验的市场事实。")).toBeInTheDocument();
    expect(within(evidenceList as HTMLElement).queryByText("仍需交叉验证的趋势。")).not.toBeInTheDocument();
    expect(screen.getByText("当前显示 1 / 3 条 · 0 项缺口")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /未知 \/ 缺口/ })).not.toBeInTheDocument();
  });

  it("resets to all when the selected evidence level is absent from the next tab", () => {
    const first = {
      ...modules[0],
      items: [{ text: "准备验证的市场假设。", level: "hypothesis" as const, sourceIds: [] }],
    };
    const second = {
      ...modules[0],
      code: "product" as const,
      title: "产品方案",
      items: [{ text: "已经核验的产品事实。", level: "fact" as const, sourceIds: ["SRC-001"] }],
    };
    render(<ResearchWhiteboardReport modules={[first, second]} sources={sources} />);

    fireEvent.click(screen.getByRole("button", { name: "待验证假设 1" }));
    fireEvent.click(screen.getByRole("button", { name: "02 产品方案" }));

    expect(screen.queryByRole("button", { name: /待验证假设/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "全部 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "事实证据 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("已经核验的产品事实。").length).toBeGreaterThan(0);
  });

  it("hides the filter bar when the active module has no evidence", () => {
    render(<ResearchWhiteboardReport modules={[{ ...modules[0], items: [] }]} sources={sources} />);

    expect(screen.queryByRole("region", { name: "按证据等级快速筛选" })).not.toBeInTheDocument();
    expect(screen.getByText("当前模块还没有可展示的证据。")).toBeInTheDocument();
  });

  it("opens the requested tab when the whiteboard dispatches a report navigation event", () => {
    const second = { ...modules[0], code: "product" as const, title: "产品方案", conclusion: "进入受控寻源与买样。" };
    render(<ResearchWhiteboardReport modules={[modules[0], second]} sources={sources} />);

    act(() => {
      window.dispatchEvent(new CustomEvent("xuanpinmao:open-report-module", { detail: { code: "product" } }));
    });

    expect(screen.getByRole("heading", { name: "产品方案" })).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });
});
