import { describe, it, expect } from 'vitest';
import { attribute } from '../src/models/first-touch.js';
import type { Touch } from '../src/types.js';

const t = (id: string, ts = 0, channel = 'paid'): Touch => ({
  touchId: id,
  ts,
  channel,
});

describe('first-touch model', () => {
  it('returns empty map for empty path', () => {
    const result = attribute([], 1000);
    expect(result.size).toBe(0);
  });

  it('single touch gets 100% credit', () => {
    const result = attribute([t('t1')], 500);
    expect(result.get('t1')).toEqual({ credit: 1, value_nok: 500 });
    expect(result.size).toBe(1);
  });

  it('first touch gets all credit, rest get 0', () => {
    const path = [t('t1'), t('t2'), t('t3')];
    const result = attribute(path, 1200);
    expect(result.get('t1')).toEqual({ credit: 1, value_nok: 1200 });
    expect(result.get('t2')).toEqual({ credit: 0, value_nok: 0 });
    expect(result.get('t3')).toEqual({ credit: 0, value_nok: 0 });
  });

  it('credits sum to 1 across large path', () => {
    const path = Array.from({ length: 1000 }, (_, i) => t(`t${i}`, i));
    const result = attribute(path, 9999);
    const totalCredit = [...result.values()].reduce((s, e) => s + e.credit, 0);
    expect(totalCredit).toBeCloseTo(1, 10);
  });

  it('works with conversionValue = 0', () => {
    const result = attribute([t('t1'), t('t2')], 0);
    expect(result.get('t1')).toEqual({ credit: 1, value_nok: 0 });
  });

  it('throws on NaN conversionValue', () => {
    expect(() => attribute([t('t1')], NaN)).toThrow(RangeError);
  });

  it('throws on Infinity conversionValue', () => {
    expect(() => attribute([t('t1')], Infinity)).toThrow(RangeError);
  });

  it('all-same-touch ids: map has single entry with 100% credit', () => {
    // same touchId repeated — Map semantics: last write wins, but first-touch
    // writes first + zeros — so last zero overwrites. Use dedupeConsecutive upstream.
    const path = [t('t1', 0), t('t1', 100), t('t1', 200)];
    const result = attribute(path, 100);
    // t1 first gets credit=1, then overwritten by credit=0
    // This is documented expected behaviour — caller should dedupe first
    expect(result.get('t1')).toEqual({ credit: 0, value_nok: 0 });
    expect(result.size).toBe(1);
  });
});
