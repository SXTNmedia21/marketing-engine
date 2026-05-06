import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log, logger } from '../src/logger.js';

describe('log() level routing', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('DEBUG routes to console.log', () => {
    log('DEBUG', { service: 'test', event: 'debug_test' });
    expect(logSpy).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('INFO routes to console.log', () => {
    log('INFO', { service: 'test', event: 'info_test' });
    expect(logSpy).toHaveBeenCalledOnce();
  });

  it('WARN routes to console.warn', () => {
    log('WARN', { service: 'test', event: 'warn_test' });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('ERROR routes to console.error', () => {
    log('ERROR', { service: 'test', event: 'error_test' });
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('FATAL routes to console.error', () => {
    log('FATAL', { service: 'test', event: 'fatal_test' });
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('emits valid JSON with correct shape', () => {
    log('INFO', { service: 'svc', event: 'test_event', request_id: 'req_abc' });
    const raw = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed).toMatchObject({
      level: 'INFO',
      service: 'svc',
      event: 'test_event',
      request_id: 'req_abc',
    });
    expect(typeof parsed.ts).toBe('string');
    expect(new Date(parsed.ts).toISOString()).toBe(parsed.ts);
  });

  it('includes optional payload fields', () => {
    log('INFO', {
      service: 'svc',
      event: 'with_extras',
      payload: { key: 'value' },
      slug: 'test-slug',
    });
    const raw = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.payload).toEqual({ key: 'value' });
    expect(parsed.slug).toBe('test-slug');
  });
});

describe('logger shortcuts', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logger.debug calls log with DEBUG', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug({ service: 's', event: 'e' });
    const raw = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(raw.level).toBe('DEBUG');
  });

  it('logger.error calls log with ERROR', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error({ service: 's', event: 'e' });
    const raw = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(raw.level).toBe('ERROR');
  });
});
