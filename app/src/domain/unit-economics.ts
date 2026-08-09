export type NullableMoney = number | null;

export type UnitEconomicsInput = {
  revenue: NullableMoney;
  purchase: NullableMoney;
  packaging: NullableMoney;
  domesticShipping: NullableMoney;
  internationalLogisticsOrDdp: NullableMoney;
  unlistedDutyAndClearance: NullableMoney;
  paymentFee: NullableMoney;
  refundReserve: NullableMoney;
  chargebackReserve: NullableMoney;
  defectAndReship: NullableMoney;
  otherVariableCost: NullableMoney;
};

export type UnitEconomicsResult = {
  landedCost: NullableMoney;
  grossProfit: NullableMoney;
  grossMargin: NullableMoney;
  variableOperatingCost: NullableMoney;
  cm1: NullableMoney;
  cm1Margin: NullableMoney;
  breakEvenCpa: NullableMoney;
  breakEvenRoas: NullableMoney;
  identityValid: boolean;
  missingFields: string[];
  stopReason: string | null;
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const round4 = (value: number): number => Math.round((value + Number.EPSILON) * 10000) / 10000;

const sumKnown = (values: NullableMoney[]): NullableMoney => {
  if (values.some((value) => value === null)) {
    return null;
  }
  return round2(values.reduce<number>((total, value) => total + (value ?? 0), 0));
};

export const calculateUnitEconomics = (input: UnitEconomicsInput): UnitEconomicsResult => {
  const missingFields = Object.entries(input)
    .filter(([, value]) => value === null)
    .map(([key]) => key);

  const landedCost = sumKnown([
    input.purchase,
    input.packaging,
    input.domesticShipping,
    input.internationalLogisticsOrDdp,
    input.unlistedDutyAndClearance,
  ]);
  const grossProfit = input.revenue !== null && landedCost !== null ? round2(input.revenue - landedCost) : null;
  const grossMargin = input.revenue !== null && grossProfit !== null ? round4(grossProfit / input.revenue) : null;
  const variableOperatingCost = sumKnown([
    input.paymentFee,
    input.refundReserve,
    input.chargebackReserve,
    input.defectAndReship,
    input.otherVariableCost,
  ]);
  const cm1 = grossProfit !== null && variableOperatingCost !== null ? round2(grossProfit - variableOperatingCost) : null;
  const cm1Margin = input.revenue !== null && cm1 !== null ? round4(cm1 / input.revenue) : null;
  const breakEvenCpa = cm1 !== null && cm1 > 0 ? cm1 : null;
  const breakEvenRoas = input.revenue !== null && cm1 !== null && cm1 > 0 ? round4(input.revenue / cm1) : null;
  const identityValid =
    input.revenue === null ||
    cm1 === null ||
    landedCost === null ||
    variableOperatingCost === null ||
    round2(cm1 + landedCost + variableOperatingCost) === round2(input.revenue);

  return {
    landedCost,
    grossProfit,
    grossMargin,
    variableOperatingCost,
    cm1,
    cm1Margin,
    breakEvenCpa,
    breakEvenRoas,
    identityValid,
    missingFields,
    stopReason: cm1 === null ? "关键成本字段缺失，正式CM1、CPA和ROAS不可计算" : null,
  };
};
