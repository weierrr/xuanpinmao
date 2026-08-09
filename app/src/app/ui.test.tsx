import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageHeader } from "./components";
import { ExportButton } from "./actions/ExportButton";

describe("fixture UI", () => {
  it("shows fixture label and formal status", () => {
    render(<PageHeader title="项目列表" subtitle="fixture" status="HOLD_SUPPLY" />);

    expect(screen.getByText("测试数据")).toBeInTheDocument();
    expect(screen.getByText("暂缓正式供货")).toBeInTheDocument();
  });

  it("distinguishes live research from fixture data", () => {
    render(<PageHeader title="连续选品机会" subtitle="live" dataOrigin="live" />);

    expect(screen.getByText("真实研究")).toBeInTheDocument();
    expect(screen.queryByText("测试数据")).not.toBeInTheDocument();
  });

  it("exports reports from the action button", async () => {
    const user = userEvent.setup();
    const response = Response.json({
      markdownPath: "/tmp/T21_report.md",
      htmlPath: "/tmp/T21_report.html",
      version: 1,
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    render(<ExportButton runId="T21-full-20260714" />);
    await user.click(screen.getByRole("button", { name: /导出报告/ }));

    await waitFor(() => expect(screen.getByText(/Markdown:/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/runs/T21-full-20260714/export", { method: "POST" });
  });
});
