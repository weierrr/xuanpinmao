import type { DecisionRecord, FormalStatus } from "./types";

export const formalStatuses: FormalStatus[] = [
  "GO_TEST",
  "HOLD_DATA",
  "HOLD_RISK",
  "HOLD_ECON",
  "HOLD_SUPPLY",
  "HOLD_CONFLICT",
  "NO_GO_HARD_GATE",
  "NO_GO_ECON",
  "NO_GO_DEMAND",
];

export type FormalStatusValidation = {
  statusAllowed: boolean;
  singleFormalStatus: boolean;
  actionsConsistent: boolean;
  valid: boolean;
  errors: string[];
};

export const validateFormalDecision = (decisions: DecisionRecord[]): FormalStatusValidation => {
  const errors: string[] = [];
  const singleFormalStatus = decisions.length === 1;
  const decision = decisions[0];
  const statusAllowed = decision ? formalStatuses.includes(decision.formalStatus) : false;
  let actionsConsistent = false;

  if (!singleFormalStatus) {
    errors.push("每个ResearchRun必须且只能有一个正式状态");
  }
  if (!statusAllowed) {
    errors.push("正式状态不在允许枚举内");
  }
  if (decision?.formalStatus === "HOLD_SUPPLY") {
    actionsConsistent = decision.listingAllowed === false && decision.adTestAllowed === false;
    if (!actionsConsistent) {
      errors.push("HOLD_SUPPLY下Listing和广告测试必须不允许");
    }
  } else if (decision?.formalStatus === "GO_TEST") {
    actionsConsistent = decision.listingAllowed && decision.adTestAllowed;
    if (!actionsConsistent) {
      errors.push("GO_TEST必须与Listing和广告动作一致");
    }
  } else {
    actionsConsistent = decision !== undefined;
  }

  return {
    statusAllowed,
    singleFormalStatus,
    actionsConsistent,
    valid: singleFormalStatus && statusAllowed && actionsConsistent,
    errors,
  };
};
