import type { AttributionPath, CreditMap } from '../types.js';

/**
 * First-Touch attribution model.
 *
 * Assigns 100% of the credit (and conversion value) to the first touch in
 * the attribution path. All subsequent touches receive 0 credit.
 *
 * Use when: brand awareness / discovery channel measurement. Answers
 * "What introduced us to this customer?"
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

  const first = path[0]!;
  map.set(first.touchId, { credit: 1, value_nok: conversionValue });

  for (let i = 1; i < path.length; i++) {
    map.set(path[i]!.touchId, { credit: 0, value_nok: 0 });
  }

  return map;
}
