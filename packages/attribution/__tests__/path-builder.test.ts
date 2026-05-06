import { describe, it, expect } from 'vitest';
import { buildAttributionPath } from '../src/utils/path-builder.js';
import type { ScoringEvent } from '../src/types.js';

const ev = (overrides: Partial<ScoringEvent> & Pick<ScoringEvent, 'type'>): ScoringEvent => ({
  ts: 0,
  ...overrides,
});

describe('buildAttributionPath', () => {
  it('empty events → empty path', () => {
    expect(buildAttributionPath([])).toEqual([]);
  });

  it('no pageview events → empty path', () => {
    const events = [
      ev({ type: 'click', ts: 100 }),
      ev({ type: 'scroll_depth', scrollMilestone: 50, ts: 200 }),
    ];
    expect(buildAttributionPath(events)).toEqual([]);
  });

  it('single pageview → single touch', () => {
    const events = [ev({ type: 'pageview', ts: 1000 })];
    const result = buildAttributionPath(events);
    expect(result).toHaveLength(1);
    expect(result[0]!.touchId).toBe('pageview-0-1000');
    expect(result[0]!.ts).toBe(1000);
    expect(result[0]!.channel).toBe('web');
  });

  it('multiple pageviews → multiple touches in ts order', () => {
    const events = [
      ev({ type: 'pageview', ts: 3000 }),
      ev({ type: 'pageview', ts: 1000 }),
      ev({ type: 'pageview', ts: 2000 }),
    ];
    const result = buildAttributionPath(events);
    expect(result).toHaveLength(3);
    expect(result[0]!.ts).toBe(1000);
    expect(result[1]!.ts).toBe(2000);
    expect(result[2]!.ts).toBe(3000);
  });

  it('non-pageview events are ignored', () => {
    const events = [
      ev({ type: 'pageview', ts: 1000 }),
      ev({ type: 'click', ts: 1100 }),
      ev({ type: 'pageview', ts: 2000 }),
      ev({ type: 'form_field_focus', ts: 2100 }),
    ];
    const result = buildAttributionPath(events);
    expect(result).toHaveLength(2);
    expect(result[0]!.ts).toBe(1000);
    expect(result[1]!.ts).toBe(2000);
  });

  it('touchIds are stable and deterministic', () => {
    const events = [
      ev({ type: 'pageview', ts: 500 }),
      ev({ type: 'pageview', ts: 1500 }),
    ];
    const result1 = buildAttributionPath(events);
    const result2 = buildAttributionPath(events);
    expect(result1[0]!.touchId).toBe(result2[0]!.touchId);
    expect(result1[1]!.touchId).toBe(result2[1]!.touchId);
  });

  it('1000-event stream with mixed types returns correct touch count', () => {
    const events: ScoringEvent[] = Array.from({ length: 1000 }, (_, i) => ({
      type: i % 5 === 0 ? 'pageview' as const : 'click' as const,
      ts: i * 100,
    }));
    const pageviewCount = events.filter((e) => e.type === 'pageview').length;
    const result = buildAttributionPath(events);
    expect(result).toHaveLength(pageviewCount);
  });
});
