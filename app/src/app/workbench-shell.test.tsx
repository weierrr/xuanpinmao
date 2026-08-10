import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkbenchShell } from "./workbench-shell";

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
