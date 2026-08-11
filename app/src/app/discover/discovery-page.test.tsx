import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DiscoveryEntryPage from "./page";

describe("discovery entry instructions", () => {
  it("shows the real three-step workflow without a repeated generic page title", async () => {
    const html = renderToStaticMarkup(
      await DiscoveryEntryPage({ searchParams: Promise.resolve({}) }),
    );

    expect(html).not.toContain("PRODUCT RESEARCH WORKBENCH");
    expect(html).not.toContain("多入口商品发现");
    expect(html).toContain("三步开始一轮选品调研");
    expect(html).toContain("填写线索");
    expect(html).toContain("确认研究对象");
    expect(html).toContain("回到 Codex 继续");
    expect(html).toContain('id="discovery-inputs"');
    expect(html).toContain("一组线索，六份调研结果");
    expect(html).toContain("市场与机会");
    expect(html).toContain("用户画像");
    expect(html).toContain("竞品分析");
    expect(html).toContain("产品方案");
    expect(html).toContain("营销打法");
    expect(html).toContain("验证方案");
    expect(html).not.toContain("四层结果");
  });
});
