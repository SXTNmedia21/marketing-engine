import { describe, it, expect } from 'vitest';
import { score } from '../src/scoring/intent.js';
import type { ScoringEvent } from '../src/types.js';

const ev = (overrides: Partial<ScoringEvent> & Pick<ScoringEvent, 'type'>): ScoringEvent => ({
  ts: 0,
  ...overrides,
});

describe('intent score', () => {
  it('empty events → 0', () => {
    expect(score([])).toBe(0);
  });

  it('no intent signals → 0', () => {
    const events = [ev({ type: 'pageview' }), ev({ type: 'scroll_depth', scrollMilestone: 50 })];
    expect(score(events)).toBe(0);
  });

  it('form_field_focus → +30', () => {
    expect(score([ev({ type: 'form_field_focus' })])).toBe(30);
  });

  it('form_field_focus multiple times still counts once', () => {
    const events = [
      ev({ type: 'form_field_focus' }),
      ev({ type: 'form_field_focus' }),
    ];
    expect(score(events)).toBe(30);
  });

  it('scroll ≥ 75% → +25', () => {
    expect(score([ev({ type: 'scroll_depth', scrollMilestone: 75 })])).toBe(25);
  });

  it('scroll 100% → +25 (same bonus as 75%)', () => {
    expect(score([ev({ type: 'scroll_depth', scrollMilestone: 100 })])).toBe(25);
  });

  it('scroll 50% → 0 (below threshold)', () => {
    expect(score([ev({ type: 'scroll_depth', scrollMilestone: 50 })])).toBe(0);
  });

  it('return_visit with isReturn=true → +25', () => {
    expect(score([ev({ type: 'return_visit', isReturn: true })])).toBe(25);
  });

  it('return_visit with isReturn=false → 0', () => {
    expect(score([ev({ type: 'return_visit', isReturn: false })])).toBe(0);
  });

  it('time > 60s → +20', () => {
    expect(score([ev({ type: 'time_on_page', durationSeconds: 61 })])).toBe(20);
  });

  it('time exactly 60s → 0 (must be > 60)', () => {
    expect(score([ev({ type: 'time_on_page', durationSeconds: 60 })])).toBe(0);
  });

  it('engagement_seconds > 60 also triggers time bonus', () => {
    expect(score([ev({ type: 'engagement_seconds', durationSeconds: 90 })])).toBe(20);
  });

  it('time accumulates across multiple events', () => {
    const events = [
      ev({ type: 'time_on_page', durationSeconds: 30 }),
      ev({ type: 'engagement_seconds', durationSeconds: 40 }),
    ];
    // 30 + 40 = 70 > 60 → +20
    expect(score(events)).toBe(20);
  });

  it('all signals → 100', () => {
    const events: ScoringEvent[] = [
      ev({ type: 'form_field_focus' }),         // +30
      ev({ type: 'scroll_depth', scrollMilestone: 75 }),  // +25
      ev({ type: 'return_visit', isReturn: true }),        // +25
      ev({ type: 'time_on_page', durationSeconds: 120 }), // +20
    ];
    expect(score(events)).toBe(100);
  });

  it('result is always integer', () => {
    const result = score([ev({ type: 'form_field_focus' })]);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('result is clamped 0-100', () => {
    // Even if the formula could overflow, it must cap at 100
    const events: ScoringEvent[] = [
      ev({ type: 'form_field_focus' }),
      ev({ type: 'scroll_depth', scrollMilestone: 100 }),
      ev({ type: 'return_visit', isReturn: true }),
      ev({ type: 'time_on_page', durationSeconds: 999 }),
    ];
    expect(score(events)).toBe(100);
  });
});
