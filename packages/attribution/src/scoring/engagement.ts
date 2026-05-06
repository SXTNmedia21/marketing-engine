import type { ScoringEvent } from '../types.js';

/**
 * Engagement Score — 0-100, deterministic.
 *
 * Formula (from ARCHITECTURE §6 + OPERATIONS §6):
 *
 *   score = 30 × time_factor + 30 × scroll_factor + 40 × interaction_factor
 *
 * Where:
 *   - time_factor      = min(totalEngagementSeconds / 300, 1)
 *                        (300 s = 5 min = 100%)
 *   - scroll_factor    = highest scroll milestone hit / 100
 *                        (milestones: 25 | 50 | 75 | 100 → factor: 0.25 | 0.5 | 0.75 | 1.0)
 *   - interaction_factor = min(interactionCount / 5, 1)
 *                          (capped at 5 interactions = 100%)
 *
 * Interaction events counted: click, cta_click, form_field_focus,
 *   form_submit_attempt, form_submit_success, exit_intent.
 *
 * Time events counted: time_on_page, engagement_seconds — their
 *   durationSeconds values are summed.
 *
 * @param events - Array of ScoringEvent. Must be deterministic (no live
 *   Date.now() in the event stream). Empty array → returns 0.
 * @returns Integer 0-100.
 */
export function score(events: readonly ScoringEvent[]): number {
  if (events.length === 0) return 0;

  // --- time ---
  let totalSeconds = 0;
  for (const ev of events) {
    if (
      (ev.type === 'time_on_page' || ev.type === 'engagement_seconds') &&
      ev.durationSeconds !== undefined
    ) {
      totalSeconds += ev.durationSeconds;
    }
  }
  const timeFactor = Math.min(totalSeconds / 300, 1);

  // --- scroll ---
  let maxMilestone = 0;
  for (const ev of events) {
    if (ev.type === 'scroll_depth' && ev.scrollMilestone !== undefined) {
      if (ev.scrollMilestone > maxMilestone) {
        maxMilestone = ev.scrollMilestone;
      }
    }
  }
  const scrollFactor = maxMilestone / 100;

  // --- interactions ---
  const INTERACTION_TYPES = new Set([
    'click',
    'cta_click',
    'form_field_focus',
    'form_submit_attempt',
    'form_submit_success',
    'exit_intent',
  ]);
  let interactionCount = 0;
  for (const ev of events) {
    if (INTERACTION_TYPES.has(ev.type)) {
      interactionCount++;
    }
  }
  const interactionFactor = Math.min(interactionCount / 5, 1);

  const raw = 30 * timeFactor + 30 * scrollFactor + 40 * interactionFactor;
  return Math.round(Math.min(Math.max(raw, 0), 100));
}
