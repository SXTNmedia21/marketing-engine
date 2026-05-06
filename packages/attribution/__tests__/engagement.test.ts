import { describe, it, expect } from 'vitest';
import { score } from '../src/scoring/engagement.js';
import type { ScoringEvent } from '../src/types.js';

const ev = (overrides: Partial<ScoringEvent> & Pick<ScoringEvent, 'type'>): ScoringEvent => ({
  ts: 0,
  ...overrides,
});

describe('engagement score', () => {
  it('empty events → 0', () => {
    expect(score([])).toBe(0);
  });

  it('no engagement signals → 0', () => {
    const events = [ev({ type: 'pageview' }), ev({ type: 'tab_visibility_change' })];
    expect(score(events)).toBe(0);
  });

  it('5 min time on page → 30 points (time component maxes)', () => {
    const events = [ev({ type: 'time_on_page', durationSeconds: 300 })];
    expect(score(events)).toBe(30);
  });

  it('time capped at 5 min even with more seconds', () => {
    const events = [ev({ type: 'time_on_page', durationSeconds: 600 })];
    expect(score(events)).toBe(30);
  });

  it('engagement_seconds counts toward time', () => {
    const events = [ev({ type: 'engagement_seconds', durationSeconds: 150 })];
    // 150/300 = 0.5 → 30 × 0.5 = 15
    expect(score(events)).toBe(15);
  });

  it('combined time_on_page + engagement_seconds stacks', () => {
    const events = [
      ev({ type: 'time_on_page', durationSeconds: 150 }),
      ev({ type: 'engagement_seconds', durationSeconds: 150 }),
    ];
    // total 300s → full time component = 30
    expect(score(events)).toBe(30);
  });

  it('scroll 25% → 30 × 0.25 = 7.5 → scroll component 7 (rounded)', () => {
    const events = [ev({ type: 'scroll_depth', scrollMilestone: 25 })];
    // 0 time, 0.25 scroll, 0 interactions
    // 30×0 + 30×0.25 + 40×0 = 7.5 → rounds to 8
    expect(score(events)).toBe(8);
  });

  it('scroll 100% → full scroll component = 30', () => {
    const events = [ev({ type: 'scroll_depth', scrollMilestone: 100 })];
    expect(score(events)).toBe(30);
  });

  it('uses highest scroll milestone only', () => {
    const events = [
      ev({ type: 'scroll_depth', scrollMilestone: 25 }),
      ev({ type: 'scroll_depth', scrollMilestone: 75 }),
      ev({ type: 'scroll_depth', scrollMilestone: 50 }),
    ];
    // 75 is max → factor = 0.75 → 30 × 0.75 = 22.5 → 23 (rounded)
    expect(score(events)).toBe(23);
  });

  it('5 interactions → full interaction component = 40', () => {
    const events = [
      ev({ type: 'click' }),
      ev({ type: 'cta_click' }),
      ev({ type: 'form_field_focus' }),
      ev({ type: 'form_submit_attempt' }),
      ev({ type: 'form_submit_success' }),
    ];
    expect(score(events)).toBe(40);
  });

  it('more than 5 interactions still caps at 40', () => {
    const events = Array.from({ length: 10 }, () => ev({ type: 'click' }));
    expect(score(events)).toBe(40);
  });

  it('1 interaction → 40 × 0.2 = 8', () => {
    const events = [ev({ type: 'exit_intent' })];
    expect(score(events)).toBe(8);
  });

  it('full score: 5min + 100% scroll + 5 interactions = 100', () => {
    const events: ScoringEvent[] = [
      ev({ type: 'time_on_page', durationSeconds: 300 }),
      ev({ type: 'scroll_depth', scrollMilestone: 100 }),
      ev({ type: 'click' }),
      ev({ type: 'cta_click' }),
      ev({ type: 'form_field_focus' }),
      ev({ type: 'form_submit_attempt' }),
      ev({ type: 'form_submit_success' }),
    ];
    expect(score(events)).toBe(100);
  });

  it('result is always integer', () => {
    const events = [
      ev({ type: 'time_on_page', durationSeconds: 123 }),
      ev({ type: 'scroll_depth', scrollMilestone: 50 }),
      ev({ type: 'click' }),
    ];
    const result = score(events);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('result is clamped to 0-100', () => {
    const events = Array.from({ length: 100 }, () => ev({ type: 'click' }));
    const result = score(events);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});
