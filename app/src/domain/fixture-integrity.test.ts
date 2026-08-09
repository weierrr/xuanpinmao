import { validateClaimSourceIntegrity } from "./claim-source";
import { validateFormalDecision } from "./formal-status";
import { validateRiskModules } from "./risk-modules";
import { loadT21Fixture } from "@/infrastructure/fixture";

describe("T21 fixture integrity", () => {
  it("keeps the frozen T21 baseline counts and source mapping", async () => {
    const fixture = await loadT21Fixture();
    const integrity = validateClaimSourceIntegrity(fixture.sources, fixture.claims);

    expect(fixture.sources).toHaveLength(25);
    expect(fixture.claims).toHaveLength(77);
    expect(integrity.forwardReferenceValid).toBe(true);
    expect(integrity.orphanClaimIds).toEqual([]);
    expect(integrity.mappingMismatchCount).toBe(0);
  });

  it("keeps all 15 modules and module count dimensions valid", async () => {
    const fixture = await loadT21Fixture();
    const result = validateRiskModules(fixture.riskModules);

    expect(result.moduleCount).toBe(15);
    expect(result.baselineCount).toBe(6);
    expect(result.conditionalCount).toBe(9);
    expect(result.irrelevantExecutionValid).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("keeps HOLD_SUPPLY as one formal status with actions disabled", async () => {
    const fixture = await loadT21Fixture();
    const result = validateFormalDecision([fixture.decision]);

    expect(fixture.decision.formalStatus).toBe("HOLD_SUPPLY");
    expect(fixture.decision.listingAllowed).toBe(false);
    expect(fixture.decision.adTestAllowed).toBe(false);
    expect(result.valid).toBe(true);
  });

  it("has zero unicode replacement characters in fixture strings", async () => {
    const fixture = await loadT21Fixture();
    expect(JSON.stringify(fixture).includes("\uFFFD")).toBe(false);
  });
});
