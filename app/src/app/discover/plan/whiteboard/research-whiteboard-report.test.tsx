import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("research whiteboard report sources", () => {
  it("opens the referenced source list instead of showing only source codes", () => {
    render(<ResearchWhiteboardReport modules={modules} sources={sources} />);

    expect(screen.queryByText(/SRC-001、SRC-002/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看 2 个信源" }));

    expect(screen.getByRole("dialog", { name: "本条结论引用的信源" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /市场趋势资料/ })).toHaveAttribute("href", "https://example.com/market");
    expect(screen.getByRole("link", { name: /用户讨论/ })).toHaveAttribute("href", "https://example.com/community");
  });
});
