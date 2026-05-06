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
export const MAX_INPUT_TOKENS = 2_000;
export const MAX_OUTPUT_TOKENS = 512;
/** Max NOK per call: Haiku 0.8/4.0 USD/M */
export const BUDGET_NOK = 0.8;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
export const INPUT_SCHEMA = z.object({
  free_text: z
    .string()
    .min(10)
    .max(4000)
    .describe('Unstructured text describing the target persona or customer'),
});

export type PersonaExtractInput = z.infer<typeof INPUT_SCHEMA>;

export const OUTPUT_SCHEMA = z.object({
  role: z.string().min(2).max(100).describe('Job title or role, e.g. "Restauranteier"'),
  age_range: z
    .string()
    .max(20)
    .optional()
    .describe('Age range if discernible, e.g. "35-50"'),
  industry: z.string().max(100).optional().describe('Industry or sector'),
  company_size: z
    .string()
    .max(60)
    .optional()
    .describe('Team/company size if mentioned, e.g. "1-3 locations"'),
  primary_pain: z
    .string()
    .max(300)
    .describe('The single most important pain point or challenge'),
  secondary_pains: z
    .array(z.string().max(200))
    .max(5)
    .default([])
    .describe('Additional pain points'),
  goals: z
    .array(z.string().max(200))
    .min(1)
    .max(5)
    .describe('What the persona is trying to achieve'),
  objections: z
    .array(z.string().max(200))
    .max(5)
    .default([])
    .describe('Likely objections to buying'),
  channels: z
    .array(z.string().max(60))
    .max(6)
    .default([])
    .describe('Channels where this persona is reachable (e.g. "LinkedIn", "Instagram")'),
  summary: z.string().min(20).max(400).describe('One-paragraph persona summary'),
});

export type PersonaExtractOutput = z.infer<typeof OUTPUT_SCHEMA>;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a market research analyst. Extract a structured persona from the provided free-text.

Return ONLY valid JSON matching this shape exactly — no markdown, no extra fields:
{
  "role": "...",
  "age_range": "...",           // omit if unknown
  "industry": "...",            // omit if unknown
  "company_size": "...",        // omit if unknown
  "primary_pain": "...",
  "secondary_pains": ["..."],
  "goals": ["..."],
  "objections": ["..."],
  "channels": ["..."],
  "summary": "..."
}

Rules:
- Extract only what is present or strongly implied. Do NOT invent facts.
- primary_pain: the single clearest, most urgent frustration
- goals: concrete desired outcomes, not vague aspirations
- objections: realistic buyer hesitations (price, trust, timing, etc.)
- channels: where this type of person is reachable
- summary: 2–4 sentences, written as a marketing brief`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------
export function buildPrompt(input: PersonaExtractInput): AnthropicRequest {
  const parsed = INPUT_SCHEMA.parse(input);

  const estimate = estimateCost(MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS, ANTHROPIC_MODELS[MODEL_TIER]);
  assertWithinBudget(estimate, BUDGET_NOK);

  return {
    model: ANTHROPIC_MODELS[MODEL_TIER],
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Extract a structured persona from the following text:\n\n${parsed.free_text}`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------
export function parseResponse(raw_text: string): PersonaExtractOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw_text.trim());
  } catch {
    throw new Error(`persona-extract parseResponse: invalid JSON — ${raw_text.slice(0, 200)}`);
  }
  return OUTPUT_SCHEMA.parse(parsed);
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------
export const EXAMPLES: { input: PersonaExtractInput; expected_output: PersonaExtractOutput }[] = [
  {
    input: {
      free_text: `Målgruppen vår er restauranteiere i Norge, typisk 35–55 år, som driver ett til tre steder.
De sliter mest med høy turnover — de mister 30–40% av staben hvert år og bruker enormt mye tid på opplæring.
Kvaliteten varierer fra vakt til vakt fordi ingen følger prosedyrene konsekvent.
De ønsker seg stabile ansatte, konsekvent gjestetilfredshet, og mer tid til å fokusere på vekst fremfor brannslukking.
De er skeptiske til ny teknologi fordi de har blitt brent av systemer som var vanskelige å implementere.
Du finner dem på Instagram og LinkedIn, og de er aktive i bransjeforeninger som NHO Reiseliv.`,
    },
    expected_output: {
      role: 'Restauranteier',
      age_range: '35-55',
      industry: 'Restaurant / Hospitality',
      company_size: '1-3 locations',
      primary_pain: 'Høy turnover (30–40% annually) and time-consuming staff training',
      secondary_pains: [
        'Inconsistent quality across shifts due to poor procedure adherence',
        'Too much time on firefighting instead of growth',
      ],
      goals: [
        'Stable, long-term staff',
        'Consistent guest satisfaction',
        'More time to focus on business growth',
      ],
      objections: [
        'Skeptical of new technology — burned by hard-to-implement systems before',
        'Concerns about implementation complexity and time investment',
      ],
      channels: ['Instagram', 'LinkedIn', 'NHO Reiseliv (industry association)'],
      summary:
        'Norwegian restaurant owners (35–55) running 1–3 locations who are exhausted by high staff turnover and quality inconsistency. They want stable teams and more time for growth, but distrust tech that overpromises and underdelivers.',
    },
  },
];
