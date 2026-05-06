import { z } from 'zod';
import type { AnthropicRequest, ModelTier } from '../types.js';
import { ANTHROPIC_MODELS } from '../models.js';
import { estimateCost, assertWithinBudget } from '../budget.js';

// ---------------------------------------------------------------------------
// Versioning + tier
// ---------------------------------------------------------------------------
export const PROMPT_VERSION = '1.0.0';
export const MODEL_TIER: ModelTier = 'haiku';

// ---------------------------------------------------------------------------
// Token caps + budget
// ---------------------------------------------------------------------------
export const MAX_INPUT_TOKENS = 1_500;
export const MAX_OUTPUT_TOKENS = 256;
/** Max NOK per call: Haiku ~0.8 USD/M input, 4.0 USD/M output */
export const BUDGET_NOK = 0.5;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
export const INPUT_SCHEMA = z.object({
  offer: z.string().min(10).max(600).describe('The ad offer or campaign message to evaluate'),
  persona: z.string().min(5).max(300).describe('Target persona description'),
  brand_voice: z
    .string()
    .max(300)
    .optional()
    .describe('Brand voice guidelines (tone, vocabulary, values)'),
});

export type BrandCheckInput = z.infer<typeof INPUT_SCHEMA>;

export const OUTPUT_SCHEMA = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Brand alignment score 0–100 (100 = perfect fit)'),
  flags: z
    .array(z.string().max(200))
    .max(10)
    .describe('List of specific issues or warnings found'),
  summary: z.string().max(400).describe('One-paragraph rationale for the score'),
});

export type BrandCheckOutput = z.infer<typeof OUTPUT_SCHEMA>;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a brand compliance auditor for a Norwegian performance-marketing engine.
Your job: evaluate an ad offer against a target persona and brand voice guidelines.

Return ONLY valid JSON matching this exact shape — no markdown, no preamble:
{
  "score": <integer 0-100>,
  "flags": ["<issue>", ...],
  "summary": "<one paragraph>"
}

Scoring guide:
- 90–100: Perfect alignment. Tone, value prop, and persona fit seamlessly.
- 70–89:  Good. Minor adjustments recommended.
- 50–69:  Moderate issues. Some flags may block approval.
- 30–49:  Significant misalignment. Rework needed before publishing.
- 0–29:   Reject. Core problems: wrong audience, off-brand, or harmful.

Be concise. Flags must be actionable. Do not invent problems that are not there.`;

export function buildPrompt(input: BrandCheckInput): AnthropicRequest {
  // Validate input
  const parsed = INPUT_SCHEMA.parse(input);

  // Budget guard — check before returning request
  const estimate = estimateCost(MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS, ANTHROPIC_MODELS[MODEL_TIER]);
  assertWithinBudget(estimate, BUDGET_NOK);

  const userMessage = [
    `OFFER:\n${parsed.offer}`,
    `TARGET PERSONA:\n${parsed.persona}`,
    parsed.brand_voice ? `BRAND VOICE GUIDELINES:\n${parsed.brand_voice}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    model: ANTHROPIC_MODELS[MODEL_TIER],
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  };
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------
export function parseResponse(raw_text: string): BrandCheckOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw_text.trim());
  } catch {
    throw new Error(`brand-check parseResponse: invalid JSON — ${raw_text.slice(0, 200)}`);
  }
  return OUTPUT_SCHEMA.parse(parsed);
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------
export const EXAMPLES: { input: BrandCheckInput; expected_output: BrandCheckOutput }[] = [
  {
    input: {
      offer:
        'Bestill en gratis 30-minutters rådgivning og lær hvordan du kan doble restaurantens omsetning med AI-drevne prosedyrer.',
      persona:
        'Restauranteiere i Norge, 30–55 år, driver 1–3 steder, sliter med turnover og opplæring.',
      brand_voice:
        'Profesjonell men vennlig. Direkte og konkret. Ingen buzzwords. Fokus på praktiske resultater.',
    },
    expected_output: {
      score: 88,
      flags: [
        '"doble omsetning" kan oppfattes som overdrevet — vurder "øke omsetning betraktelig" i stedet',
      ],
      summary:
        'Tilbudet treffer målgruppen godt og tonen er i tråd med brand voice. Et løfte om doblet omsetning er risikabelt uten dokumentasjon, men ellers er alt på plass.',
    },
  },
];
