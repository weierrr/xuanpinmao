import type { OfferKind } from "./types";

export type OfferInput = {
  kind: OfferKind;
  quantity: number;
  totalPrice: number;
  singlePlanPrice: number;
  referenceUnitPrice: number;
  currency: string;
  label?: string;
};

export type OfferResult = OfferInput & {
  perUnitPrice: number;
  referenceTotal: number;
  singlePlanTotal: number;
  discountVsReferencePercent: number;
  discountVsSinglePlanPercent: number;
};

export type DiscountCopyCheck = {
  expectedDiscountPercent: number;
  actualDiscountPercent: number;
  expectedTotalPrice: number;
  delta: number;
  valid: boolean;
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const percentOff = (price: number, reference: number): number => {
  if (reference <= 0) {
    throw new Error("reference must be positive");
  }
  return round2(((reference - price) / reference) * 100);
};

export const calculateOffer = (input: OfferInput): OfferResult => {
  if (input.quantity <= 0) {
    throw new Error("quantity must be positive");
  }
  const referenceTotal = round2(input.referenceUnitPrice * input.quantity);
  const singlePlanTotal = round2(input.singlePlanPrice * input.quantity);
  return {
    ...input,
    perUnitPrice: round2(input.totalPrice / input.quantity),
    referenceTotal,
    singlePlanTotal,
    discountVsReferencePercent: percentOff(input.totalPrice, referenceTotal),
    discountVsSinglePlanPercent: percentOff(input.totalPrice, singlePlanTotal),
  };
};

export const checkDiscountCopy = (
  totalPrice: number,
  referenceTotal: number,
  expectedDiscountPercent: number,
): DiscountCopyCheck => {
  const expectedTotalPrice = round2(referenceTotal * (1 - expectedDiscountPercent / 100));
  const actualDiscountPercent = percentOff(totalPrice, referenceTotal);
  const delta = round2(totalPrice - expectedTotalPrice);
  return {
    expectedDiscountPercent,
    actualDiscountPercent,
    expectedTotalPrice,
    delta,
    valid: Math.abs(delta) < 0.01,
  };
};
