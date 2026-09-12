import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BlogPage from "./page";
import BlogArticlePage from "./[slug]/page";
import { isStandaloneLandingPath } from "../app-shell";

describe("product research blog", () => {
  it("uses the public full-width shell instead of the internal workbench sidebar", () => {
    expect(isStandaloneLandingPath("/blog")).toBe(true);
    expect(isStandaloneLandingPath("/blog/product-research-before-sourcing")).toBe(true);
  });

  it("shows categories, reading outcomes, and article links", () => {
    const html = renderToStaticMarkup(<BlogPage />);
    expect(html).toContain("选品猫研究手记");
    expect(html).toContain("选品方法");
    expect(html).toContain("读完得到");
    expect(html).toContain('/blog/product-research-before-sourcing');
  });

  it("renders a traceable article structure", async () => {
    const page = await BlogArticlePage({ params: Promise.resolve({ slug: "product-research-before-sourcing" }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("本文目录");
    expect(html).toContain("判断");
    expect(html).toContain("证据");
    expect(html).toContain("行动");
  });
});
