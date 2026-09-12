import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteTopNavigation } from "./site-top-navigation";

describe("site top navigation brand", () => {
  it("uses a distinctive display face only for the Xuanpinmao wordmark", () => {
    const html = renderToStaticMarkup(<SiteTopNavigation active="home" />);

    expect(html).toContain('aria-label="选品猫首页"');
    expect(html).toContain('data-brand-font="alimama-shu-hei-ti"');
    expect(html).toContain("font-size:20px");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("选品猫</strong>");
    expect(html).not.toContain("在线分析");
  });
});
