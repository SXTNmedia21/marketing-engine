import { describe, it, expect, vi } from 'vitest';
import { attribute, MIN_CONVERSIONS_FOR_DATA_DRIVEN } from '../src/models/data-driven.js';
import type { Touch } from '../src/types.js';

const t = (id: string, ts = 0, channel = 'paid'): Touch => ({
  touchId: id,
  ts,
  channel,
});

describe('data-driven model', () => {
  it('returns empty map for empty path (above threshold)', () => {
    const result = attribute([], 1000, new Map(), 1000);
    expect(result.size).toBe(0);
  });

  it('falls back to linear when nConversions < 1000', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const path = [t('t1'), t('t2'), t('t3')];
    const result = attribute(path, 300, new Map(), 999);
    // linear gives 1/3 each
    for (const [, entry] of result) {
      expect(entry.credit).toBeCloseTo(1 / 3);
    }
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('falls back to linear when nConversions = 0 (default)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const path = [t('t1'), t('t2')];
    const result = attribute(path, 200);
    expect(result.get('t1')!.credit).toBeCloseTo(0.5);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('falls back to linear when nConversions is NaN', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const path = [t('t1'), t('t2')];
    const result = attribute(path, 200, new Map(), NaN);
    expect(result.get('t1')!.credit).toBeCloseTo(0.5);
    warnSpy.mockRestore();
  });

  it('distributes proportionally by weight above threshold', () => {
    const path = [t('t1'), t('t2')];
    const weights = new Map([['t1', 3], ['t2', 1]]);
    const result = attribute(path, 400, weights, 1000);
    expect(result.get('t1')!.credit).toBeCloseTo(0.75);
    expect(result.get('t2')!.credit).toBeCloseTo(0.25);
    expect(result.get('t1')!.value_nok).toBeCloseTo(300);
    expect(result.get('t2')!.value_nok).toBeCloseTo(100);
  });

  it('unknown touchId in weights falls back to weight=1', () => {
    const path = [t('t1'), t('t2')];
    // t2 not in weights → gets weight=1, t1 gets weight=2
    const weights = new Map([['t1', 2]]);
    const result = attribute(path, 300, weights, 1000);
    expect(result.get('t1')!.credit).toBeCloseTo(2 / 3);
    expect(result.get('t2')!.credit).toBeCloseTo(1 / 3);
  });

  it('all-zero weights falls back to linear', () => {
    const path = [t('t1'), t('t2'), t('t3')];
    const weights = new Map([['t1', 0], ['t2', 0], ['t3', 0]]);
    const result = attribute(path, 300, weights, 1000);
    for (const [, entry] of result) {
      expect(entry.credit).toBeCloseTo(1 / 3);
    }
  });

  it('credits sum to 1 for large path above threshold', () => {
    const path = Array.from({ length: 1000 }, (_, i) => t(`t${i}`, i));
    const weights = new Map(path.map((p, i) => [p.touchId, i + 1] as [string, number]));
    const result = attribute(path, 10_000, weights, 1000);
    const total = [...result.values()].reduce((s, e) => s + e.credit, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('throws on NaN conversionValue', () => {
    expect(() => attribute([t('t1')], NaN, new Map(), 1000)).toThrow(RangeError);
  });

  it('single touch above threshold gets 100% credit', () => {
    const result = attribute([t('t1')], 500, new Map([['t1', 5]]), 1000);
    expect(result.get('t1')!.credit).toBeCloseTo(1);
    expect(result.get('t1')!.value_nok).toBeCloseTo(500);
  });

  it('MIN_CONVERSIONS_FOR_DATA_DRIVEN is exported as 1000', () => {
    expect(MIN_CONVERSIONS_FOR_DATA_DRIVEN).toBe(1000);
  });

  it('NaN weight for a touch falls back to weight=1 (neutral)', () => {
    const path = [t('t1'), t('t2')];
    // t1 has NaN weight → treated as 1; t2 has weight 3 → total 4
    const weights = new Map([['t1', NaN], ['t2', 3]]);
    const result = attribute(path, 400, weights, 1000);
    expect(result.get('t1')!.credit).toBeCloseTo(1 / 4);
    expect(result.get('t2')!.credit).toBeCloseTo(3 / 4);
  });
});
