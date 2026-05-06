import type { ModelTier } from './types.js';

// ---------------------------------------------------------------------------
// Anthropic model identifiers
// ---------------------------------------------------------------------------
export const ANTHROPIC_MODELS = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
} as const satisfies Record<ModelTier, string>;

// ---------------------------------------------------------------------------
// Image model identifiers (Black Forest Labs / Flux)
// ---------------------------------------------------------------------------
export const IMAGE_MODELS = {
  flux_schnell: 'black-forest-labs/flux-schnell',
  flux_pro: 'black-forest-labs/flux-pro',
} as const;

export type AnthropicModelId = (typeof ANTHROPIC_MODELS)[keyof typeof ANTHROPIC_MODELS];
export type ImageModelId = (typeof IMAGE_MODELS)[keyof typeof IMAGE_MODELS];

// ---------------------------------------------------------------------------
// Per-1M-token costs in USD (Anthropic published pricing)
// Source: https://www.anthropic.com/pricing (checked 2026-05-06)
// ---------------------------------------------------------------------------
export const TOKEN_COSTS_USD_PER_M = {
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-7': { input: 15.0, output: 75.0 },
} as const satisfies Record<AnthropicModelId, { input: number; output: number }>;

export function getModelId(tier: ModelTier): AnthropicModelId {
  return ANTHROPIC_MODELS[tier];
}
