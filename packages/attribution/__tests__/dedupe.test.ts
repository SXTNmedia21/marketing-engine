import { describe, it, expect } from 'vitest';
import { dedupeConsecutive } from '../src/utils/dedupe.js';
import type { Touch } from '../src/types.js';

const t = (
  id: string,
  ts: number,
  channel = 'paid',
  source?: string,
): Touch => ({
  touchId: id,
  ts,
  channel,
  source,
});

describe('dedupeConsecutive', () => {
  it('empty → empty', () => {
    expect(dedupeConsecutive([])).toEqual([]);
  });

  it('single touch → unchanged', () => {
    const touches = [t('t1', 0)];
    expect(dedupeConsecutive(touches)).toEqual(touches);
  });

  it('different channels → no deduplication', () => {
    const touches = [t('t1', 0, 'paid'), t('t2', 10_000, 'organic')];
    expect(dedupeConsecutive(touches)).toHaveLength(2);
  });

  it('same channel + source within 1 min → second collapsed', () => {
    const touches = [
      t('t1', 0, 'paid', 'google'),
      t('t2', 30_000, 'paid', 'google'), // 30s later, within window
    ];
    const result = dedupeConsecutive(touches);
    expect(result).toHaveLength(1);
    expect(result[0]!.touchId).toBe('t1');
  });

  it('same channel + source at exactly 60s → kept (boundary = 60000ms)', () => {
    const touches = [
      t('t1', 0, 'paid', 'google'),
      t('t2', 60_000, 'paid', 'google'), // exactly 60s = within window
    ];
    const result = dedupeConsecutive(touches);
    expect(result).toHaveLength(1);
  });

  it('same channel + source at 60001ms → NOT collapsed (outside window)', () => {
    const touches = [
      t('t1', 0, 'paid', 'google'),
      t('t2', 60_001, 'paid', 'google'),
    ];
    const result = dedupeConsecutive(touches);
    expect(result).toHaveLength(2);
  });

  it('interleaved: different channel breaks run', () => {
    const touches = [
      t('t1', 0, 'paid', 'google'),
      t('t2', 20_000, 'organic', 'none'), // breaks run
      t('t3', 40_000, 'paid', 'google'), // not consecutive with t1 anymore
    ];
    const result = dedupeConsecutive(touches);
    expect(result).toHaveLength(3);
  });

  it('three consecutive same-channel within 1 min → only first kept', () => {
    const touches = [
      t('t1', 0, 'paid', 'fb'),
      t('t2', 15_000, 'paid', 'fb'),
      t('t3', 30_000, 'paid', 'fb'),
    ];
    const result = dedupeConsecutive(touches);
    expect(result).toHaveLength(1);
    expect(result[0]!.touchId).toBe('t1');
  });

  it('unsorted input is sorted before deduplification', () => {
    const touches = [
      t('t3', 30_000, 'paid', 'fb'),
      t('t1', 0, 'paid', 'fb'),
      t('t2', 15_000, 'paid', 'fb'),
    ];
    const result = dedupeConsecutive(touches);
    expect(result).toHaveLength(1);
    expect(result[0]!.touchId).toBe('t1'); // earliest is kept
  });

  it('missing source treated same as empty string source', () => {
    const touches = [
      { touchId: 't1', ts: 0, channel: 'paid' },
      { touchId: 't2', ts: 30_000, channel: 'paid' }, // no source
    ];
    const result = dedupeConsecutive(touches);
    expect(result).toHaveLength(1);
  });

  it('1000 identical touches within window → single touch', () => {
    const touches = Array.from({ length: 1000 }, (_, i) =>
      t(`t${i}`, i * 50, 'paid', 'google'), // 50ms apart, all within 1-min window of prior
    );
    const result = dedupeConsecutive(touches);
    expect(result).toHaveLength(1);
    expect(result[0]!.touchId).toBe('t0');
  });
});
