import { cleanup, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkbenchShell } from "./workbench-shell";
import { restorableWorkbenchHref, WorkbenchLink } from "./workbench-link";

describe("active workbench route", () => {
  it("keeps only a valid research whiteboard as the resumable destination", () => {
    expect(restorableWorkbenchHref(
      "/discover/plan/whiteboard?discoveryId=discovery-water-filter-123abc-us",
    )).toBe("/discover/plan/whiteboard?discoveryId=discovery-water-filter-123abc-us");
    expect(restorableWorkbenchHref("/discover")).toBeNull();
    expect(restorableWorkbenchHref("https://example.com/discover/plan/whiteboard?discoveryId=bad"))
      .toBeNull();
  });

  it("returns from the home page to the whiteboard last opened in this browser", async () => {
    const whiteboardHref = "/discover/plan/whiteboard?discoveryId=discovery-water-filter-123abc-us";
    window.localStorage.clear();
    window.history.replaceState({}, "", whiteboardHref);

    const whiteboard = render(<WorkbenchLink>选品工作台</WorkbenchLink>);
    await waitFor(() => expect(whiteboard.getByRole("link")).toHaveAttribute("href", whiteboardHref));
    whiteboard.unmount();

    window.history.replaceState({}, "", "/");
    const home = render(<WorkbenchLink>选品工作台</WorkbenchLink>);
    await waitFor(() => expect(home.getByRole("link")).toHaveAttribute("href", whiteboardHref));
    cleanup();
  });
});

describe("branded workbench shell", () => {
  it("keeps the current task focused without exposing a cross-task record switcher", () => {
    const html = renderToStaticMarkup(
      <WorkbenchShell active="projects"><p>记录内容</p></WorkbenchShell>,
    );

    expect(html).toContain("多入口商品发现");
    expect(html).toContain("查看示例报告");
    expect(html).toContain(
      'href="/discover/plan/whiteboard?discoveryId=discovery-refrigerator-water-filter-demo-us"',
    );
    expect(html).not.toContain('href="/projects"');
    expect(html).not.toContain("选品记录");
    expect(html).not.toContain('href="/discover/network"');
    expect(html).not.toContain("人群需求网络");
    expect(html).toContain('class="site-top-navigation"');
    expect(html).toContain("首页");
    expect(html).toContain("选品工作台");
    expect(html).not.toContain("workspace-rail");
    expect(html).toContain("记录内容");
  });

  it("can remove the generic workbench title on a product-specific report page", () => {
    const html = renderToStaticMarkup(
      <WorkbenchShell active="discover" hideTitle><p>冰箱滤芯报告</p></WorkbenchShell>,
    );

    expect(html).not.toContain("PRODUCT RESEARCH WORKBENCH");
    expect(html).not.toContain("多入口商品发现");
    expect(html).toContain("workspace-main-titleless");
    expect(html).toContain("冰箱滤芯报告");
  });
});
