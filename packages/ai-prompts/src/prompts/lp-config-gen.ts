import { z } from 'zod';
import { parseLpConfig, LpConfigSchema, type LpConfig } from '@me/lp-config';
import type { AnthropicRequest, ModelTier } from '../types.js';
import { ANTHROPIC_MODELS } from '../models.js';
import { estimateCost, assertWithinBudget } from '../budget.js';

// ---------------------------------------------------------------------------
// Versioning + tier
// ---------------------------------------------------------------------------
export const PROMPT_VERSION = '1.0.0';
export const MODEL_TIER: ModelTier = 'sonnet';

// ---------------------------------------------------------------------------
// Token caps + budget
// ---------------------------------------------------------------------------
export const MAX_INPUT_TOKENS = 3_000;
export const MAX_OUTPUT_TOKENS = 2_000;
/** Max NOK per call: Sonnet 3.0/15.0 USD/M */
export const BUDGET_NOK = 5.0;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
export const INPUT_SCHEMA = z.object({
  campaign_id: z.string().uuid().describe('UUID of the campaign in Twenty CRM'),
  ad_id: z.string().optional().describe('Optional ad identifier this LP is tied to'),
  offer: z.string().min(10).max(600).describe('The campaign offer / value proposition'),
  persona: z.string().min(10).max(400).describe('Target persona description'),
  template: z
    .enum(['template_a_lead_capture', 'template_b_long_form'])
    .describe('Which LP template to use'),
  primary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be 6-digit hex color')
    .optional()
    .describe('Primary brand color, e.g. "#0F172A"'),
  background_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .describe('Background color'),
  text_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .describe('Text color'),
  pixel_meta_id: z.string().optional().describe('Meta pixel ID if tracking enabled'),
  pixel_google_id: z.string().optional().describe('Google measurement ID, e.g. G-XXXXXX'),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  slug_hint: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(64)
    .optional()
    .describe('Preferred URL slug (lowercase, hyphens only)'),
});

export type LpConfigGenInput = z.infer<typeof INPUT_SCHEMA>;

// The output IS the LpConfig — re-export the schema for callers
// Note: ZodDefault fields make exact ZodType assignment complex; use the schema directly.
export const OUTPUT_SCHEMA = LpConfigSchema;
export type LpConfigGenOutput = LpConfig;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a conversion-rate optimizer building landing page configs for a Norwegian AI marketing engine.

Your output MUST be a single valid JSON object that matches this TypeScript shape exactly:
{
  "slug": string,            // lowercase, digits, hyphens only, 3–64 chars
  "template": "template_a_lead_capture" | "template_b_long_form",
  "version": 1,
  "theme": {
    "primary": "#RRGGBB",
    "background": "#RRGGBB",
    "text": "#RRGGBB",
    "accent": "#RRGGBB"     // optional
  },
  "hero": {
    "headline": string,      // max 140 chars
    "subheadline": string    // max 280 chars, optional
  },
  "bullets": string[],       // max 6 items, each max 280 chars
  "form": {
    "fields": [              // 1–8 fields
      {
        "name": string,
        "label": string,
        "type": "email" | "text" | "tel" | "textarea" | "select" | "checkbox",
        "required": boolean,
        "placeholder": string  // optional
      }
    ],
    "submit_label": string,
    "success_message": string
  },
  "pixels": {},              // populate from input, leave empty if no pixel IDs given
  "tracking": {
    "campaign_id": "<UUID from input>",
    "ad_id": string,         // optional
    "utm_source": string,    // optional
    "utm_medium": string,    // optional
    "utm_campaign": string   // optional
  },
  "status": "draft"
}

Rules:
- Return ONLY valid JSON. No markdown fences, no commentary.
- slug: derive from campaign/offer if no hint provided. Make it descriptive and URL-safe.
- hero.headline: powerful, benefit-first. Max 140 chars.
- bullets: 3–5 concrete value points. Each under 120 chars. Norwegian preferred.
- form: include at minimum an email field. Always ask for first name.
- status must be "draft" — never "active".
- temperature is 0.2 for structured output fidelity.`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------
export function buildPrompt(input: LpConfigGenInput): AnthropicRequest {
  const parsed = INPUT_SCHEMA.parse(input);

  const estimate = estimateCost(MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS, ANTHROPIC_MODELS[MODEL_TIER]);
  assertWithinBudget(estimate, BUDGET_NOK);

  const lines: string[] = [
    `CAMPAIGN ID: ${parsed.campaign_id}`,
    `TEMPLATE: ${parsed.template}`,
    `OFFER:\n${parsed.offer}`,
    `TARGET PERSONA:\n${parsed.persona}`,
  ];

  if (parsed.slug_hint) lines.push(`PREFERRED SLUG: ${parsed.slug_hint}`);

  const theme = {
    primary: parsed.primary_color ?? '#0F172A',
    background: parsed.background_color ?? '#FFFFFF',
    text: parsed.text_color ?? '#111827',
  };
  lines.push(`THEME COLORS:\n${JSON.stringify(theme)}`);

  if (parsed.pixel_meta_id) lines.push(`META PIXEL ID: ${parsed.pixel_meta_id}`);
  if (parsed.pixel_google_id) lines.push(`GOOGLE MEASUREMENT ID: ${parsed.pixel_google_id}`);
  if (parsed.ad_id) lines.push(`AD ID: ${parsed.ad_id}`);
  if (parsed.utm_source) lines.push(`UTM SOURCE: ${parsed.utm_source}`);
  if (parsed.utm_medium) lines.push(`UTM MEDIUM: ${parsed.utm_medium}`);
  if (parsed.utm_campaign) lines.push(`UTM CAMPAIGN: ${parsed.utm_campaign}`);

  return {
    model: ANTHROPIC_MODELS[MODEL_TIER],
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: lines.join('\n\n') }],
  };
}

// ---------------------------------------------------------------------------
// Response parser — must pass parseLpConfig (inline assertion)
// ---------------------------------------------------------------------------
export function parseResponse(raw_text: string): LpConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw_text.trim());
  } catch {
    throw new Error(`lp-config-gen parseResponse: invalid JSON — ${raw_text.slice(0, 200)}`);
  }

  // Inline assertion: parseLpConfig from @me/lp-config must not throw
  const config = parseLpConfig(parsed);

  return config;
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------
export const EXAMPLES: { input: LpConfigGenInput; expected_output: LpConfigGenOutput }[] = [
  {
    input: {
      campaign_id: '550e8400-e29b-41d4-a716-446655440000',
      offer: 'Prøv SmartOut gratis i 30 dager — AI-drevet opplæring for restauranter',
      persona: 'Restauranteier, 35–50 år, 1–3 steder, sliter med turnover og inkonsistent kvalitet',
      template: 'template_a_lead_capture',
      primary_color: '#0F172A',
      background_color: '#FFFFFF',
      text_color: '#111827',
      utm_source: 'meta',
      utm_medium: 'paid_social',
      utm_campaign: 'smartout-q2-2026',
      slug_hint: 'smartout-gratis-proveperiode',
    },
    expected_output: {
      slug: 'smartout-gratis-proveperiode',
      template: 'template_a_lead_capture',
      version: 1,
      theme: { primary: '#0F172A', background: '#FFFFFF', text: '#111827' },
      hero: {
        headline: 'Halver opplæringstiden din — prøv SmartOut gratis i 30 dager',
        subheadline:
          'AI-drevne prosedyrer som trener opp nye ansatte automatisk. Ingen turnover-hodepine.',
      },
      bullets: [
        'Onboard nye ansatte 2× raskere fra dag én',
        'Konsekvent kvalitet på tvers av alle vakter',
        'Ingen manuell oppfølging — AI tar over rutineoppgavene',
        'Tilpasset norsk arbeidsmiljølov og bransjestandarder',
      ],
      form: {
        fields: [
          {
            name: 'first_name',
            label: 'Fornavn',
            type: 'text',
            required: true,
            placeholder: 'Ola',
          },
          {
            name: 'email',
            label: 'E-post',
            type: 'email',
            required: true,
            placeholder: 'ola@restaurant.no',
          },
          {
            name: 'phone',
            label: 'Telefon',
            type: 'tel',
            required: false,
            placeholder: '+47 000 00 000',
          },
        ],
        submit_label: 'Start gratis prøveperiode',
        success_message: 'Takk! Vi tar kontakt innen en time.',
      },
      pixels: {},
      tracking: {
        campaign_id: '550e8400-e29b-41d4-a716-446655440000',
        utm_source: 'meta',
        utm_medium: 'paid_social',
        utm_campaign: 'smartout-q2-2026',
      },
      status: 'draft',
    },
  },
];
