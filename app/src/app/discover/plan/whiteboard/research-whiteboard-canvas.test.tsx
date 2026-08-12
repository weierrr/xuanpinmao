import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOpportunityDiscoveryPlan } from "@/opportunity-discovery/service";
import { createResearchWhiteboard } from "@/research-whiteboard/service";
import { ResearchWhiteboardCanvas } from "./research-whiteboard-canvas";

const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");

const whiteboardFixture = () => {
  const plan = createOpportunityDiscoveryPlan({
    categoryKeyword: "冰箱滤芯 LT700P 型号",
    targetMarket: "US",
    salesChannel: "independent_dtc",
  });
  const whiteboard = createResearchWhiteboard(plan, new Date("2026-08-10T00:00:00.000Z"));
  whiteboard.stages.market = {
    ...whiteboard.stages.market,
    queryCount: 18,
    sourceCount: 2,
    recordCount: 3,
    sources: [
      { id: "SRC-LG", label: "LG LT700P 官方商品页", url: "https://www.lg.com/lt700p", kind: "competitor", status: "verified" },
      { id: "SRC-NSF", label: "NSF 认证目录", url: "https://info.nsf.org/", kind: "official", status: "candidate" },
    ],
  };
  return { plan, whiteboard };
};

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1000 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 640 });
  HTMLElement.prototype.scrollTo = vi.fn();
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
});

afterEach(() => {
  if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
  if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
  vi.restoreAllMocks();
});

describe("research whiteboard canvas interactions", () => {
  it("opens every source for a lane in a right-side drawer and closes it with Escape", async () => {
    const { whiteboard } = whiteboardFixture();
    render(<ResearchWhiteboardCanvas whiteboard={whiteboard} />);

    expect(screen.queryByText("来自 lg.com、info.nsf.org。")).not.toBeInTheDocument();
    expect(screen.queryByText("2 个信源")).not.toBeInTheDocument();
    expect(screen.getAllByText("查看全部信源").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "查看市场证据的全部 2 个信源" }));

    const drawer = screen.getByRole("dialog", { name: "市场证据" });
    expect(drawer).toHaveTextContent("2 个保留信源 · 1 个已核验");
    expect(screen.getByRole("link", { name: /LG LT700P 官方商品页/ })).toHaveAttribute("href", "https://www.lg.com/lt700p");
    expect(screen.getByRole("link", { name: /NSF 认证目录/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "全部 2 个信源" })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "市场证据" })).not.toBeInTheDocument());
  });

  it("keeps analysis cards concise and opens the full conclusion in a right-side drawer", async () => {
    const { whiteboard } = whiteboardFixture();
    const fullConclusion = "这个品类存在真实替换需求，但兼容型号、认证边界与漏水风险仍需通过样品和供应商文件继续核查。";
    whiteboard.stages.synthesis = { ...whiteboard.stages.synthesis, summary: fullConclusion };
    render(<ResearchWhiteboardCanvas whiteboard={whiteboard} />);

    expect(screen.queryByText(fullConclusion)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看价格、趋势与竞争强度的完整分析" }));

    const drawer = screen.getByRole("dialog", { name: "价格、趋势与竞争强度" });
    expect(drawer).toHaveTextContent("核心结论");
    expect(drawer).toHaveTextContent(fullConclusion);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "价格、趋势与竞争强度" })).not.toBeInTheDocument());
  });

  it("keeps collection cards inside their bounds and moves process details into a drawer", async () => {
    const { whiteboard } = whiteboardFixture();
    render(<ResearchWhiteboardCanvas whiteboard={whiteboard} />);

    expect(screen.queryByText("完成检索、筛选、去重和有效性判断，形成可用于本轮分析的证据记录。")).not.toBeInTheDocument();
    expect(screen.queryByText("保留 2 个来源")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看市场证据的采集详情" }));

    const drawer = screen.getByRole("dialog", { name: "市场证据处理" });
    expect(drawer).toHaveTextContent("18 次");
    expect(drawer).toHaveTextContent("2 个");
    expect(drawer).toHaveTextContent("3 条");
    expect(drawer).toHaveTextContent("筛除无关、重复或无法核验的内容");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "市场证据处理" })).not.toBeInTheDocument());
  });

  it("uses a control-wheel trackpad pinch to zoom around the gesture point", async () => {
    const { whiteboard } = whiteboardFixture();
    const { container } = render(<ResearchWhiteboardCanvas whiteboard={whiteboard} />);
    const viewport = container.querySelector<HTMLElement>(".whiteboard-canvas-viewport");
    const zoomOutput = screen.getByText(/%$/);
    expect(viewport).not.toBeNull();
    const initialZoom = Number(zoomOutput.textContent?.replace("%", ""));
    const pinch = new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -30, clientX: 500, clientY: 260 });

    act(() => {
      viewport?.dispatchEvent(pinch);
    });

    await waitFor(() => expect(Number(zoomOutput.textContent?.replace("%", ""))).toBeGreaterThan(initialZoom));
    expect(pinch.defaultPrevented).toBe(true);
    expect(Number.parseFloat(viewport?.style.getPropertyValue("--whiteboard-dot-grid") ?? "0")).toBeGreaterThan(18 * initialZoom / 100);
    expect(Number.parseFloat(viewport?.style.getPropertyValue("--whiteboard-dot-radius") ?? "0")).toBeGreaterThan(initialZoom / 100);
  });

  it("keeps the fitted canvas centered and prevents unreadably small zoom levels", async () => {
    const { whiteboard } = whiteboardFixture();
    const { container } = render(<ResearchWhiteboardCanvas whiteboard={whiteboard} />);
    const viewport = container.querySelector<HTMLElement>(".whiteboard-canvas-viewport");
    const stage = container.querySelector<HTMLElement>(".whiteboard-canvas-stage");
    const zoomOutput = screen.getByText(/%$/);

    await waitFor(() => expect(zoomOutput).toHaveTextContent("57%"));
    expect(Number.parseFloat(stage?.style.width ?? "0")).toBeCloseTo(952, 5);
    expect(Number.parseFloat(viewport?.style.getPropertyValue("--whiteboard-scaled-height") ?? "0")).toBeCloseTo(567.76, 1);
    expect(container.querySelectorAll(".whiteboard-report-node li a svg")).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: "缩小白板" }));
    await waitFor(() => expect(zoomOutput).toHaveTextContent("50%"));
    expect(screen.getByRole("button", { name: "缩小白板" })).toBeDisabled();
  });
});
