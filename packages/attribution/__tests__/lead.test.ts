import { describe, it, expect } from 'vitest';
import { score, category } from '../src/scoring/lead.js';
import type { ScoringEvent } from '../src/types.js';

const ev = (overrides: Partial<ScoringEvent> & Pick<ScoringEvent, 'type'>): ScoringEvent => ({
  ts: 0,
  ...overrides,
});

describe('lead score', () => {
  it('empty events → 0', () => {
    expect(score([])).toBe(0);
  });

  it('result is average of engagement + intent scores', () => {
    // Known: full engagement signal = 40 (5 interactions), intent = 0
    // (40 + 0) / 2 = 20
    const events = [
      ev({ type: 'click' }),
      ev({ type: 'cta_click' }),
      ev({ type: 'form_submit_attempt' }),
      ev({ type: 'form_submit_success' }),
      ev({ type: 'exit_intent' }),
    ];
    // engagement: 40×1 = 40 (5 interactions)
    // intent: 0 (no form_field_focus, no deep scroll, no return, no time)
    expect(score(events)).toBe(20);
  });

  it('result is always integer 0-100', () => {
    const events = [ev({ type: 'form_field_focus' }), ev({ type: 'click' })];
    const result = score(events);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});

describe('lead category', () => {
  // Boundary tests — must match OPERATIONS §5 and Twenty enum exactly

  it('score 0 → cold', () => expect(category(0)).toBe('cold'));
  it('score 30 → cold', () => expect(category(30)).toBe('cold'));
  it('score 31 → warm', () => expect(category(31)).toBe('warm'));
  it('score 60 → warm', () => expect(category(60)).toBe('warm'));
  it('score 61 → hot', () => expect(category(61)).toBe('hot'));
  it('score 80 → hot', () => expect(category(80)).toBe('hot'));
  it('score 81 → on_fire', () => expect(category(81)).toBe('on_fire'));
  it('score 100 → on_fire', () => expect(category(100)).toBe('on_fire'));

  it('score < 0 → cold (clamped)', () => expect(category(-5)).toBe('cold'));
  it('score > 100 → on_fire (clamped)', () => expect(category(150)).toBe('on_fire'));
  it('NaN → cold (safe fallback)', () => expect(category(NaN)).toBe('cold'));

  it('midpoint values are correct', () => {
    expect(category(15)).toBe('cold');
    expect(category(45)).toBe('warm');
    expect(category(70)).toBe('hot');
    expect(category(90)).toBe('on_fire');
  });
});
