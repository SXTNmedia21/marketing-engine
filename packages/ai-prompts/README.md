---
title: "@me/ai-prompts — Tiered Prompt Templates"
status: in_progress
created: 2026-05-06
updated: 2026-05-06
module: ai-prompts
tags: [ai, prompts, budget, anthropic, zod]
---

# @me/ai-prompts

Versioned, cost-bounded prompt templates for the marketing engine.
Each module builds an Anthropic Messages API request body and parses the response
— the caller is responsible for making the actual API call.

---

## Tier usage table

| Module | Tier | Model | Input cap | Output cap | Budget cap (NOK) |
|---|---|---|---|---|---|
| `brand-check` | Haiku | claude-haiku-4-5 | 1 500 | 256 | 0.50 |
| `persona-extract` | Haiku | claude-haiku-4-5 | 2 000 | 512 | 0.80 |
| `ad-variant` | Sonnet | claude-sonnet-4-6 | 2 000 | 1 200 | 3.00 |
| `nurture-email` | Sonnet | claude-sonnet-4-6 | 2 000 | 1 200 | 3.00 |
| `lp-config-gen` | Sonnet | claude-sonnet-4-6 | 3 000 | 2 000 | 5.00 |

**Per-campaign run budget** (all 5 prompts once): ~12.30 NOK worst-case.
System cap per campaign is 200 NOK (see `docs/OPERATIONS.md §3`).

---

## Budget rules

- FX rate: 1 USD = 10.5 NOK (constant in `budget.ts` — review quarterly)
- Haiku: $0.80/M input + $4.00/M output (→ NOK)
- Sonnet: $3.00/M input + $15.00/M output (→ NOK)
- Opus: $15.00/M input + $75.00/M output (→ NOK)
- `estimateCost(input_tokens, output_tokens, model)` returns `CostEstimate`
- `assertWithinBudget(estimate, cap_nok)` throws if over cap
- Budget is checked inside `buildPrompt` before returning the request body

---

## Version bump policy

- `PROMPT_VERSION` follows semver (e.g. `"1.0.0"`)
- Bump **patch** for wording tweaks that do not change output shape
- Bump **minor** for new optional output fields or expanded input schema
- Bump **major** for breaking changes to `INPUT_SCHEMA` or `OUTPUT_SCHEMA`
- Always bump on any change to prompt text — callers can log version alongside AI spend

---

## Example invocation pattern

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { brandCheck, estimateCost } from '@me/ai-prompts';

const input = {
  offer: 'Bestill en gratis 30-minutters rådgivning',
  persona: 'Restauranteier, 35–55 år, sliter med turnover',
};

// 1. Build request body (budget-checked internally)
const request = brandCheck.buildPrompt(input);

// 2. Log pre-call estimate
const est = estimateCost(
  brandCheck.MAX_INPUT_TOKENS,
  brandCheck.MAX_OUTPUT_TOKENS,
  request.model,
);
console.log(`Estimated cost: ${est.total_nok} NOK`);

// 3. Call Anthropic API (caller's responsibility)
const client = new Anthropic();
const response = await client.messages.create(request);

// 4. Parse + validate response
const output = brandCheck.parseResponse(
  response.content[0].type === 'text' ? response.content[0].text : '',
);

console.log(output.score, output.flags);
```

---

## Package structure

```
src/
  index.ts            Barrel export
  types.ts            PromptDefinition, PromptResult, ModelTier, CostEstimate, AnthropicRequest
  models.ts           Tier-to-model map + token cost rates
  budget.ts           estimateCost(), assertWithinBudget()
  prompts/
    brand-check.ts    Haiku — brand alignment scoring
    ad-variant.ts     Sonnet — 3 ad variants per platform
    lp-config-gen.ts  Sonnet — full LpConfig matching @me/lp-config schema
    nurture-email.ts  Sonnet — NurtureEmailProps for one nurture step
    persona-extract.ts Haiku — structured persona from free text
```
