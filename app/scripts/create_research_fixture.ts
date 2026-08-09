import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createEvidencePackage } from "../src/research/evidence-package";
import { createResearchPlan } from "../src/research/research-planner";
import { contentHash } from "../src/research/source-normalizer";
import type { ResearchSource, UnresolvedResearchItem } from "../src/research/types";

const createdAt = new Date("2026-07-19T00:00:00.000Z");
const packagePath = path.join(process.cwd(), "output", "research", "fixture-portable-jewelry-organizer-us");

const competitorSnapshot = "Competitor page fixture: Portable jewelry organizer listed at $24.99 with travel use copy and visible reviews.";
const supplierSnapshot = "Supplier fixture: Public B2B listing shows MOQ 100 pieces and price range, but SKU mapping is not confirmed.";
const regulationSnapshot = "Official regulation fixture: CPSC business guidance page used to locate product safety obligations for consumer products.";

const sources: ResearchSource[] = [
  {
    id: "RSRC-COMP-001",
    url: "https://example-brand.test/products/portable-jewelry-organizer?utm_source=fixture#reviews",
    title: "Example Brand Portable Jewelry Organizer",
    sourceType: "competitor",
    retrievedAt: createdAt.toISOString(),
    targetEntity: "competitor product",
    targetMarket: "US",
    accessMethod: "web-fetch",
    accessStatus: "accessible",
    evidenceStatus: "verified",
    contentSnapshot: competitorSnapshot,
    snapshotPath: "source_snapshots/RSRC-COMP-001.md",
    contentHash: contentHash(competitorSnapshot),
    notes: "Fixture competitor source for pipeline tests. Competitor facts must not be migrated to target product facts.",
  },
  {
    id: "RSRC-SUP-001",
    url: "https://example-supplier.test/portable-jewelry-organizer?utm_campaign=fixture",
    title: "Example Supplier Portable Jewelry Organizer",
    sourceType: "supplier",
    retrievedAt: createdAt.toISOString(),
    targetEntity: "supplier candidate",
    targetMarket: "US",
    accessMethod: "web-fetch",
    accessStatus: "accessible",
    evidenceStatus: "needs_review",
    contentSnapshot: supplierSnapshot,
    snapshotPath: "source_snapshots/RSRC-SUP-001.md",
    contentHash: contentHash(supplierSnapshot),
    notes: "Public supplier listing only. MOQ and price are not a formal quote.",
  },
  {
    id: "RSRC-REG-001",
    url: "https://www.cpsc.gov/Business--Manufacturing/Business-Education",
    title: "CPSC Business Education",
    sourceType: "regulation",
    retrievedAt: createdAt.toISOString(),
    targetEntity: "US regulator",
    targetMarket: "US",
    accessMethod: "web-fetch",
    accessStatus: "accessible",
    evidenceStatus: "verified",
    contentSnapshot: regulationSnapshot,
    snapshotPath: "source_snapshots/RSRC-REG-001.md",
    contentHash: contentHash(regulationSnapshot),
    notes: "Official source fixture for regulatory research routing.",
  },
  {
    id: "RSRC-COMP-001-DUP",
    url: "https://example-brand.test/products/portable-jewelry-organizer?utm_medium=email#details",
    title: "Duplicate Example Brand Portable Jewelry Organizer",
    sourceType: "competitor",
    retrievedAt: createdAt.toISOString(),
    targetEntity: "competitor product",
    targetMarket: "US",
    accessMethod: "web-fetch",
    accessStatus: "accessible",
    evidenceStatus: "verified",
    contentSnapshot: competitorSnapshot,
    snapshotPath: "source_snapshots/RSRC-COMP-001-DUP.md",
    contentHash: contentHash(competitorSnapshot),
    notes: "Duplicate URL fixture after tracking parameter and fragment normalization.",
  },
];

const unresolvedItems: UnresolvedResearchItem[] = [
  {
    id: "UNRESOLVED-001",
    category: "supplier",
    question: "目标 SKU 的准确毛重是多少？",
    reason: "公开供应商页面只展示区间重量，无法映射到目标 SKU。",
    priority: "P0",
    suggestedUserInput: "供应商 SKU 重量截图或正式报价单",
  },
];

const main = async (): Promise<void> => {
  const plan = createResearchPlan({ productName: "portable jewelry organizer", targetMarket: "US" }, createdAt);
  await rm(packagePath, { recursive: true, force: true });
  await createEvidencePackage(packagePath, plan, {
    sources,
    unresolvedItems,
    overwrite: true,
    researchLog: `# Research Log

Created: ${createdAt.toISOString()}

Fixture execution only. No network was accessed.

## Queries

- ${plan.competitorQueries.join("\n- ")}
- ${plan.supplierQueries.join("\n- ")}
- ${plan.regulationQueries.join("\n- ")}

## Visited URLs

- ${sources.map((source) => `${source.url} (${source.accessMethod})`).join("\n- ")}

## Notes

- Public read-only evidence fixture.
- Duplicate competitor URL is intentionally included to verify URL dedupe.
- Supplier SKU mapping remains unresolved.
`,
  });

  await mkdir(path.join(packagePath, "source_snapshots"), { recursive: true });
  await Promise.all(
    sources.map((source) =>
      writeFile(
        path.join(packagePath, source.snapshotPath ?? `source_snapshots/${source.id}.md`),
        `# ${source.title}

URL: ${source.url}

Retrieved: ${source.retrievedAt}

Access method: ${source.accessMethod}

Access status: ${source.accessStatus}

Evidence status: ${source.evidenceStatus}

${source.contentSnapshot ?? ""}
`,
        "utf8",
      ),
    ),
  );

  console.log(JSON.stringify({ status: "fixture_created", packagePath, sources: sources.length, unresolvedItems: unresolvedItems.length }, null, 2));
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

