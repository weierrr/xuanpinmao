import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SiteTopNavigation } from "./site-top-navigation";

vi.mock("next/font/google", () => ({
  ZCOOL_QingKe_HuangYou: () => ({ className: "zcool-qingke-huangyou" }),
}));

describe("site top navigation brand", () => {
  it("uses a distinctive display face only for the Xuanpinmao wordmark", () => {
    const html = renderToStaticMarkup(<SiteTopNavigation active="home" />);

    expect(html).toContain('aria-label="选品猫首页"');
    expect(html).toContain('data-brand-font="zcool-qingke-huangyou"');
    expect(html).toContain("font-size:22px");
    expect(html).toContain("选品猫</strong>");
  });
});
