import { z } from "zod";

export const researchSourceTypes = ["competitor", "supplier", "regulation", "market", "other"] as const;
export const researchAccessMethods = ["web-search", "web-fetch", "curl", "jina", "cdp", "api"] as const;
export const researchAccessStatuses = ["accessible", "partial", "blocked", "unavailable"] as const;
export const researchEvidenceStatuses = ["verified", "needs_review", "invalid"] as const;
export const unresolvedCategories = ["competitor", "supplier", "regulation", "product", "economics", "other"] as const;
export const unresolvedPriorities = ["P0", "P1", "P2"] as const;
export const researchPackageVersion = "1.1";

export type ResearchSourceType = (typeof researchSourceTypes)[number];
export type ResearchAccessMethod = (typeof researchAccessMethods)[number];
export type ResearchAccessStatus = (typeof researchAccessStatuses)[number];
export type ResearchEvidenceStatus = (typeof researchEvidenceStatuses)[number];

export type ResearchInput = {
  productName: string;
  targetMarket: string;
  description?: string;
  imagePaths?: string[];
  currency?: string;
  competitors?: string[];
  targetAudience?: string;
  budget?: string;
  availableTime?: string;
  teamSize?: number;
  currentSupplierResources?: string[];
  currentChannelAssets?: string[];
  currentContentAssets?: string[];
  acceptableMoq?: string;
  targetMargin?: string;
  unacceptableRisks?: string[];
  preferredBusinessModel?: string;
  validationGoal?: string;
};

export type ResearchInputRecord = {
  packageVersion: typeof researchPackageVersion;
  researchRunId: string;
  inputHash: string;
  productName: string;
  targetMarket: string;
  description?: string;
  imagePaths: string[];
  currency?: string;
  competitors: string[];
  targetAudience?: string;
  budget?: string;
  availableTime?: string;
  teamSize?: number;
  currentSupplierResources: string[];
  currentChannelAssets: string[];
  currentContentAssets: string[];
  acceptableMoq?: string;
  targetMargin?: string;
  unacceptableRisks: string[];
  preferredBusinessModel?: string;
  validationGoal?: string;
  createdAt: string;
};

export type ResearchPackageManifest = {
  packageVersion: typeof researchPackageVersion;
  researchRunId: string;
  createdAt: string;
  productName: string;
  targetMarket: string;
  expectedFiles: string[];
};

export type ResearchPlan = {
  researchRunId: string;
  inputHash: string;
  productName: string;
  targetMarket: string;
  description?: string;
  imagePaths?: string[];
  currency?: string;
  competitors?: string[];
  targetAudience?: string;
  budget?: string;
  availableTime?: string;
  teamSize?: number;
  currentSupplierResources?: string[];
  currentChannelAssets?: string[];
  currentContentAssets?: string[];
  acceptableMoq?: string;
  targetMargin?: string;
  unacceptableRisks?: string[];
  preferredBusinessModel?: string;
  validationGoal?: string;
  competitorQueries: string[];
  supplierQueries: string[];
  regulationQueries: string[];
  createdAt: string;
};

export type ResearchSource = {
  id: string;
  url: string;
  title: string;
  sourceType: ResearchSourceType;
  retrievedAt: string;
  targetEntity: string;
  targetMarket?: string;
  targetSku?: string;
  accessMethod: ResearchAccessMethod;
  accessStatus: ResearchAccessStatus;
  evidenceStatus: ResearchEvidenceStatus;
  contentSnapshot?: string;
  snapshotPath?: string;
  contentHash?: string;
  notes?: string;
};

export type UnresolvedResearchItem = {
  id: string;
  category: (typeof unresolvedCategories)[number];
  question: string;
  reason: string;
  priority: (typeof unresolvedPriorities)[number];
  suggestedUserInput?: string;
};

export type EvidencePackage = {
  manifest: ResearchPackageManifest;
  researchInput: ResearchInputRecord;
  researchPlan: ResearchPlan;
  sources: ResearchSource[];
  unresolvedItems: UnresolvedResearchItem[];
  packagePath: string;
};

export type ResearchImportResult = {
  packagePath: string;
  researchRunId: string;
  imported: number;
  skipped: number;
  invalid: number;
  duplicateUrls: string[];
  errors: Array<{
    sourceId?: string;
    message: string;
  }>;
};

export type ResearchRunnerInitResult = {
  packagePath: string;
  researchRunId: string;
  plan: ResearchPlan;
};

export type ResearchPackageValidationResult = {
  packagePath: string;
  researchRunId?: string;
  valid: boolean;
  duplicateUrls: string[];
  errors: Array<{
    code: string;
    file?: string;
    sourceId?: string;
    message: string;
  }>;
  warnings: Array<{
    code: string;
    file?: string;
    sourceId?: string;
    message: string;
  }>;
  summary: {
    sourceCount: number;
    unresolvedCount: number;
    snapshotCount: number;
    verifiedCount: number;
    needsReviewCount: number;
    invalidCount: number;
  };
};

export const isoDateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "must be an ISO-8601 compatible timestamp",
});

const imagePathSchema = z.string().trim().min(1).superRefine((value, context) => {
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  const lower = normalized.toLowerCase();
  if (segments.includes("..")) {
    context.addIssue({ code: "custom", message: "imagePaths cannot contain path traversal" });
  }
  if (
    lower.endsWith("/.env") ||
    lower === ".env" ||
    lower.endsWith(".db") ||
    lower.endsWith(".sqlite") ||
    lower.includes("cookie") ||
    lower.includes("secret") ||
    lower.includes("api_key")
  ) {
    context.addIssue({ code: "custom", message: "imagePaths cannot reference sensitive files" });
  }
});

export const researchInputSchema = z.object({
  productName: z.string().trim().min(2),
  targetMarket: z.string().trim().min(2),
  description: z.string().trim().optional(),
  imagePaths: z.array(imagePathSchema).optional(),
  currency: z.string().trim().min(3).max(12).optional(),
  competitors: z.array(z.url()).max(10).optional(),
  targetAudience: z.string().trim().min(2).optional(),
  budget: z.string().trim().min(1).optional(),
  availableTime: z.string().trim().min(1).optional(),
  teamSize: z.number().int().positive().optional(),
  currentSupplierResources: z.array(z.string().trim().min(1)).optional(),
  currentChannelAssets: z.array(z.string().trim().min(1)).optional(),
  currentContentAssets: z.array(z.string().trim().min(1)).optional(),
  acceptableMoq: z.string().trim().min(1).optional(),
  targetMargin: z.string().trim().min(1).optional(),
  unacceptableRisks: z.array(z.string().trim().min(1)).optional(),
  preferredBusinessModel: z.string().trim().min(1).optional(),
  validationGoal: z.string().trim().min(1).optional(),
});

export const researchInputRecordSchema = z.object({
  packageVersion: z.literal(researchPackageVersion),
  researchRunId: z.string().trim().min(8),
  inputHash: z.string().trim().regex(/^[a-f0-9]{64}$/),
  productName: z.string().trim().min(2),
  targetMarket: z.string().trim().min(2),
  description: z.string().trim().optional(),
  imagePaths: z.array(imagePathSchema),
  currency: z.string().trim().min(3).max(12).optional(),
  competitors: z.array(z.url()).max(10),
  targetAudience: z.string().trim().min(2).optional(),
  budget: z.string().trim().min(1).optional(),
  availableTime: z.string().trim().min(1).optional(),
  teamSize: z.number().int().positive().optional(),
  currentSupplierResources: z.array(z.string().trim().min(1)).default([]),
  currentChannelAssets: z.array(z.string().trim().min(1)).default([]),
  currentContentAssets: z.array(z.string().trim().min(1)).default([]),
  acceptableMoq: z.string().trim().min(1).optional(),
  targetMargin: z.string().trim().min(1).optional(),
  unacceptableRisks: z.array(z.string().trim().min(1)).default([]),
  preferredBusinessModel: z.string().trim().min(1).optional(),
  validationGoal: z.string().trim().min(1).optional(),
  createdAt: isoDateTimeSchema,
});

export const researchPackageManifestSchema = z.object({
  packageVersion: z.literal(researchPackageVersion),
  researchRunId: z.string().trim().min(8),
  createdAt: isoDateTimeSchema,
  productName: z.string().trim().min(2),
  targetMarket: z.string().trim().min(2),
  expectedFiles: z.array(z.string().trim().min(1)).min(6),
});

export const researchPlanSchema = z.object({
  researchRunId: z.string().trim().min(8),
  inputHash: z.string().trim().regex(/^[a-f0-9]{64}$/),
  productName: z.string().trim().min(2),
  targetMarket: z.string().trim().min(2),
  description: z.string().trim().optional(),
  imagePaths: z.array(z.string().trim().min(1)).optional(),
  currency: z.string().trim().min(3).max(12).optional(),
  competitors: z.array(z.url()).max(10).optional(),
  targetAudience: z.string().trim().min(2).optional(),
  budget: z.string().trim().min(1).optional(),
  availableTime: z.string().trim().min(1).optional(),
  teamSize: z.number().int().positive().optional(),
  currentSupplierResources: z.array(z.string().trim().min(1)).optional(),
  currentChannelAssets: z.array(z.string().trim().min(1)).optional(),
  currentContentAssets: z.array(z.string().trim().min(1)).optional(),
  acceptableMoq: z.string().trim().min(1).optional(),
  targetMargin: z.string().trim().min(1).optional(),
  unacceptableRisks: z.array(z.string().trim().min(1)).optional(),
  preferredBusinessModel: z.string().trim().min(1).optional(),
  validationGoal: z.string().trim().min(1).optional(),
  competitorQueries: z.array(z.string().trim().min(3)).min(2).max(4),
  supplierQueries: z.array(z.string().trim().min(3)).min(2).max(4),
  regulationQueries: z.array(z.string().trim().min(3)).min(2).max(4),
  createdAt: isoDateTimeSchema,
});

export const researchSourceSchema = z.object({
  id: z.string().trim().min(1),
  url: z.url(),
  title: z.string().trim().min(1),
  sourceType: z.enum(researchSourceTypes),
  retrievedAt: isoDateTimeSchema,
  targetEntity: z.string().trim().min(1),
  targetMarket: z.string().trim().min(1).optional(),
  targetSku: z.string().trim().min(1).optional(),
  accessMethod: z.enum(researchAccessMethods),
  accessStatus: z.enum(researchAccessStatuses),
  evidenceStatus: z.enum(researchEvidenceStatuses),
  contentSnapshot: z.string().optional(),
  snapshotPath: z.string().trim().min(1).optional(),
  contentHash: z.string().trim().min(8).optional(),
  notes: z.string().optional(),
});

export const unresolvedResearchItemSchema = z.object({
  id: z.string().trim().min(1),
  category: z.enum(unresolvedCategories),
  question: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  priority: z.enum(unresolvedPriorities),
  suggestedUserInput: z.string().trim().min(1).optional(),
});

export const researchSourcesSchema = z.array(researchSourceSchema);
export const unresolvedResearchItemsSchema = z.array(unresolvedResearchItemSchema);
