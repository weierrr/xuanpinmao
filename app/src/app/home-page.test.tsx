import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";
import GuidePage from "./guide/page";

describe("product-led public pages", () => {
  it("explains the product through evidence, research depth, extensibility, and report output", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("数据都有出处");
    expect(html).toContain("选品心里有数");
    expect(html).not.toContain("数据都有出处，");
    expect(html).not.toContain("选品心里有数。");
    expect(html).toContain('class="home-story-proof" data-icon-size="22"');
    expect(html).toContain("完整过程都在一张白板上实时展开");
    expect(html).not.toContain("不是研究结束后才生成文档");
    expect(html).toContain("最让人有安全感的选品调研工具");
    expect(html).toContain("第一性原理");
    expect(html).toContain("第三方 MCP");
    expect(html).toContain("六份报告");
    expect(html).toContain("暂停流程动画");
    expect(html).not.toContain("RESEARCH AGENT / 调研过程");
    expect(html).toContain("常见问题");
    expect(html).toContain("能力档位和费用都由你控制");
    expect(html).toContain("继续追问、补充证据和更新结论");
    expect(html).toContain("home-source-logo");
    expect(html).toContain("site-top-brand-logo");
    expect(html).toContain('href="/guide"');
    expect(html).toContain("查看示例报告");
    expect(html).toContain(
      'href="/discover/plan/whiteboard?discoveryId=discovery-3d-yoga-pants-999d4e8e5cc2-us"',
    );

    expect(html.indexOf("数据都有出处")).toBeLessThan(html.indexOf("六个经营问题"));
    expect(html.indexOf("六个经营问题")).toBeLessThan(html.indexOf("接入你的数据工具栈"));
  });

  it("provides a visual guide route with a reserved video area", () => {
    const html = renderToStaticMarkup(<GuidePage />);

    expect(html).toContain("使用说明 / 图文版");
    expect(html).toContain("演示视频即将加入");
    expect(html).toContain("四步完成一轮可追溯调研");
    expect(html).toContain("关键词");
    expect(html).toContain("商品图片");
    expect(html).toContain("竞品链接");
    expect(html).toContain("演示在 Codex 对话中唤醒选品猫");
    expect(html).toContain("演示同时填写关键词、商品图片和竞品链接");
    expect(html).toContain("演示确认研究对象后开始调研");
    expect(html).toContain("演示调研过程在实时白板中持续更新");
  });

  it("keeps page text at or above the 16px readability floor outside compact product interfaces", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const cssWithoutCompactInterfaces = css
      .replace(/\.research-demo \{[\s\S]*?(?=@keyframes research-demo-pulse)/, "")
      .replace(/\.research-whiteboard-scope dt \{[^}]+\}/g, "")
      .replace(/\.research-whiteboard-scope dd \{[^}]+\}/g, "");
    const fontDeclarations = cssWithoutCompactInterfaces.match(/(?:font-size|font)\s*:[^;{}]+/g) ?? [];
    const undersized = fontDeclarations.filter((declaration) =>
      [...declaration.matchAll(/([0-9]*\.?[0-9]+)px/g)].some((match) => Number(match[1]) < 16),
    );

    expect(undersized).toEqual([]);
  });

  it("keeps the product research animation compact but legible", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain(".research-demo-window-bar { font-size: 11px; }");
    expect(css).toContain(".research-demo-stage > header b { font-size: 14px; }");
    expect(css).toContain(".research-demo-terminal span { font-size: 9px; }");
    expect(css).toContain(".research-demo-footer > p { font-size: 11px; }");
  });

  it("keeps whiteboard scope metadata compact and lighter", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain(".research-whiteboard-scope dt { color: #777; font: 14px/1");
    expect(css).toContain("font-size: 14px; font-weight: 650");
  });
});
