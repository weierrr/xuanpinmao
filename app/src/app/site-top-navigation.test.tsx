import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SiteTopNavigation } from "./site-top-navigation";

vi.mock("next/font/google", () => ({
  Noto_Sans_SC: () => ({ className: "noto-sans-sc-black" }),
}));

describe("site top navigation brand", () => {
  it("uses a distinctive display face only for the Xuanpinmao wordmark", () => {
    const html = renderToStaticMarkup(<SiteTopNavigation active="home" />);

    expect(html).toContain('aria-label="选品猫首页"');
    expect(html).toContain('data-brand-font="noto-sans-sc-black"');
    expect(html).toContain("font-size:20px");
    expect(html).toContain("font-weight:900");
    expect(html).toContain("选品猫</strong>");
  });
});
