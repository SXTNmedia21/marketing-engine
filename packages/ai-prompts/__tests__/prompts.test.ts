import { describe, it, expect } from 'vitest';
import * as adVariant from '../src/prompts/ad-variant.js';
import * as brandCheck from '../src/prompts/brand-check.js';
import * as lpConfigGen from '../src/prompts/lp-config-gen.js';
import * as nurtureEmail from '../src/prompts/nurture-email.js';
import { ANTHROPIC_MODELS } from '../src/models.js';
import { estimateCost, assertWithinBudget } from '../src/budget.js';

// ---------------------------------------------------------------------------
// ad-variant
// ---------------------------------------------------------------------------
describe('ad-variant prompt', () => {
  const validInput: adVariant.AdVariantInput = {
    platform: 'meta',
    offer: 'AI-drevet opplæring for restauranter — prøv 30 dager gratis',
    persona: 'Restauranteier, 35–50 år, sliter med turnover og inkonsistent kvalitet',
    campaign_goal: 'lead_capture',
    tone: 'professional',
  };

  it('buildPrompt returns correct model, max_tokens, and messages array', () => {
    const req = adVariant.buildPrompt(validInput);
    expect(req.model).toBe(ANTHROPIC_MODELS['sonnet']);
    expect(req.max_tokens).toBe(adVariant.MAX_OUTPUT_TOKENS);
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0]!.role).toBe('user');
    expect(typeof req.system).toBe('string');
    expect(req.system.length).toBeGreaterThan(10);
  });

  it('buildPrompt user message contains platform and offer', () => {
    const req = adVariant.buildPrompt(validInput);
    expect(req.messages[0]!.content).toContain('meta');
    expect(req.messages[0]!.content).toContain('AI-drevet opplæring');
  });

  it('parseResponse rejects malformed JSON', () => {
    expect(() => adVariant.parseResponse('{not valid json')).toThrow();
  });

  it('parseResponse rejects wrong shape (not array of 3)', () => {
    expect(() => adVariant.parseResponse('[{"headline":"h","body":"b","cta":"c","rationale":"r"}]')).toThrow();
  });

  it('parseResponse parses happy-path example', () => {
    const example = adVariant.EXAMPLES[0]!;
    const raw = JSON.stringify(example.expected_output);
    const result = adVariant.parseResponse(raw);
    expect(result).toHaveLength(3);
    expect(result[0]!.headline).toBe('Slutt med høy turnover');
  });
});

// ---------------------------------------------------------------------------
// brand-check
// ---------------------------------------------------------------------------
describe('brand-check prompt', () => {
  const validInput: brandCheck.BrandCheckInput = {
    offer: 'Bestill gratis rådgivning og lær AI-drevne prosedyrer for restauranten din',
    persona: 'Restauranteiere i Norge, 30–55 år, driver 1–3 steder',
  };

  it('buildPrompt returns correct model and max_tokens', () => {
    const req = brandCheck.buildPrompt(validInput);
    expect(req.model).toBe(ANTHROPIC_MODELS['haiku']);
    expect(req.max_tokens).toBe(brandCheck.MAX_OUTPUT_TOKENS);
  });

  it('buildPrompt includes offer in user message', () => {
    const req = brandCheck.buildPrompt(validInput);
    expect(req.messages[0]!.content).toContain('gratis rådgivning');
  });

  it('parseResponse rejects malformed JSON', () => {
    expect(() => brandCheck.parseResponse('not json')).toThrow();
  });

  it('parseResponse parses example happy-path', () => {
    const example = brandCheck.EXAMPLES[0]!;
    const result = brandCheck.parseResponse(JSON.stringify(example.expected_output));
    expect(result.score).toBe(88);
    expect(Array.isArray(result.flags)).toBe(true);
    expect(typeof result.summary).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// lp-config-gen
// ---------------------------------------------------------------------------
describe('lp-config-gen prompt', () => {
  const validInput: lpConfigGen.LpConfigGenInput = {
    campaign_id: '550e8400-e29b-41d4-a716-446655440000',
    offer: 'SmartOut gratis 30 dager AI-drevet opplæring',
    persona: 'Restauranteier, 35–50 år, sliter med turnover',
    template: 'template_a_lead_capture',
  };

  it('buildPrompt returns correct model', () => {
    const req = lpConfigGen.buildPrompt(validInput);
    expect(req.model).toBe(ANTHROPIC_MODELS['sonnet']);
    expect(req.max_tokens).toBe(lpConfigGen.MAX_OUTPUT_TOKENS);
  });

  it('buildPrompt contains campaign_id in user message', () => {
    const req = lpConfigGen.buildPrompt(validInput);
    expect(req.messages[0]!.content).toContain('550e8400-e29b-41d4-a716-446655440000');
  });

  it('parseResponse rejects malformed JSON', () => {
    expect(() => lpConfigGen.parseResponse('invalid')).toThrow();
  });

  it('parseResponse rejects valid JSON that does not match LpConfig shape', () => {
    expect(() => lpConfigGen.parseResponse(JSON.stringify({ foo: 'bar' }))).toThrow();
  });

  it('parseResponse parses example happy-path', () => {
    const example = lpConfigGen.EXAMPLES[0]!;
    const result = lpConfigGen.parseResponse(JSON.stringify(example.expected_output));
    expect(result.slug).toBe('smartout-gratis-proveperiode');
    expect(result.status).toBe('draft');
  });
});

// ---------------------------------------------------------------------------
// nurture-email
// ---------------------------------------------------------------------------
describe('nurture-email prompt', () => {
  const validInput: nurtureEmail.NurtureEmailInput = {
    campaign_name: 'SmartOut Q2 2026',
    nurture_step: 1,
    total_steps: 5,
    persona: 'Restauranteier, 35–50 år, sliter med turnover',
    offer: 'SmartOut — AI-drevet opplæring, prøv gratis 30 dager',
    cta_url: 'https://app.smartout.no/start',
    unsubscribe_url: 'https://mail.smartout.no/unsubscribe',
  };

  it('buildPrompt returns correct model and max_tokens', () => {
    const req = nurtureEmail.buildPrompt(validInput);
    expect(req.model).toBe(ANTHROPIC_MODELS['sonnet']);
    expect(req.max_tokens).toBe(nurtureEmail.MAX_OUTPUT_TOKENS);
  });

  it('buildPrompt includes nurture step in user message', () => {
    const req = nurtureEmail.buildPrompt(validInput);
    expect(req.messages[0]!.content).toContain('1 of 5');
  });

  it('parseResponse rejects malformed JSON', () => {
    expect(() => nurtureEmail.parseResponse('bad json')).toThrow();
  });

  it('parseResponse parses example happy-path', () => {
    const example = nurtureEmail.EXAMPLES[0]!;
    const result = nurtureEmail.parseResponse(JSON.stringify(example.expected_output));
    expect(result.recipient_first_name).toBe('{{first_name}}');
    expect(result.campaign_name).toBe('SmartOut Q2 2026');
  });
});

// ---------------------------------------------------------------------------
// budget
// ---------------------------------------------------------------------------
describe('estimateCost', () => {
  it('throws for unknown model', () => {
    expect(() => estimateCost(100, 100, 'unknown-model')).toThrow(/unknown model/);
  });

  it('calculates cost in NOK correctly for known model', () => {
    // claude-sonnet-4-6: $3/M input, $15/M output; USD_TO_NOK = 10.5
    const result = estimateCost(1_000_000, 0, 'claude-sonnet-4-6');
    expect(result.input_nok).toBe(3 * 10.5);
    expect(result.output_nok).toBe(0);
    expect(result.total_nok).toBe(3 * 10.5);
    expect(result.model).toBe('claude-sonnet-4-6');
  });
});

describe('assertWithinBudget', () => {
  it('throws when over budget', () => {
    const estimate = estimateCost(1_000_000, 1_000_000, 'claude-opus-4-7');
    expect(() => assertWithinBudget(estimate, 0.01)).toThrow(/Budget exceeded/);
  });

  it('does not throw when within budget', () => {
    const estimate = estimateCost(100, 100, 'claude-haiku-4-5');
    expect(() => assertWithinBudget(estimate, 100)).not.toThrow();
  });
});
