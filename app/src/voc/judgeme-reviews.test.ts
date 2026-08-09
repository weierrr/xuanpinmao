import { describe, expect, it, vi } from "vitest";
import { collectJudgeMeReviews } from "./judgeme-reviews";

const widget = (id: string, body: string, rating = 5) => ({
  html: `<div class="jdgm-rev" data-review-id="${id}" data-verified-buyer="true">
    <span class="jdgm-rev__rating" data-score="${rating}"></span>
    <span class="jdgm-rev__timestamp" data-content="2026-07-20"></span>
    <span class="jdgm-rev__author">Discard Me</span>
    <div class="jdgm-rev__body"><p>${body}</p></div>
  </div>`,
});

describe("Judge.me public review adapter", () => {
  it("paginates, strips identity and stops on an empty page", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(widget("R-1", "Soft and opaque.")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(widget("R-2", "Waistband rolls.", 2)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ html: "<div></div>" }), { status: 200 }));
    const result = await collectJudgeMeReviews({
      productUrl: "https://example.com/products/leggings",
      shopDomain: "example.myshopify.com",
      productId: "123",
      fetchImpl: fetchImpl as typeof fetch,
      maxPages: 5,
    });
    expect(result.reviews).toHaveLength(2);
    expect(result.pagesRead).toBe(3);
    expect(JSON.stringify(result)).not.toContain("Discard Me");
  });

  it("deduplicates review IDs and normalized bodies", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(widget("R-1", "Soft and opaque.")), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(widget("R-1", "Soft and opaque.")), { status: 200 }));
    const result = await collectJudgeMeReviews({
      productUrl: "https://example.com/products/leggings",
      shopDomain: "example.myshopify.com",
      productId: "123",
      fetchImpl: fetchImpl as typeof fetch,
      maxPages: 2,
    });
    expect(result.reviews).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });
});
