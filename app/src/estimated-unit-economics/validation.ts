import { estimatedUnitEconomicsModelSchema, type EstimatedUnitEconomicsModel } from "./types";

export const validateEstimatedUnitEconomicsModel = (value: unknown): EstimatedUnitEconomicsModel =>
  estimatedUnitEconomicsModelSchema.parse(value);

