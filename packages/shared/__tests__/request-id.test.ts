import { describe, it, expect } from 'vitest';
import { generateRequestId, REQUEST_ID_HEADER } from '../src/request-id.js';

describe('generateRequestId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateRequestId()).toBe('string');
    expect(generateRequestId().length).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
    expect(ids.size).toBe(100);
  });

  it('returns a UUID-formatted string (crypto.randomUUID path)', () => {
    const id = generateRequestId();
    // UUID format: 8-4-4-4-12 hex chars
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('REQUEST_ID_HEADER', () => {
  it('is lowercase x-request-id', () => {
    expect(REQUEST_ID_HEADER).toBe('x-request-id');
  });
});
