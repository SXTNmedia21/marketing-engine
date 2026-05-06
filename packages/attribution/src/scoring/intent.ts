import type { ScoringEvent } from '../types.js';

/**
 * Intent Score — 0-100, deterministic.
 *
 * Formula (from ARCHITECTURE §6 aggregates + OPERATIONS §5 heuristic):
 *
 *   score = form_focus_bonus + deep_scroll_bonus + return_visit_bonus + time_bonus
 *
 * Where:
 *   - form_focus_bonus   = 30 if any form_field_focus event present
 *   - deep_scroll_bonus  = 25 if any scroll_depth milestone ≥ 75 present
 *   - return_visit_bonus = 25 if any return_visit event with isReturn=true
 *   - time_bonus         = 20 if total engagement_seconds / time_on_page > 60s
 *
 * Total caps at 100 (max possible from the formula is 100).
 *
 * @param events - Array of ScoringEvent. Empty array → returns 0.
 * @returns Integer 0-100.
 */
export function score(events: readonly ScoringEvent[]): number {
  if (events.length === 0) return 0;

  let formFocus = false;
  let deepScroll = false;
  let returnVisit = false;
  let totalSeconds = 0;

  for (const ev of events) {
    if (ev.type === 'form_field_focus') {
      formFocus = true;
    }
    if (ev.type === 'scroll_depth' && ev.scrollMilestone !== undefined && ev.scrollMilestone >= 75) {
      deepScroll = true;
    }
    if (ev.type === 'return_visit' && ev.isReturn === true) {
      returnVisit = true;
    }
    if (
      (ev.type === 'time_on_page' || ev.type === 'engagement_seconds') &&
      ev.durationSeconds !== undefined
    ) {
      totalSeconds += ev.durationSeconds;
    }
  }

  const raw =
    (formFocus ? 30 : 0) +
    (deepScroll ? 25 : 0) +
    (returnVisit ? 25 : 0) +
    (totalSeconds > 60 ? 20 : 0);

  return Math.round(Math.min(Math.max(raw, 0), 100));
}
