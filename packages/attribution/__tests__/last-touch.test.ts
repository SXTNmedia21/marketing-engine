import { describe, it, expect } from 'vitest';
import { attribute } from '../src/models/last-touch.js';
import type { Touch } from '../src/types.js';

const t = (id: string, ts = 0, channel = 'paid'): Touch => ({
  touchId: id,
  ts,
  channel,
});

describe('last-touch model', () => {
  it('returns empty map for empty path', () => {
    expect(attribute([], 1000).size).toBe(0);
  });

  it('single touch gets 100% credit', () => {
    const result = attribute([t('t1')], 800);
    expect(result.get('t1')).toEqual({ credit: 1, value_nok: 800 });
  });

  it('last touch gets all credit, earlier get 0', () => {
    const path = [t('t1'), t('t2'), t('t3')];
    const result = attribute(path, 600);
    expect(result.get('t1')).toEqual({ credit: 0, value_nok: 0 });
    expect(result.get('t2')).toEqual({ credit: 0, value_nok: 0 });
    expect(result.get('t3')).toEqual({ credit: 1, value_nok: 600 });
  });

  it('credits sum to 1 across large path', () => {
    const path = Array.from({ length: 1000 }, (_, i) => t(`t${i}`, i));
    const result = attribute(path, 9999);
    const total = [...result.values()].reduce((s, e) => s + e.credit, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('zero conversionValue', () => {
    const result = attribute([t('t1'), t('t2')], 0);
    expect(result.get('t2')).toEqual({ credit: 1, value_nok: 0 });
  });

  it('throws on NaN conversionValue', () => {
    expect(() => attribute([t('t1')], NaN)).toThrow(RangeError);
  });

  it('throws on -Infinity conversionValue', () => {
    expect(() => attribute([t('t1')], -Infinity)).toThrow(RangeError);
  });
});
