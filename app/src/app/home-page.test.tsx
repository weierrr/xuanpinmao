import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";
import GuidePage from "./guide/page";

describe("product-led public pages", () => {
  it("explains the product through evidence, research depth, extensibility, and report output", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("把选品调研的全过程");
    expect(html).toContain("第一性原理");
    expect(html).toContain("第三方 MCP");
    expect(html).toContain("六份报告");
    expect(html).toContain("它查了什么、用了什么证据");
    expect(html).toContain("常见问题");
    expect(html).toContain('href="/guide"');

    expect(html.indexOf("把选品调研的全过程")).toBeLessThan(html.indexOf("六个经营问题"));
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
  });
});
