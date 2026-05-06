import { attribute as linearAttribute } from './linear.js';
import type { AttributionPath, CreditMap } from '../types.js';

/** Minimum conversion count before data-driven weights are trusted. */
export const MIN_CONVERSIONS_FOR_DATA_DRIVEN = 1000;

/**
 * Data-Driven attribution model.
 *
 * Weights touches by their empirical correlation with conversion. Supply
 * `weights` as a `Map<touchId, weight>` where higher weight = stronger
 * correlation.  Weights are normalised internally so they don't need to sum
 * to any particular value.
 *
 * **Fallback:** when `nConversions < MIN_CONVERSIONS_FOR_DATA_DRIVEN` (1000),
 * the function logs a warning and delegates to the linear model, returning
 * equal credit across all touches.  This matches the fallback described in
 * OPERATIONS §9.
 *
 * **Unweighted touches:** any touch whose touchId has no entry in `weights`
 * is assigned `weight = 1` (same as a touch with an average signal).
 *
 * Use when: sufficient conversion history exists (≥ 1000/month) and you want
 * algorithmic credit allocation based on observed channel performance.
 *
 * Edge cases:
 * - Empty path → returns empty CreditMap.
 * - nConversions < 1000 → warning logged, falls back to linear.
 * - All weights are 0 → falls back to linear to avoid division by zero.
 * - NaN conversionValue → throws RangeError.
 * - NaN nConversions → treated as 0 → falls back to linear.
 */
export function attribute(
  path: AttributionPath,
  conversionValue: number,
  weights: Map<string, number> = new Map(),
  nConversions: number = 0,
): CreditMap {
  if (!Number.isFinite(conversionValue)) {
    throw new RangeError(
      `conversionValue must be a finite number, got ${conversionValue}`,
    );
  }

  const safeConversions = Number.isFinite(nConversions) ? nConversions : 0;

  if (safeConversions < MIN_CONVERSIONS_FOR_DATA_DRIVEN) {
    // eslint-disable-next-line no-console
    console.warn(
      `[attribution/data-driven] Only ${safeConversions} conversions available ` +
        `(minimum ${MIN_CONVERSIONS_FOR_DATA_DRIVEN}). ` +
        'Falling back to linear attribution.',
    );
    return linearAttribute(path, conversionValue);
  }

  const map: CreditMap = new Map();
  if (path.length === 0) return map;

  // Resolve weights — unknown touches get weight 1 (neutral)
  const rawWeights = path.map((t) => {
    const w = weights.get(t.touchId) ?? 1;
    return Number.isFinite(w) && w >= 0 ? w : 1;
  });

  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);

  // All-zero edge case → fall back to linear
  if (totalWeight === 0) {
    return linearAttribute(path, conversionValue);
  }

  for (let i = 0; i < path.length; i++) {
    const credit = rawWeights[i]! / totalWeight;
    map.set(path[i]!.touchId, {
      credit,
      value_nok: credit * conversionValue,
    });
  }

  return map;
}
