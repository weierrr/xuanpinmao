import { z } from "zod";
import { isoDateTimeSchema } from "../research/types";

export const vocSourceFamilies = ["marketplace", "community", "brand_competitor", "creator_media", "specialist"] as const;
export const vocObservationTypes = ["pain", "desired_outcome", "positive_evidence", "counterevidence", "objection", "workaround", "alternative"] as const;
export const vocSentiments = ["negative", "neutral", "positive", "mixed"] as const;
export const vocProductScopes = ["target_product", "competitor_product", "category", "parent_listing"] as const;
export const vocVariantMatches = ["target_variant", "other_variant", "unknown", "not_applicable"] as const;
export const vocFirsthandStatuses = ["explicit", "likely", "unclear", "not_firsthand"] as const;
export const vocConfidenceLevels = ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"] as const;

export const vocSourcePageSchema = z.object({
  source_id: z.string().trim().min(1),
  url: z.url(),
  title: z.string().trim().min(2),
  platform: z.string().trim().min(2),
  source_family: z.enum(vocSourceFamilies),
  captured_at: isoDateTimeSchema,
  access_status: z.enum(["accessible", "partial", "blocked", "unavailable"]),
  snapshot_path: z.string().trim().min(1),
  product_scope: z.enum(vocProductScopes),
  access_notes: z.string().trim().min(2),
});

export const vocObservationSchema = z.object({
  observation_id: z.string().trim().min(1),
  research_run_id: z.string().trim().min(8),
  source_id: z.string().trim().min(1),
  snapshot_path: z.string().trim().min(1),
  platform: z.string().trim().min(2),
  source_family: z.enum(vocSourceFamilies),
  page_url: z.url(),
  page_title: z.string().trim().min(2),
  captured_at: isoDateTimeSchema,
  /**
   * When the user wrote it, when the platform exposes that.
   *
   * Distinct from `captured_at`, which is when we fetched. Only this field can
   * support a recency claim: without it, a long-standing complaint cannot be
   * told apart from a recent spike. Optional because some surfaces (notably the
   * Amazon reviews provider) return no date at all — omit it rather than
   * substituting the capture time.
   */
  published_at: isoDateTimeSchema.nullable().optional(),
  observation_type: z.enum(vocObservationTypes),
  sentiment: z.enum(vocSentiments),
  theme: z.string().trim().min(2),
  paraphrase: z.string().trim().min(5),
  quote_excerpt: z.string().trim().max(240).nullable(),
  product_scope: z.enum(vocProductScopes),
  variant_match: z.enum(vocVariantMatches),
  firsthand_status: z.enum(vocFirsthandStatuses),
  rating: z.object({
    value: z.number().min(0),
    scale_max: z.number().positive(),
    platform: z.string().trim().min(2),
  }).nullable(),
  privacy_reviewed: z.literal(true),
  copyright_reviewed: z.literal(true),
});

export const vocCorpusSchema = z.object({
  schema_version: z.literal("1.0"),
  run_id: z.string().trim().min(8),
  product: z.string().trim().min(2),
  market: z.string().trim().min(2),
  generated_at: isoDateTimeSchema,
  methodology: z.literal("VOICE_OF_CUSTOMER_RESEARCH_STANDARD_V1"),
  denominator_definition: z.string().trim().min(10),
  source_pages: z.array(vocSourcePageSchema).min(1),
  observations: z.array(vocObservationSchema),
  amazon_comment_level_evidence: z.boolean(),
  limitations: z.array(z.string().trim().min(3)),
});

const vocThemeSummarySchema = z.object({
  theme: z.string().trim().min(2),
  count: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  source_families: z.array(z.enum(vocSourceFamilies)),
  sentiments: z.object({
    negative: z.number().int().nonnegative(),
    neutral: z.number().int().nonnegative(),
    positive: z.number().int().nonnegative(),
    mixed: z.number().int().nonnegative(),
  }),
  scope_note: z.string().trim().min(3),
});

export const vocSummarySchema = z.object({
  schema_version: z.literal("1.0"),
  run_id: z.string().trim().min(8),
  generated_at: isoDateTimeSchema,
  confidence: z.enum(vocConfidenceLevels),
  confidence_rationale: z.string().trim().min(5),
  coverage: z.object({
    valid_observations: z.number().int().nonnegative(),
    negative_or_neutral: z.number().int().nonnegative(),
    positive_or_counterevidence: z.number().int().nonnegative(),
    alternative_observations: z.number().int().nonnegative(),
    source_count: z.number().int().nonnegative(),
    source_family_count: z.number().int().nonnegative(),
    platform_count: z.number().int().nonnegative(),
    duplicate_count: z.number().int().nonnegative(),
    excluded_count: z.number().int().nonnegative(),
  }),
  top_pain_points: z.array(vocThemeSummarySchema),
  desired_outcomes: z.array(vocThemeSummarySchema),
  positive_and_counterevidence: z.array(vocThemeSummarySchema),
  representative_excerpts: z.array(z.object({
    theme: z.string().trim().min(2),
    excerpt: z.string().trim().min(2).max(240),
    url: z.url(),
    source_family: z.enum(vocSourceFamilies),
  })).max(8),
  blockers: z.array(z.string().trim().min(3)),
  limitations: z.array(z.string().trim().min(3)),
  amazon_comment_level_evidence: z.boolean(),
  denominator_definition: z.string().trim().min(10),
});

export type VocSourceFamily = (typeof vocSourceFamilies)[number];
export type VocConfidence = (typeof vocConfidenceLevels)[number];
export type VocCorpus = z.infer<typeof vocCorpusSchema>;
export type VocObservation = z.infer<typeof vocObservationSchema>;
export type VocSummary = z.infer<typeof vocSummarySchema>;

export type VocValidationIssue = {
  code: string;
  message: string;
  path?: string;
  observationId?: string;
  sourceId?: string;
};

export type VocValidationResult = {
  valid: boolean;
  run_id: string;
  errors: VocValidationIssue[];
  warnings: VocValidationIssue[];
  summary: {
    source_count: number;
    observation_count: number;
    valid_observation_count: number;
    duplicate_count: number;
    source_family_count: number;
    platform_count: number;
    negative_or_neutral_count: number;
    counterevidence_count: number;
  };
};
