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
    expect(html).toContain('href="/discover"');
    expect(html).not.toContain('href="/projects"');
    expect(html).not.toContain("选品记录");
    expect(html).not.toContain('href="/discover/network"');
    expect(html).not.toContain("人群需求网络");
    expect(html).toContain("记录内容");
  });
});
