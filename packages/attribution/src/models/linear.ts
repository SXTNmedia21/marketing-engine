import type { AttributionPath, CreditMap } from '../types.js';

/**
 * Linear attribution model.
 *
 * Distributes credit equally across all touches in the path.
 * Each touch receives (1 / n) credit and (conversionValue / n) value_nok.
 *
 * Use when: all channels are considered equally important, or as the
 * canonical fallback when data-driven model lacks sufficient conversions.
 *
 * Edge cases:
 * - Empty path → returns an empty CreditMap.
 * - Single touch → that touch gets 100%.
 * - Duplicate touchIds → each occurrence is treated independently (the Map
 *   will hold the last write for a given id; use dedupeConsecutive upstream).
 * - NaN conversionValue → throws RangeError.
 */
export function attribute(
  path: AttributionPath,
  conversionValue: number,
): CreditMap {
  if (!Number.isFinite(conversionValue)) {
    throw new RangeError(
      `conversionValue must be a finite number, got ${conversionValue}`,
    );
  }

  const map: CreditMap = new Map();
  if (path.length === 0) return map;

  const credit = 1 / path.length;
  const value = conversionValue / path.length;

  for (const touch of path) {
    map.set(touch.touchId, { credit, value_nok: value });
  }

  return map;
}
