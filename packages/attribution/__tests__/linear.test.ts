import { describe, it, expect } from 'vitest';
import { attribute } from '../src/models/linear.js';
import type { Touch } from '../src/types.js';

const t = (id: string, ts = 0, channel = 'organic'): Touch => ({
  touchId: id,
  ts,
  channel,
});

describe('linear model', () => {
  it('returns empty map for empty path', () => {
    expect(attribute([], 1000).size).toBe(0);
  });

  it('single touch gets 100% credit', () => {
    const result = attribute([t('t1')], 300);
    expect(result.get('t1')).toEqual({ credit: 1, value_nok: 300 });
  });

  it('two touches: 50/50 split', () => {
    const result = attribute([t('t1'), t('t2')], 200);
    expect(result.get('t1')!.credit).toBeCloseTo(0.5);
    expect(result.get('t2')!.credit).toBeCloseTo(0.5);
    expect(result.get('t1')!.value_nok).toBeCloseTo(100);
    expect(result.get('t2')!.value_nok).toBeCloseTo(100);
  });

  it('three touches: 1/3 each', () => {
    const result = attribute([t('t1'), t('t2'), t('t3')], 300);
    for (const [, entry] of result) {
      expect(entry.credit).toBeCloseTo(1 / 3);
      expect(entry.value_nok).toBeCloseTo(100);
    }
  });

  it('credits sum to 1 for 1000-touch path', () => {
    const path = Array.from({ length: 1000 }, (_, i) => t(`t${i}`, i));
    const result = attribute(path, 50_000);
    const total = [...result.values()].reduce((s, e) => s + e.credit, 0);
    expect(total).toBeCloseTo(1, 8);
  });

  it('value_nok sums to conversionValue for large path', () => {
    const path = Array.from({ length: 500 }, (_, i) => t(`t${i}`, i));
    const cv = 12_345.67;
    const result = attribute(path, cv);
    const totalValue = [...result.values()].reduce((s, e) => s + e.value_nok, 0);
    expect(totalValue).toBeCloseTo(cv, 5);
  });

  it('zero conversionValue: all value_nok = 0, credits still equal', () => {
    const result = attribute([t('t1'), t('t2'), t('t3')], 0);
    for (const [, entry] of result) {
      expect(entry.credit).toBeCloseTo(1 / 3);
      expect(entry.value_nok).toBe(0);
    }
  });

  it('throws on NaN conversionValue', () => {
    expect(() => attribute([t('t1')], NaN)).toThrow(RangeError);
  });

  it('throws on Infinity conversionValue', () => {
    expect(() => attribute([t('t1')], Infinity)).toThrow(RangeError);
  });
});
