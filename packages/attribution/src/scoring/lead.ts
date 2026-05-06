import type { LeadCategory, ScoringEvent } from '../types.js';
import { score as engagementScore } from './engagement.js';
import { score as intentScore } from './intent.js';

/**
 * Lead Score — 0-100, deterministic.
 *
 * Combines engagement and intent scores with equal weight (50/50).
 * Both component scores are already clamped 0-100 by their own functions,
 * so the combined score is always in range.
 *
 * @param events - Array of ScoringEvent. Empty array → 0.
 * @returns Integer 0-100.
 */
export function score(events: readonly ScoringEvent[]): number {
  if (events.length === 0) return 0;
  const raw = (engagementScore(events) + intentScore(events)) / 2;
  return Math.round(Math.min(Math.max(raw, 0), 100));
}

/**
 * Maps a lead score to a LeadCategory enum value.
 *
 * Bounds match OPERATIONS §5 and Twenty `leadCategory` SELECT options exactly:
 *
 * | Range   | Category |
 * |---------|----------|
 * | 0–30    | cold     |
 * | 31–60   | warm     |
 * | 61–80   | hot      |
 * | 81–100  | on_fire  |
 *
 * Values outside 0-100 are clamped before mapping.
 *
 * @param leadScore - Number in range 0-100 (clamped if outside).
 * @returns LeadCategory string matching Twenty enum exactly.
 */
export function category(leadScore: number): LeadCategory {
  if (!Number.isFinite(leadScore)) {
    return 'cold';
  }
  const clamped = Math.round(Math.min(Math.max(leadScore, 0), 100));
  if (clamped <= 30) return 'cold';
  if (clamped <= 60) return 'warm';
  if (clamped <= 80) return 'hot';
  return 'on_fire';
}
