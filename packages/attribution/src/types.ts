import { z } from 'zod';

// ---------------------------------------------------------------------------
// Touch — one marketing touch point
// ---------------------------------------------------------------------------

export const TouchSchema = z.object({
  touchId: z.string().min(1, 'touchId must be non-empty'),
  ts: z.number().int().nonnegative('ts must be a non-negative epoch ms'),
  channel: z.string().min(1),
  source: z.string().optional(),
  medium: z.string().optional(),
  campaignId: z.string().optional(),
  adId: z.string().optional(),
  slug: z.string().optional(),
  clickId: z.string().optional(),
});

export type Touch = z.infer<typeof TouchSchema>;

// ---------------------------------------------------------------------------
// AttributionPath — ordered sequence of touches
// ---------------------------------------------------------------------------

export const AttributionPathSchema = z.array(TouchSchema);
export type AttributionPath = z.infer<typeof AttributionPathSchema>;

// ---------------------------------------------------------------------------
// AttributionModelId — matches Twenty SELECT options exactly
// ---------------------------------------------------------------------------

export const AttributionModelIdSchema = z.enum([
  'first_touch',
  'last_touch',
  'linear',
  'data_driven',
]);
export type AttributionModelId = z.infer<typeof AttributionModelIdSchema>;

// ---------------------------------------------------------------------------
// CreditMap — output of every attribution model
// ---------------------------------------------------------------------------

export const CreditEntrySchema = z.object({
  credit: z
    .number()
    .min(0)
    .max(1)
    .describe('Fraction of total credit, 0–1. All credits in a CreditMap sum to 1.'),
  value_nok: z.number().nonnegative().describe('credit × conversionValue'),
});
export type CreditEntry = z.infer<typeof CreditEntrySchema>;

/** Map<touchId, CreditEntry> */
export type CreditMap = Map<string, CreditEntry>;

// ---------------------------------------------------------------------------
// ScoringEvent — a single tracked event from the LP
// ---------------------------------------------------------------------------

export const ScoringEventTypeSchema = z.enum([
  'pageview',
  'scroll_depth',
  'time_on_page',
  'engagement_seconds',
  'click',
  'cta_click',
  'form_field_focus',
  'form_submit_attempt',
  'form_submit_success',
  'exit_intent',
  'return_visit',
  'tab_visibility_change',
]);
export type ScoringEventType = z.infer<typeof ScoringEventTypeSchema>;

export const ScoringEventSchema = z.object({
  type: ScoringEventTypeSchema,
  /**
   * Epoch ms — must be deterministic (no Date.now() at call-site).
   * Pass a fixed value in tests.
   */
  ts: z.number().int().nonnegative(),
  /** scroll_depth milestone: 25 | 50 | 75 | 100 */
  scrollMilestone: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]).optional(),
  /** time_on_page / engagement_seconds value in seconds */
  durationSeconds: z.number().nonnegative().optional(),
  /** for tab_visibility_change */
  visible: z.boolean().optional(),
  /** for return_visit */
  isReturn: z.boolean().optional(),
});
export type ScoringEvent = z.infer<typeof ScoringEventSchema>;

// ---------------------------------------------------------------------------
// LeadCategory — matches Twenty enum values exactly
// ---------------------------------------------------------------------------

export const LeadCategorySchema = z.enum(['cold', 'warm', 'hot', 'on_fire']);
export type LeadCategory = z.infer<typeof LeadCategorySchema>;
