import type { ClaimRecord, SourceLedgerRecord, SourceRecord } from "./types";

export type ClaimSourceIntegrityResult = {
  sourceCount: number;
  claimCount: number;
  forwardReferenceValid: boolean;
  reverseReferenceValid: boolean;
  orphanClaimIds: string[];
  wrongSourceClaimIds: string[];
  mappingMismatchCount: number;
  derivedClaimIdsBySource: Record<string, string[]>;
};

export const deriveClaimIdsBySource = (claims: ClaimRecord[]): Record<string, string[]> => {
  return claims.reduce<Record<string, string[]>>((accumulator, claim) => {
    accumulator[claim.sourceId] = [...(accumulator[claim.sourceId] ?? []), claim.id].sort();
    return accumulator;
  }, {});
};

export const attachDerivedClaimIds = (
  sources: SourceRecord[],
  claims: ClaimRecord[],
): SourceLedgerRecord[] => {
  const derived = deriveClaimIdsBySource(claims);
  return sources.map((source) => ({
    ...source,
    claimIds: derived[source.id] ?? [],
  }));
};

export const validateClaimSourceIntegrity = (
  sources: SourceRecord[],
  claims: ClaimRecord[],
  recordedLedger?: SourceLedgerRecord[],
): ClaimSourceIntegrityResult => {
  const sourceIds = new Set(sources.map((source) => source.id));
  const derivedClaimIdsBySource = deriveClaimIdsBySource(claims);
  const orphanClaimIds = claims.filter((claim) => !sourceIds.has(claim.sourceId)).map((claim) => claim.id);
  const wrongSourceClaimIds =
    recordedLedger?.flatMap((source) =>
      source.claimIds.filter((claimId) => claims.find((claim) => claim.id === claimId)?.sourceId !== source.id),
    ) ?? [];
  const reverseReferenceValid = wrongSourceClaimIds.length === 0;
  const mappingMismatchCount =
    recordedLedger?.reduce((count, source) => {
      const recorded = source.claimIds.join(";");
      const derived = (derivedClaimIdsBySource[source.id] ?? []).join(";");
      return recorded === derived ? count : count + 1;
    }, 0) ?? 0;

  return {
    sourceCount: sources.length,
    claimCount: claims.length,
    forwardReferenceValid: orphanClaimIds.length === 0,
    reverseReferenceValid,
    orphanClaimIds,
    wrongSourceClaimIds,
    mappingMismatchCount,
    derivedClaimIdsBySource,
  };
};

export const competitorClaimsApplicableToTarget = (claims: ClaimRecord[]): string[] => {
  return claims
    .filter((claim) => claim.sourceType.includes("竞品") || claim.dataNature.includes("竞品"))
    .filter((claim) => claim.runSpecApplicability === "适用" && claim.decisionUse === "直接决策证据")
    .map((claim) => claim.id);
};
