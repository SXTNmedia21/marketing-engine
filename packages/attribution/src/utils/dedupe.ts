import type { Touch } from '../types.js';

/** 1 minute in milliseconds */
const ONE_MINUTE_MS = 60_000;

/**
 * Collapses consecutive touches from the same channel + source combination
 * that occur within 1 minute of each other.
 *
 * "Consecutive" means adjacent in the sorted (by ts) path — not globally
 * deduplicated. Two non-adjacent touches of the same channel/source are NOT
 * collapsed.
 *
 * When a run is collapsed, the earliest touch in the run is retained and all
 * later touches in the run are dropped.
 *
 * Example:
 *   [paid/google @ 0ms, paid/google @ 30s, organic/google @ 60s, paid/google @ 61s]
 *   →  [paid/google @ 0ms, organic/google @ 60s, paid/google @ 61s]
 *
 * The path is assumed to already be sorted ascending by `ts`. If not,
 * dedupe sorts before processing.
 *
 * @param touches - Array of Touch, sorted by ts ascending.
 * @returns New array with consecutive duplicates within 1 min collapsed.
 */
export function dedupeConsecutive(touches: readonly Touch[]): Touch[] {
  if (touches.length === 0) return [];

  const sorted = [...touches].sort((a, b) => a.ts - b.ts);
  const result: Touch[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1]!;
    const curr = sorted[i]!;

    const sameChannel = prev.channel === curr.channel;
    const sameSource = (prev.source ?? '') === (curr.source ?? '');
    const withinWindow = curr.ts - prev.ts <= ONE_MINUTE_MS;

    if (sameChannel && sameSource && withinWindow) {
      // drop curr — it's a consecutive duplicate within the window
      continue;
    }

    result.push(curr);
  }

  return result;
}
