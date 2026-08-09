import { describe, expect, it } from "vitest";
import { sellerDecisionFor } from "./service";

describe("seller-facing business decision", () => {
  it("answers the four questions a seller asks before sourcing", () => {
    const card = sellerDecisionFor("research-run-3d-yoga-pants-28f8bff32ab5-us");

    expect(card?.primaryVerdict).toBe("值得找样验证，不值得直接备货");
    expect(card?.signals.map((signal) => signal.key)).toEqual([
      "market",
      "competition",
      "crowding",
      "whitespace",
    ]);
    expect(card?.signals.find((signal) => signal.key === "competition")?.evidenceLabel)
      .toBe("初步判断");
  });

  it("does not attach yoga-specific conclusions to another run", () => {
    expect(sellerDecisionFor("research-run-another-product-us")).toBeNull();
  });
});
