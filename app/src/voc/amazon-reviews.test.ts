import { describe, expect, it, vi } from "vitest";
import {
  collectBrightDataAmazonReviews,
  normalizeBrightDataReview,
} from "./amazon-reviews";

describe("Bright Data Amazon review adapter", () => {
  it("normalizes provider aliases without retaining reviewer identity", () => {
    expect(normalizeBrightDataReview({
      asin: "B08SLZPCCV",
      review_id: "R-001",
      review_text: "Soft fabric and the waistband stayed in place.",
      rating: 5,
      review_date: "2026-07-20",
      verified_purchase: true,
      reviewer_name: "Must not be retained",
      product_variation: "Black / Medium",
      url: "https://www.amazon.com/dp/B08SLZPCCV?ref_=tracking",
    })).toEqual({
      asin: "B08SLZPCCV",
      reviewId: "R-001",
      reviewText: "Soft fabric and the waistband stayed in place.",
      rating: 5,
      reviewDate: "2026-07-20",
      verifiedPurchase: true,
      variation: "Black / Medium",
      productUrl: "https://www.amazon.com/dp/B08SLZPCCV",
    });
  });

  it("runs an asynchronous snapshot and rejects incomplete rows", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ snapshot_id: "snap-123" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          asin: "B08SLZPCCV",
          review_id: "R-001",
          review_text: "The fabric is opaque and comfortable.",
          rating: 5,
          verified_purchase: true,
        },
        { asin: "B08SLZPCCV", review_id: "R-002", rating: 2 },
      ]), { status: 200 }));

    const result = await collectBrightDataAmazonReviews({
      token: "test-token",
      asins: ["B08SLZPCCV"],
      maxReviewsPerAsin: 100,
      fetchImpl: fetchImpl as typeof fetch,
      pollIntervalMs: 0,
      maxPolls: 3,
    });

    expect(result.snapshotId).toBe("snap-123");
    expect(result.reviews).toHaveLength(1);
    expect(result.rejectedRows).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual([{
      url: "https://www.amazon.com/dp/B08SLZPCCV",
      max_reviews: 100,
      variation_specific: false,
      reviews_to_not_include: [],
    }]);
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain("reviewer_name");
  });

  it("fails closed when no token or invalid ASIN is supplied", async () => {
    await expect(collectBrightDataAmazonReviews({
      token: "",
      asins: ["B08SLZPCCV"],
      maxReviewsPerAsin: 100,
    })).rejects.toThrow("Missing BRIGHTDATA_API_TOKEN");

    await expect(collectBrightDataAmazonReviews({
      token: "test-token",
      asins: ["bad"],
      maxReviewsPerAsin: 100,
    })).rejects.toThrow("Invalid Amazon ASIN");
  });
});
