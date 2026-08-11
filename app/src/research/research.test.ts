import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { createEvidencePackage, evidencePackagePaths, readEvidencePackage, validateEvidencePackage } from "./evidence-package";
import { importResearchPackage } from "./import-service";
import { createResearchPlan } from "./research-planner";
import { initializeResearchPackage } from "./research-runner";
import { liveResearchInputFromDiscovery } from "./confirmed-discovery";
import { createOpportunityDiscoveryPlan } from "../opportunity-discovery/service";
import { contentHash, dedupeResearchSources, normalizeResearchSource, normalizeUrl } from "./source-normalizer";
import type { ResearchInput, ResearchSource, UnresolvedResearchItem } from "./types";

const root = process.cwd();
const dbPath = (name: string): string => path.join(root, "prisma", name);
const dbUrl = (name: string): string => `file:./${name}`;

const cleanDb = (name: string): void => {
  for (const suffix of ["", "-journal"]) {
    const filePath = dbPath(`${name}${suffix}`);
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }
};

const expectCommand = (args: string[], databaseName: string): void => {
  const result = spawnSync(args[0] ?? "", args.slice(1), {
    cwd: root,
    env: { ...process.env, DATABASE_URL: dbUrl(databaseName) },
    encoding: "utf8",
  });
  expect(result.status, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`).toBe(0);
};

const withClient = async <T>(databaseName: string, fn: (client: PrismaClient) => Promise<T>): Promise<T> => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = dbUrl(databaseName);
  const client = new PrismaClient();
  try {
    return await fn(client);
  } finally {
    await client.$disconnect();
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
  }
};

const migrateAndSeed = (databaseName: string): void => {
  cleanDb(databaseName);
  expectCommand(["npm", "run", "db:migrate"], databaseName);
  expectCommand(["npm", "run", "db:seed"], databaseName);
};

const source = (overrides: Partial<ResearchSource> = {}): ResearchSource => {
  const snapshot = overrides.contentSnapshot ?? "Fixture source body";
  return {
    id: "RSRC-001",
    url: "https://example.com/products/portable-jewelry-organizer?utm_source=test#reviews",
    title: "Portable Jewelry Organizer",
    sourceType: "competitor",
    retrievedAt: "2026-07-19T00:00:00.000Z",
    targetEntity: "competitor product",
    targetMarket: "US",
    accessMethod: "web-fetch",
    accessStatus: "accessible",
    evidenceStatus: "verified",
    contentSnapshot: snapshot,
    snapshotPath: "source_snapshots/RSRC-001.md",
    contentHash: contentHash(snapshot),
    notes: "fixture",
    ...overrides,
  };
};

const unresolved: UnresolvedResearchItem[] = [
  {
    id: "UNRESOLVED-001",
    category: "supplier",
    question: "目标 SKU 的准确毛重是多少？",
    reason: "公开供应商页面无法映射目标 SKU。",
    priority: "P0",
    suggestedUserInput: "供应商 SKU 重量截图或正式报价单",
  },
];

const createPackage = async (
  packagePath: string,
  sources: ResearchSource[],
  input: ResearchInput = {
    productName: "portable jewelry organizer",
    targetMarket: "US",
  },
): Promise<void> => {
  const plan = createResearchPlan(
    input,
    new Date("2026-07-19T00:00:00.000Z"),
  );
  await createEvidencePackage(packagePath, plan, {
    sources,
    unresolvedItems: unresolved,
    researchLog: "# Research Log\n\nFixture only.\n",
  });
  mkdirSync(evidencePackagePaths(packagePath).snapshots, { recursive: true });
  for (const item of sources) {
    writeFileSync(
      path.join(packagePath, item.snapshotPath ?? `source_snapshots/${item.id}.md`),
      item.contentSnapshot ?? "Fixture source body",
      "utf8",
    );
  }
};

describe("Research planner", () => {
  it("starts a confirmed keyword-only discovery without inventing a competitor URL", () => {
    const discovery = createOpportunityDiscoveryPlan({
      categoryKeyword: "冰箱滤芯 LT700P 型号",
      targetMarket: "US",
      competitorUrls: [],
      imageUrls: [],
      referenceUrls: [],
    });

    const input = liveResearchInputFromDiscovery(discovery, {
      description: undefined,
      currency: undefined,
    });

    expect(input.productName).toBe("冰箱滤芯 LT700P 型号");
    expect(input.competitors).toEqual([]);
    expect(input.mode).toBe("live");
  });

  it("creates grouped market-aware queries", () => {
    const plan = createResearchPlan(
      {
        productName: "portable jewelry organizer",
        targetMarket: "US",
      },
      new Date("2026-07-19T00:00:00.000Z"),
    );

    expect(plan.productName).toBe("portable jewelry organizer");
    expect(plan.researchRunId).toMatch(/^research-run-portable-jewelry-organizer-[a-f0-9]{12}-us$/);
    expect(plan.inputHash).toHaveLength(64);
    expect(plan.currency).toBe("USD");
    expect(plan.targetMarket).toBe("US");
    expect(plan.competitorQueries.length).toBeGreaterThanOrEqual(2);
    expect(plan.supplierQueries.length).toBeGreaterThanOrEqual(2);
    expect(plan.regulationQueries.length).toBeGreaterThanOrEqual(2);
    expect(plan.competitorQueries.every((query) => query.includes("portable jewelry organizer"))).toBe(true);
    expect(plan.supplierQueries.every((query) => query.includes("portable jewelry organizer"))).toBe(true);
    expect(plan.regulationQueries.some((query) => query.includes("cpsc.gov") || query.includes("official"))).toBe(true);
    expect(Date.parse(plan.createdAt)).not.toBeNaN();
  });

  it("uses product, images, and target market to create distinct run identity", () => {
    const first = createResearchPlan({
      productName: "portable jewelry organizer",
      targetMarket: "US",
      imagePaths: ["/tmp/product-a.png"],
    });
    const second = createResearchPlan({
      productName: "portable jewelry organizer",
      targetMarket: "US",
      imagePaths: ["/tmp/product-b.png"],
    });

    expect(first.researchRunId).not.toBe(second.researchRunId);
    expect(first.inputHash).not.toBe(second.inputHash);
  });

  it("keeps non-latin products collision-safe and market-aware", () => {
    const jewelryBox = createResearchPlan({ productName: "便携首饰盒", targetMarket: "US" });
    const travelBag = createResearchPlan({ productName: "折叠旅行收纳包", targetMarket: "US" });
    const euJewelryBox = createResearchPlan({ productName: "便携首饰盒", targetMarket: "EU" });

    expect(jewelryBox.researchRunId).toMatch(/^research-run-product-[a-f0-9]{12}-us$/);
    expect(jewelryBox.researchRunId).not.toBe(travelBag.researchRunId);
    expect(jewelryBox.researchRunId).not.toBe(euJewelryBox.researchRunId);
    expect(euJewelryBox.currency).toBe("EUR");
  });

  it("uses market-specific regulatory domains and currency defaults", () => {
    const us = createResearchPlan({ productName: "travel organizer", targetMarket: "US" });
    const eu = createResearchPlan({ productName: "travel organizer", targetMarket: "EU" });
    const uk = createResearchPlan({ productName: "travel organizer", targetMarket: "UK" });
    const ca = createResearchPlan({ productName: "travel organizer", targetMarket: "CA" });
    const au = createResearchPlan({ productName: "travel organizer", targetMarket: "AU" });
    const jp = createResearchPlan({ productName: "travel organizer", targetMarket: "JP" });
    const unknown = createResearchPlan({ productName: "travel organizer", targetMarket: "KR" });
    const explicit = createResearchPlan({ productName: "travel organizer", targetMarket: "JP", currency: "USD" });

    expect(us.regulationQueries.some((query) => query.includes("cpsc.gov"))).toBe(true);
    expect(eu.regulationQueries.some((query) => query.includes("cpsc.gov"))).toBe(false);
    expect(eu.regulationQueries.some((query) => query.includes("europa.eu"))).toBe(true);
    expect(uk.regulationQueries.some((query) => query.includes("gov.uk"))).toBe(true);
    expect(ca.regulationQueries.some((query) => query.includes("canada.ca"))).toBe(true);
    expect(au.regulationQueries.some((query) => query.includes("productsafety.gov.au") || query.includes("accc.gov.au"))).toBe(true);
    expect(jp.regulationQueries.some((query) => query.includes("go.jp"))).toBe(true);
    expect(unknown.regulationQueries.length).toBeGreaterThanOrEqual(2);
    expect(unknown.currency).toBeUndefined();
    expect(jp.currency).toBe("JPY");
    expect(explicit.currency).toBe("USD");
  });
});

describe("Evidence package", () => {
  it("creates and validates the standard package shape without clobbering existing files", async () => {
    const packagePath = mkdtempSync(path.join(tmpdir(), "research-package-"));
    await createPackage(packagePath, [source()]);
    await expect(createPackage(packagePath, [source({ id: "RSRC-IGNORED" })])).rejects.toThrow("Evidence package already exists");

    const paths = evidencePackagePaths(packagePath);
    expect(existsSync(paths.manifest)).toBe(true);
    expect(existsSync(paths.input)).toBe(true);
    expect(existsSync(paths.plan)).toBe(true);
    expect(existsSync(paths.sources)).toBe(true);
    expect(existsSync(paths.snapshots)).toBe(true);
    expect(existsSync(paths.log)).toBe(true);
    expect(existsSync(paths.unresolved)).toBe(true);

    const loaded = await readEvidencePackage(packagePath);
    const validation = await validateEvidencePackage(packagePath);
    expect(loaded.sources).toHaveLength(1);
    expect(loaded.manifest.packageVersion).toBe("1.1");
    expect(loaded.researchInput.imagePaths).toEqual([]);
    expect(validation.valid).toBe(true);
    expect(validation.summary.sourceCount).toBe(1);
    expect(validation.summary.snapshotCount).toBe(1);
    expect(loaded.sources[0]?.id).toBe("RSRC-001");
    expect(JSON.parse(readFileSync(paths.sources, "utf8"))).toHaveLength(1);
  });

  it("persists research input with Chinese product and multiple image references", async () => {
    const packagePath = mkdtempSync(path.join(tmpdir(), "research-package-input-"));
    await createPackage(packagePath, [source()], {
      productName: "便携首饰盒",
      targetMarket: "US",
      description: "旅行使用的小型首饰收纳盒",
      imagePaths: ["/tmp/front.png", "/tmp/open.png"],
    });

    const loaded = await readEvidencePackage(packagePath);
    expect(loaded.researchInput.productName).toBe("便携首饰盒");
    expect(loaded.researchInput.targetMarket).toBe("US");
    expect(loaded.researchInput.description).toBe("旅行使用的小型首饰收纳盒");
    expect(loaded.researchInput.imagePaths).toEqual(["/tmp/front.png", "/tmp/open.png"]);
    expect(loaded.sources.every((item) => item.targetEntity !== "input image")).toBe(true);
  });

  it("rejects path traversal in image references", () => {
    expect(() =>
      createResearchPlan({
        productName: "便携首饰盒",
        targetMarket: "US",
        imagePaths: ["../.env"],
      }),
    ).toThrow();
  });

  it("rejects incomplete snapshots and mismatched content hashes", async () => {
    const packagePath = mkdtempSync(path.join(tmpdir(), "research-package-invalid-"));
    await createPackage(packagePath, [
      source({
        id: "RSRC-BAD-HASH",
        snapshotPath: "source_snapshots/RSRC-BAD-HASH.md",
        contentSnapshot: "Changed body",
        contentHash: "0".repeat(64),
      }),
      source({
        id: "RSRC-MISSING-SNAPSHOT",
        url: "https://example.com/missing-snapshot",
        snapshotPath: "source_snapshots/missing.md",
      }),
    ]);
    rmSync(path.join(packagePath, "source_snapshots", "missing.md"));

    const validation = await validateEvidencePackage(packagePath);
    expect(validation.valid).toBe(false);
    expect(validation.errors.map((item) => item.code)).toEqual(
      expect.arrayContaining(["CONTENT_HASH_MISMATCH", "MISSING_SOURCE_SNAPSHOT"]),
    );
  });

  it("rejects missing manifest/log/snapshot directory, escaped snapshots, duplicate ids, and input-plan mismatches", async () => {
    const packagePath = mkdtempSync(path.join(tmpdir(), "research-package-broken-"));
    await createPackage(packagePath, [
      source({ id: "DUP", snapshotPath: "source_snapshots/DUP-1.md" }),
      source({ id: "DUP-2", url: "https://example.com/dup-2", snapshotPath: "source_snapshots/DUP-2.md" }),
      source({
        id: "NO-TRACE",
        url: "https://example.com/no-trace",
        contentSnapshot: undefined,
        snapshotPath: undefined,
        contentHash: undefined,
      }),
    ]);
    rmSync(path.join(packagePath, "manifest.json"));
    rmSync(path.join(packagePath, "research_log.md"));
    rmSync(path.join(packagePath, "source_snapshots"), { recursive: true, force: true });
    const sources = JSON.parse(readFileSync(path.join(packagePath, "sources.json"), "utf8"));
    sources[1] = { ...sources[1], id: "DUP", snapshotPath: "../escape.md" };
    writeFileSync(path.join(packagePath, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`, "utf8");
    const input = JSON.parse(readFileSync(path.join(packagePath, "research_input.json"), "utf8"));
    writeFileSync(path.join(packagePath, "research_input.json"), `${JSON.stringify({ ...input, productName: "changed product" }, null, 2)}\n`, "utf8");

    const validation = await validateEvidencePackage(packagePath);
    expect(validation.valid).toBe(false);
    expect(validation.errors.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "MISSING_REQUIRED_PATH",
        "INVALID_MANIFEST",
        "INPUT_PLAN_PRODUCT_MISMATCH",
        "DUPLICATE_SOURCE_ID",
        "SNAPSHOT_PATH_ESCAPE",
        "VERIFIED_SOURCE_MISSING_TRACE",
      ]),
    );
  });

  it("requires explicit resume to reuse an existing initialized package", async () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), "research-init-root-"));
    const input = {
      productName: "便携首饰盒",
      targetMarket: "US",
      description: "旅行使用的小型首饰收纳盒",
    };
    const first = await initializeResearchPackage(input, outputRoot, new Date("2026-07-19T00:00:00.000Z"));

    await expect(initializeResearchPackage(input, outputRoot, new Date("2026-07-19T00:00:00.000Z"))).rejects.toThrow(
      "Evidence package already exists",
    );

    const resumed = await initializeResearchPackage(input, outputRoot, new Date("2026-07-19T00:00:00.000Z"), { resume: true });
    expect(resumed.packagePath).toBe(first.packagePath);
    expect(resumed.researchRunId).toBe(first.researchRunId);
  });
});

describe("Source normalizer", () => {
  it("normalizes URLs, validates enums, rejects invalid URLs, and keeps competitor evidence scoped", () => {
    expect(normalizeUrl("https://example.com/item/?utm_source=x&b=2&a=1#reviews")).toBe("https://example.com/item?a=1&b=2");

    const normalized = normalizeResearchSource(source());
    expect(normalized.sourceType).toBe("competitor");
    expect(normalized.accessMethod).toBe("web-fetch");
    expect(normalized.accessStatus).toBe("accessible");
    expect(normalized.targetEntity).toBe("competitor product");
    expect(normalized.targetEntity).not.toBe("target product");
    expect(normalized.contentHash).toHaveLength(64);

    expect(() => normalizeResearchSource(source({ url: "not-a-url" }))).toThrow();
    expect(() => normalizeResearchSource(source({ title: "" }))).toThrow();
    expect(() => normalizeResearchSource(source({ accessMethod: "browser" as never }))).toThrow();
  });

  it("deduplicates normalized URLs without deleting different URLs with the same title", () => {
    const result = dedupeResearchSources([
      source({ id: "A", url: "https://example.com/item?utm_source=x#top" }),
      source({ id: "B", url: "https://example.com/item" }),
      source({ id: "C", url: "https://example.com/other", title: "Portable Jewelry Organizer" }),
    ]);

    expect(result.sources.map((item) => item.id)).toEqual(["A", "C"]);
    expect(result.duplicateUrls).toEqual(["https://example.com/item"]);
  });
});

describe("Research source import", () => {
  it("imports valid sources, skips duplicate URLs, and leaves T21 fixture boundaries unchanged", async () => {
    const databaseName = "research_import_fixture.db";
    const packagePath = mkdtempSync(path.join(tmpdir(), "research-import-"));
    migrateAndSeed(databaseName);
    await createPackage(packagePath, [
      source({ id: "COMP-1", sourceType: "competitor", url: "https://brand.example/products/organizer?utm_medium=email#reviews" }),
      source({ id: "COMP-1-DUP", sourceType: "competitor", url: "https://brand.example/products/organizer" }),
      source({ id: "SUP-1", sourceType: "supplier", accessStatus: "partial", evidenceStatus: "needs_review", url: "https://supplier.example/organizer" }),
      source({ id: "REG-1", sourceType: "regulation", targetEntity: "US regulator", url: "https://www.cpsc.gov/Business--Manufacturing/Business-Education" }),
    ]);

    const result = await withClient(databaseName, async (client) => {
      const before = {
        t21Sources: await client.source.count({ where: { researchRunId: "T21-full-20260714" } }),
        t21Claims: await client.claim.count({ where: { researchRunId: "T21-full-20260714" } }),
        t21RiskModules: await client.riskModule.count({ where: { researchRunId: "T21-full-20260714" } }),
        decision: await client.decision.findUnique({ where: { researchRunId: "T21-full-20260714" } }),
      };
      const imported = await importResearchPackage(client, packagePath);
      const repeated = await importResearchPackage(client, packagePath);
      const after = {
        t21Sources: await client.source.count({ where: { researchRunId: "T21-full-20260714" } }),
        t21Claims: await client.claim.count({ where: { researchRunId: "T21-full-20260714" } }),
        t21RiskModules: await client.riskModule.count({ where: { researchRunId: "T21-full-20260714" } }),
        researchSources: await client.source.count({ where: { sourceType: { startsWith: "research:" } } }),
        currentRunSources: await client.source.count({ where: { researchRunId: imported.researchRunId } }),
        supplierSource: await client.source.findFirst({
          where: { researchRunId: imported.researchRunId, url: "https://supplier.example/organizer" },
        }),
        runSpec: await client.runSpec.findFirst({ where: { researchRuns: { some: { id: imported.researchRunId } } } }),
        decision: await client.decision.findUnique({ where: { researchRunId: "T21-full-20260714" } }),
      };
      return { before, imported, repeated, after };
    });

    expect(result.imported.imported).toBe(3);
    expect(result.imported.skipped).toBe(1);
    expect(result.repeated.imported).toBe(0);
    expect(result.repeated.skipped).toBe(4);
    expect(result.after.researchSources).toBe(3);
    expect(result.after.currentRunSources).toBe(3);
    expect(result.after.supplierSource?.accessStatus).toBe("partial");
    expect(result.after.supplierSource?.notes).toContain('"evidenceStatus":"needs_review"');
    expect(result.after.runSpec?.saleCurrency).toBe("USD");
    expect(result.after.t21Sources).toBe(result.before.t21Sources);
    expect(result.after.t21Claims).toBe(result.before.t21Claims);
    expect(result.after.t21RiskModules).toBe(result.before.t21RiskModules);
    expect(result.after.decision?.formalStatus).toBe("HOLD_SUPPLY");
    expect(result.after.decision?.listingAllowed).toBe(false);
    expect(result.after.decision?.adTestAllowed).toBe(false);
    expect(result.after.t21Sources).toBe(25);
    expect(result.after.t21Claims).toBe(77);
    expect(result.after.t21RiskModules).toBe(15);

    cleanDb(databaseName);
  });

  it("does not treat another ResearchRun with the same URL as a duplicate", async () => {
    const databaseName = "research_import_scoped_duplicates.db";
    const firstPackagePath = mkdtempSync(path.join(tmpdir(), "research-import-first-"));
    const secondPackagePath = mkdtempSync(path.join(tmpdir(), "research-import-second-"));
    migrateAndSeed(databaseName);
    await createPackage(firstPackagePath, [source({ id: "SHARED-URL-1", url: "https://shared.example/public-evidence" })], {
      productName: "portable jewelry organizer",
      targetMarket: "US",
      imagePaths: ["/tmp/first-product.png"],
    });
    await createPackage(secondPackagePath, [source({ id: "SHARED-URL-2", url: "https://shared.example/public-evidence" })], {
      productName: "portable jewelry organizer",
      targetMarket: "US",
      imagePaths: ["/tmp/second-product.png"],
    });

    const result = await withClient(databaseName, async (client) => {
      const first = await importResearchPackage(client, firstPackagePath);
      const second = await importResearchPackage(client, secondPackagePath);
      const firstRunSources = await client.source.count({ where: { researchRunId: first.researchRunId } });
      const secondRunSources = await client.source.count({ where: { researchRunId: second.researchRunId } });
      const researchSources = await client.source.count({ where: { sourceType: { startsWith: "research:" } } });
      return { first, second, firstRunSources, secondRunSources, researchSources };
    });

    expect(result.first.imported).toBe(1);
    expect(result.second.imported).toBe(1);
    expect(result.first.researchRunId).not.toBe(result.second.researchRunId);
    expect(result.firstRunSources).toBe(1);
    expect(result.secondRunSources).toBe(1);
    expect(result.researchSources).toBe(2);

    cleanDb(databaseName);
  });

  it("does not default unknown market currency to USD and allows explicit currency override", async () => {
    const databaseName = "research_import_currency.db";
    const unknownPackagePath = mkdtempSync(path.join(tmpdir(), "research-import-currency-unknown-"));
    const explicitPackagePath = mkdtempSync(path.join(tmpdir(), "research-import-currency-explicit-"));
    migrateAndSeed(databaseName);
    await createPackage(unknownPackagePath, [source({ id: "KR-1", targetMarket: "KR", url: "https://currency.example/kr" })], {
      productName: "travel organizer",
      targetMarket: "KR",
    });
    await createPackage(explicitPackagePath, [source({ id: "JP-1", targetMarket: "JP", url: "https://currency.example/jp" })], {
      productName: "travel organizer",
      targetMarket: "JP",
      currency: "USD",
    });

    const result = await withClient(databaseName, async (client) => {
      const unknown = await importResearchPackage(client, unknownPackagePath);
      const explicit = await importResearchPackage(client, explicitPackagePath);
      const unknownRunSpec = await client.runSpec.findFirst({ where: { researchRuns: { some: { id: unknown.researchRunId } } } });
      const explicitRunSpec = await client.runSpec.findFirst({ where: { researchRuns: { some: { id: explicit.researchRunId } } } });
      return { unknown, explicit, unknownRunSpec, explicitRunSpec };
    });

    expect(result.unknown.imported).toBe(1);
    expect(result.explicit.imported).toBe(1);
    expect(result.unknownRunSpec?.saleCurrency).toBe("UNKNOWN");
    expect(result.explicitRunSpec?.saleCurrency).toBe("USD");

    cleanDb(databaseName);
  });

  it("rejects invalid evidence sources before creating partial writes", async () => {
    const databaseName = "research_import_invalid.db";
    const packagePath = mkdtempSync(path.join(tmpdir(), "research-import-invalid-"));
    migrateAndSeed(databaseName);
    await createPackage(packagePath, [
      source({ id: "VALID-1", sourceType: "competitor", url: "https://valid.example/item" }),
      source({ id: "INVALID-1", sourceType: "supplier", url: "https://invalid.example/item", accessStatus: "blocked", evidenceStatus: "invalid" }),
    ]);

    const result = await withClient(databaseName, async (client) => {
      const before = await client.source.count({ where: { sourceType: { startsWith: "research:" } } });
      const imported = await importResearchPackage(client, packagePath);
      const after = await client.source.count({ where: { sourceType: { startsWith: "research:" } } });
      return { before, imported, after };
    });

    expect(result.imported.imported).toBe(0);
    expect(result.imported.invalid).toBe(1);
    expect(result.after).toBe(result.before);

    cleanDb(databaseName);
  });
});
