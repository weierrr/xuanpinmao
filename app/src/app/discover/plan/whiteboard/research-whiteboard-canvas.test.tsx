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
    const { plan, whiteboard } = whiteboardFixture();
    render(<ResearchWhiteboardCanvas whiteboard={whiteboard} keyword={plan.categoryKeyword} imageCount={0} competitorUrlCount={0} />);

    fireEvent.click(screen.getByRole("button", { name: "全部 2 个信源" }));

    const drawer = screen.getByRole("dialog", { name: "市场证据" });
    expect(drawer).toHaveTextContent("18 次检索 · 2 个保留信源 · 3 条有效判断");
    expect(screen.getByRole("link", { name: /LG LT700P 官方商品页/ })).toHaveAttribute("href", "https://www.lg.com/lt700p");
    expect(screen.getByRole("link", { name: /NSF 认证目录/ })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "市场证据" })).not.toBeInTheDocument());
  });

  it("uses a control-wheel trackpad pinch to zoom around the gesture point", async () => {
    const { plan, whiteboard } = whiteboardFixture();
    const { container } = render(<ResearchWhiteboardCanvas whiteboard={whiteboard} keyword={plan.categoryKeyword} imageCount={0} competitorUrlCount={0} />);
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
  });
});
