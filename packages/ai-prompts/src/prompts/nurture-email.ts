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
export const INPUT_SCHEMA = z.object({
  campaign_name: z.string().min(2).max(120).describe('Name of the campaign'),
  nurture_step: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe('Which step in the nurture sequence (1 = first touch)'),
  total_steps: z.number().int().min(1).max(10).describe('Total number of steps in the sequence'),
  persona: z.string().min(10).max(400).describe('Target persona description'),
  offer: z.string().min(10).max(500).describe('The campaign offer being nurtured'),
  cta_url: z.string().url().describe('Destination URL for the primary CTA'),
  unsubscribe_url: z.string().url().describe('Unsubscribe URL (required)'),
  previous_topics: z
    .array(z.string().max(200))
    .max(9)
    .default([])
    .describe('Topics covered in previous emails in this sequence'),
  social_proof_available: z
    .boolean()
    .default(false)
    .describe('Whether a social proof quote should be included'),
});

export type NurtureEmailInput = z.infer<typeof INPUT_SCHEMA>;

// Mirrors NurtureEmailProps from @me/email — kept in sync manually
export const OUTPUT_SCHEMA = z.object({
  recipient_first_name: z
    .string()
    .describe('Placeholder — caller substitutes actual name; use "{{first_name}}"'),
  campaign_name: z.string().min(2).max(120),
  preview_text: z.string().min(10).max(140).describe('Email preview text shown in inbox'),
  hook_paragraph: z
    .string()
    .min(20)
    .max(400)
    .describe('Opening hook paragraph (personalised, attention-grabbing)'),
  value_paragraphs: z
    .array(z.string().min(10).max(400))
    .min(1)
    .max(4)
    .describe('1–4 value/body paragraphs'),
  cta_url: z.string().url(),
  cta_label: z.string().min(2).max(60).describe('CTA button text'),
  social_proof: z
    .object({
      quote: z.string().min(10).max(400),
      author: z.string().min(2).max(100),
    })
    .optional(),
  unsubscribe_url: z.string().url(),
});

export type NurtureEmailOutput = z.infer<typeof OUTPUT_SCHEMA>;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a world-class email copywriter specialising in high-converting nurture sequences for Norwegian B2B audiences.

Generate ONE nurture email as a JSON object matching this exact shape — no markdown, no commentary:
{
  "recipient_first_name": "{{first_name}}",
  "campaign_name": "...",
  "preview_text": "...",
  "hook_paragraph": "...",
  "value_paragraphs": ["...", "..."],
  "cta_url": "...",
  "cta_label": "...",
  "social_proof": { "quote": "...", "author": "..." },   // include only if instructed
  "unsubscribe_url": "..."
}

Rules:
- recipient_first_name must always be exactly "{{first_name}}" — the caller substitutes it at send time
- Write in Norwegian (Bokmål) by default
- Each email in the sequence must cover a new angle — never repeat topics already covered
- hook_paragraph: personal, conversational. Reference the persona's real pain
- value_paragraphs: 1–4 short paragraphs, each a single idea. Concrete and specific
- cta_label: action verb + benefit. Max 8 words
- preview_text: compels the open. Treat it as a second subject line
- social_proof: only include if instructed; keep it brief and attributable
- status must be "draft" — never finalize for sending without human review`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------
export function buildPrompt(input: NurtureEmailInput): AnthropicRequest {
  const parsed = INPUT_SCHEMA.parse(input);

  const estimate = estimateCost(MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS, ANTHROPIC_MODELS[MODEL_TIER]);
  assertWithinBudget(estimate, BUDGET_NOK);

  const lines: string[] = [
    `CAMPAIGN: ${parsed.campaign_name}`,
    `NURTURE STEP: ${parsed.nurture_step} of ${parsed.total_steps}`,
    `OFFER:\n${parsed.offer}`,
    `TARGET PERSONA:\n${parsed.persona}`,
    `CTA URL: ${parsed.cta_url}`,
    `UNSUBSCRIBE URL: ${parsed.unsubscribe_url}`,
  ];

  if (parsed.previous_topics.length > 0) {
    lines.push(`PREVIOUS EMAIL TOPICS (do NOT repeat):\n${parsed.previous_topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}`);
  }

  if (parsed.social_proof_available) {
    lines.push(
      `SOCIAL PROOF: include a plausible social proof quote from a satisfied Norwegian restauranteier`,
    );
  }

  return {
    model: ANTHROPIC_MODELS[MODEL_TIER],
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: lines.join('\n\n') }],
  };
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------
export function parseResponse(raw_text: string): NurtureEmailOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw_text.trim());
  } catch {
    throw new Error(`nurture-email parseResponse: invalid JSON — ${raw_text.slice(0, 200)}`);
  }
  return OUTPUT_SCHEMA.parse(parsed);
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------
export const EXAMPLES: { input: NurtureEmailInput; expected_output: NurtureEmailOutput }[] = [
  {
    input: {
      campaign_name: 'SmartOut Q2 2026',
      nurture_step: 1,
      total_steps: 5,
      persona: 'Restauranteier, 35–50 år, sliter med turnover og inkonsistent kvalitet',
      offer: 'SmartOut — AI-drevet opplæring for restauranter, prøv gratis i 30 dager',
      cta_url: 'https://app.smartout.no/start',
      unsubscribe_url: 'https://mail.smartout.no/unsubscribe',
      previous_topics: [],
      social_proof_available: false,
    },
    expected_output: {
      recipient_first_name: '{{first_name}}',
      campaign_name: 'SmartOut Q2 2026',
      preview_text: 'Hva koster det å lære opp én ny ansatt? (Svaret er høyere enn du tror)',
      hook_paragraph:
        'Hei {{first_name}}, de fleste restauranteiere vi snakker med bruker 3–4 uker på å lære opp en ny ansatt — og en stor del av dem slutter likevel innen seks måneder. Det er en kjempekostnad som sjelden vises i regnskapet.',
      value_paragraphs: [
        'SmartOut er et AI-drevet opplæringsverktøy som automatiserer hele onboarding-prosessen — fra dag én til første selvstendige vakt.',
        'Nye ansatte lærer rutinene, standarden din og HMS-prosedyrene direkte i appen — uten at du trenger å stå ved siden av og forklare.',
        'Prøv gratis i 30 dager. Ingen binding, ingen kredittkort.',
      ],
      cta_url: 'https://app.smartout.no/start',
      cta_label: 'Start gratis prøveperiode',
      unsubscribe_url: 'https://mail.smartout.no/unsubscribe',
    },
  },
];
