import type { z } from 'zod';

// ---------------------------------------------------------------------------
// Model tiers
// ---------------------------------------------------------------------------
export type ModelTier = 'haiku' | 'sonnet' | 'opus';
export type ImageModel = 'flux-schnell' | 'flux-pro';

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------
export interface CostEstimate {
  /** Input cost in NOK */
  input_nok: number;
  /** Output cost in NOK */
  output_nok: number;
  /** Total cost in NOK */
  total_nok: number;
  /** Anthropic model string used for the estimate */
  model: string;
}

// ---------------------------------------------------------------------------
// Prompt definition (metadata a prompt module must export)
// ---------------------------------------------------------------------------
export interface PromptDefinition<TInput, TOutput> {
  /** Semver, e.g. "1.0.0". Bump on any prompt text edit. */
  PROMPT_VERSION: string;
  MODEL_TIER: ModelTier;
  MAX_INPUT_TOKENS: number;
  MAX_OUTPUT_TOKENS: number;
  /** Hard NOK cap per single API call */
  BUDGET_NOK: number;
  /** Zod schema for the prompt's input */
  INPUT_SCHEMA: z.ZodType<TInput>;
  /** Zod schema for the prompt's output */
  OUTPUT_SCHEMA: z.ZodType<TOutput>;
  /** Returns a valid Anthropic Messages API request body */
  buildPrompt: (input: TInput) => AnthropicRequest;
  /** Parses and validates the raw text returned by the API */
  parseResponse: (raw_text: string) => TOutput;
}

// ---------------------------------------------------------------------------
// Anthropic Messages API request shape (no API call happens here)
// ---------------------------------------------------------------------------
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  messages: AnthropicMessage[];
}

// ---------------------------------------------------------------------------
// Prompt result wrapper (returned by caller after invoking API)
// ---------------------------------------------------------------------------
export interface PromptResult<T> {
  output: T;
  cost_estimate: CostEstimate;
  model: string;
  prompt_version: string;
}
