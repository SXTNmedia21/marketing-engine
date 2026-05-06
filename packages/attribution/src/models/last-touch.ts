import type { AttributionPath, CreditMap } from '../types.js';

/**
 * Last-Touch attribution model.
 *
 * Assigns 100% of the credit (and conversion value) to the last (most
 * recent) touch in the attribution path. All preceding touches receive 0.
 *
 * Use when: closing-channel measurement. Answers "What pushed the customer
 * over the line?"
 *
 * Edge cases:
 * - Empty path → returns an empty CreditMap.
 * - Single touch → that touch gets 100%.
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

  for (let i = 0; i < path.length - 1; i++) {
    map.set(path[i]!.touchId, { credit: 0, value_nok: 0 });
  }

  const last = path[path.length - 1]!;
  map.set(last.touchId, { credit: 1, value_nok: conversionValue });

  return map;
}
