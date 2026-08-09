import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ClaimRecord, DecisionRecord, RiskModuleRecord, SourceRecord, ValidationFixture } from "@/domain/types";

export type T21ProjectFixture = {
  id: string;
  name: string;
  mode: string;
  targetMarket: string;
  status: string;
  dataOrigin: string;
};

export type T21RunSpecFixture = {
  id: string;
  projectId: string;
  version: number;
  isCurrent: boolean;
  productName: string;
  productUrl: string | null;
  sku: string | null;
  variant: string | null;
  packageSpec: string | null;
  targetCountry: string;
  targetUser: string | null;
  salePrice: number | null;
  saleCurrency: string;
  offer: string | null;
  acquisitionChannel: string;
  fulfillmentMode: string;
  supplierCost: number | null;
  packagingCost: number | null;
  domesticShipping: number | null;
  internationalShipping: number | null;
  testBudget: number | null;
  prohibitedConditions: string[];
  completenessStatus: string;
};

export type T21EntityFixture = {
  id: string;
  projectId: string;
  type: string;
  name: string;
  url: string | null;
  sku: string | null;
  variant: string | null;
  market: string | null;
  relationship: string;
};

export type T21EconomicsFixture = {
  id: string;
  kind: string;
  quantity: number;
  grossRevenue: number | null;
  netRevenue: number | null;
  currency: string;
  supplierCost: number | null;
  internationalShipping: number | null;
  cm1: number | null;
  breakEvenCpa: number | null;
  breakEvenRoas: number | null;
  completenessStatus: string;
  missingFields: string[];
};

export type T21MissingDataFixture = {
  id: string;
  priority: string;
  fieldCode: string;
  title: string;
  description: string;
  evidenceNeeded: string;
  minimumCaptureScope: string;
  blockingArea: string;
  status: string;
};

export type T21Fixture = {
  project: T21ProjectFixture;
  runspec: T21RunSpecFixture;
  entities: T21EntityFixture[];
  sources: SourceRecord[];
  claims: ClaimRecord[];
  riskModules: RiskModuleRecord[];
  economics: T21EconomicsFixture[];
  decision: DecisionRecord;
  validation: ValidationFixture;
  missingData: T21MissingDataFixture[];
};

const fixtureDir = path.join(process.cwd(), "fixtures", "T21");

const readJson = async <T>(fileName: string): Promise<T> => {
  const raw = await readFile(path.join(fixtureDir, fileName), "utf8");
  return JSON.parse(raw) as T;
};

export const loadT21Fixture = async (): Promise<T21Fixture> => ({
  project: await readJson<T21ProjectFixture>("project.json"),
  runspec: await readJson<T21RunSpecFixture>("runspec.json"),
  entities: await readJson<T21EntityFixture[]>("entities.json"),
  sources: await readJson<SourceRecord[]>("sources.json"),
  claims: await readJson<ClaimRecord[]>("claims.json"),
  riskModules: await readJson<RiskModuleRecord[]>("risk_modules.json"),
  economics: await readJson<T21EconomicsFixture[]>("economics.json"),
  decision: await readJson<DecisionRecord>("decision.json"),
  validation: await readJson<ValidationFixture>("validation.json"),
  missingData: await readJson<T21MissingDataFixture[]>("missing_data.json"),
});
