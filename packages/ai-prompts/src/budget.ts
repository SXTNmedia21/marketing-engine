import type { CostEstimate } from './types.js';
import { TOKEN_COSTS_USD_PER_M, type AnthropicModelId } from './models.js';

// ---------------------------------------------------------------------------
// FX rate
// ---------------------------------------------------------------------------
/** NOK per 1 USD. TODO: revisit FX rate quarterly */
const USD_TO_NOK = 10.5;

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the cost in NOK for a single Anthropic API call.
 *
 * @param input_tokens  Number of input/prompt tokens
 * @param output_tokens Number of output/completion tokens
 * @param model         Anthropic model identifier string
 */
export function estimateCost(
  input_tokens: number,
  output_tokens: number,
  model: string,
): CostEstimate {
  const rates = TOKEN_COSTS_USD_PER_M[model as AnthropicModelId];
  if (!rates) {
    throw new Error(
      `estimateCost: unknown model "${model}". ` +
        `Known models: ${Object.keys(TOKEN_COSTS_USD_PER_M).join(', ')}`,
    );
  }

  const input_usd = (input_tokens / 1_000_000) * rates.input;
  const output_usd = (output_tokens / 1_000_000) * rates.output;

  const input_nok = input_usd * USD_TO_NOK;
  const output_nok = output_usd * USD_TO_NOK;

  return {
    input_nok: round4(input_nok),
    output_nok: round4(output_nok),
    total_nok: round4(input_nok + output_nok),
    model,
  };
}

/**
 * Assert that a cost estimate is within the budget cap.
 * Throws a descriptive error if over budget.
 *
 * @param estimate   CostEstimate from estimateCost()
 * @param cap_nok    Maximum allowed cost in NOK
 */
export function assertWithinBudget(estimate: CostEstimate, cap_nok: number): void {
  if (estimate.total_nok > cap_nok) {
    throw new Error(
      `Budget exceeded: estimated ${estimate.total_nok.toFixed(4)} NOK ` +
        `but cap is ${cap_nok.toFixed(4)} NOK ` +
        `(model: ${estimate.model}, ` +
        `input: ${estimate.input_nok.toFixed(4)} NOK, ` +
        `output: ${estimate.output_nok.toFixed(4)} NOK)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
