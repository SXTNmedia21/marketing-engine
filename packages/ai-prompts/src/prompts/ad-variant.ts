import { z } from 'zod';
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
export const MAX_INPUT_TOKENS = 2_000;
export const MAX_OUTPUT_TOKENS = 1_200;
/** Max NOK per call: Sonnet 3.0/15.0 USD/M */
export const BUDGET_NOK = 3.0;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const PLATFORM = z.enum(['meta', 'tiktok', 'google', 'linkedin']);

export const INPUT_SCHEMA = z.object({
  platform: PLATFORM.describe('Target ad platform'),
  offer: z.string().min(10).max(500).describe('The core offer being advertised'),
  persona: z.string().min(10).max(400).describe('Target persona description'),
  campaign_goal: z
    .enum(['awareness', 'lead_capture', 'conversion', 'retargeting'])
    .describe('Primary campaign objective'),
  tone: z
    .enum(['professional', 'casual', 'urgent', 'inspirational'])
    .default('professional')
    .describe('Desired tone of voice'),
  brand_voice: z.string().max(300).optional().describe('Optional brand voice guidance'),
});

export type AdVariantInput = z.infer<typeof INPUT_SCHEMA>;

export const AdVariantSchema = z.object({
  headline: z.string().min(5).max(120).describe('Primary headline text'),
  body: z.string().min(10).max(600).describe('Body copy for the ad'),
  cta: z.string().min(2).max(40).describe('Call-to-action button label'),
  rationale: z.string().max(300).describe('Why this variant should work for the persona'),
});

export const OUTPUT_SCHEMA = z
  .array(AdVariantSchema)
  .length(3)
  .describe('Exactly 3 ad variants');

export type AdVariant = z.infer<typeof AdVariantSchema>;
export type AdVariantOutput = z.infer<typeof OUTPUT_SCHEMA>;

// ---------------------------------------------------------------------------
// Platform copy constraints
// ---------------------------------------------------------------------------
const PLATFORM_NOTES: Record<z.infer<typeof PLATFORM>, string> = {
  meta: 'Meta (Facebook/Instagram): headline max 40 chars, primary text max 125 chars for preview. Use social proof and emotion.',
  tiktok: 'TikTok: hook in first 3 words. Casual, energetic, informal "you" tone. Short punchy sentences.',
  google:
    'Google Ads: headline max 30 chars each. Body (description) max 90 chars. Benefit-first, keyword-rich.',
  linkedin:
    'LinkedIn: professional tone. Lead with business value. Longer body acceptable (up to 600 chars). B2B credibility signals.',
};

const SYSTEM_PROMPT = `You are a senior performance-marketing copywriter for a Norwegian AI company.
Produce EXACTLY 3 ad variants for the given platform, persona, and offer.

Return ONLY valid JSON — an array of 3 objects, no markdown:
[
  {
    "headline": "...",
    "body": "...",
    "cta": "...",
    "rationale": "..."
  },
  ...
]

Rules:
- Each variant must differ meaningfully in angle/hook (e.g. pain, aspiration, social proof)
- Stay within platform character constraints
- Write in Norwegian unless the persona or brand voice requires otherwise
- Temperature is 0.7 so be creative, but never invent facts not in the offer`;

export function buildPrompt(input: AdVariantInput): AnthropicRequest {
  const parsed = INPUT_SCHEMA.parse(input);

  const estimate = estimateCost(MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS, ANTHROPIC_MODELS[MODEL_TIER]);
  assertWithinBudget(estimate, BUDGET_NOK);

  const userMessage = [
    `PLATFORM: ${parsed.platform}`,
    `PLATFORM CONSTRAINTS:\n${PLATFORM_NOTES[parsed.platform]}`,
    `CAMPAIGN GOAL: ${parsed.campaign_goal}`,
    `TONE: ${parsed.tone}`,
    `OFFER:\n${parsed.offer}`,
    `TARGET PERSONA:\n${parsed.persona}`,
    parsed.brand_voice ? `BRAND VOICE:\n${parsed.brand_voice}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    model: ANTHROPIC_MODELS[MODEL_TIER],
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  };
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------
export function parseResponse(raw_text: string): AdVariantOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw_text.trim());
  } catch {
    throw new Error(`ad-variant parseResponse: invalid JSON — ${raw_text.slice(0, 200)}`);
  }
  return OUTPUT_SCHEMA.parse(parsed);
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------
export const EXAMPLES: { input: AdVariantInput; expected_output: AdVariantOutput }[] = [
  {
    input: {
      platform: 'meta',
      offer: 'AI-drevet opplæringsverktøy for restauranter — prøv gratis i 30 dager',
      persona: 'Restauranteier, 35–50 år, sliter med turnover og inkonsekvent kvalitet',
      campaign_goal: 'lead_capture',
      tone: 'professional',
    },
    expected_output: [
      {
        headline: 'Slutt med høy turnover',
        body: 'SmartOut trener opp nye ansatte på rekordtid — uten at du løfter en finger. Prøv gratis i 30 dager.',
        cta: 'Prøv gratis',
        rationale: 'Pain-focused. Hits the turnover nerve directly.',
      },
      {
        headline: 'Dine ansatte. Konsekvent gode.',
        body: 'AI-drevne prosedyrer sikrer at alle følger standarden din — fra dag én. 30 dager gratis.',
        cta: 'Start gratis prøveperiode',
        rationale: 'Aspiration angle — quality and consistency as the dream.',
      },
      {
        headline: '«Halvert opplæringstid»',
        body: 'Restauranteiere i Norge bruker SmartOut for å onboarde ansatte 2× raskere. Se hvorfor.',
        cta: 'Les mer',
        rationale: 'Social proof / credibility angle with a stat hook.',
      },
    ],
  },
];
