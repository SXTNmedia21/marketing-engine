import type { Touch, ScoringEvent } from '../types.js';

/**
 * Builds an ordered attribution path (Touch[]) from a stream of ScoringEvents.
 *
 * Only events that carry UTM / channel attribution data are meaningful for
 * path construction. In this package's model, `pageview` events represent a
 * new channel entry — each one produces a Touch.
 *
 * Events are sorted by `ts` ascending before processing so callers don't need
 * to guarantee order.
 *
 * Touch fields are derived from the event:
 * - touchId: `<type>-<index>-<ts>` (stable, deterministic)
 * - ts: event ts
 * - channel: 'web' (default — in real use, UTM fields from payload would
 *   provide the channel; the ScoringEvent schema doesn't carry UTM directly
 *   because scoring events are behaviour events, not acquisition events)
 *
 * For a richer path with UTM-populated channels, use the `Touch[]` JSON
 * stored in `leads.attribution_path` (built by the control plane on form
 * submit) and pass it directly to the model functions.
 *
 * @param events - Array of ScoringEvent. Sorted by ts internally.
 * @returns Touch[] in chronological order.
 */
export function buildAttributionPath(events: readonly ScoringEvent[]): Touch[] {
  const sorted = [...events].sort((a, b) => a.ts - b.ts);

  const touches: Touch[] = [];
  let idx = 0;

  for (const ev of sorted) {
    if (ev.type === 'pageview') {
      touches.push({
        touchId: `pageview-${idx}-${ev.ts}`,
        ts: ev.ts,
        channel: 'web',
      });
      idx++;
    }
  }

  return touches;
}
