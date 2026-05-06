export * as firstTouch from './first-touch.js';
export * as lastTouch from './last-touch.js';
export * as linear from './linear.js';
export * as dataDriven from './data-driven.js';

import * as firstTouch from './first-touch.js';
import * as lastTouch from './last-touch.js';
import * as linear from './linear.js';
import * as dataDriven from './data-driven.js';

import type { AttributionModelId, AttributionPath, CreditMap } from '../types.js';

// ---------------------------------------------------------------------------
// getModel — factory returning the attribute function for a given model ID
// ---------------------------------------------------------------------------

/**
 * Returns the `attribute` function for the requested model.
 *
 * For `data_driven`, the returned function accepts an optional fourth argument:
 * `nConversions: number`. When omitted it defaults to 0 and the model falls
 * back to linear (per spec).
 */
export function getModel(id: AttributionModelId): (
  path: AttributionPath,
  conversionValue: number,
  weights?: Map<string, number>,
  nConversions?: number,
) => CreditMap {
  switch (id) {
    case 'first_touch':
      return (path, cv) => firstTouch.attribute(path, cv);
    case 'last_touch':
      return (path, cv) => lastTouch.attribute(path, cv);
    case 'linear':
      return (path, cv) => linear.attribute(path, cv);
    case 'data_driven':
      return (path, cv, weights, nConversions) =>
        dataDriven.attribute(path, cv, weights, nConversions);
  }
}
