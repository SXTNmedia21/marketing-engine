import { describe, it, expect } from 'vitest';
import { sha256Hex, hashEmail, truncateIp } from '../src/hash.js';

describe('sha256Hex', () => {
  it('produces a 64-char hex string', async () => {
    const result = await sha256Hex('hello');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', async () => {
    const a = await sha256Hex('test-input');
    const b = await sha256Hex('test-input');
    expect(a).toBe(b);
  });

  it('produces different hash for different input', async () => {
    const a = await sha256Hex('foo');
    const b = await sha256Hex('bar');
    expect(a).not.toBe(b);
  });

  it('known SHA-256 for empty string', async () => {
    const result = await sha256Hex('');
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('hashEmail', () => {
  it('trims whitespace before hashing', async () => {
    const trimmed = await hashEmail('user@example.com');
    const padded = await hashEmail('  user@example.com  ');
    expect(trimmed).toBe(padded);
  });

  it('lowercases before hashing', async () => {
    const lower = await hashEmail('user@example.com');
    const upper = await hashEmail('USER@EXAMPLE.COM');
    expect(lower).toBe(upper);
  });

  it('trim + lowercase combined', async () => {
    const base = await hashEmail('user@example.com');
    const messy = await hashEmail('  USER@EXAMPLE.COM  ');
    expect(base).toBe(messy);
  });
});

describe('truncateIp', () => {
  it('zeroes last octet for IPv4', () => {
    expect(truncateIp('1.2.3.4')).toBe('1.2.3.0');
    expect(truncateIp('192.168.1.99')).toBe('192.168.1.0');
  });

  it('keeps first 4 groups for IPv6', () => {
    const result = truncateIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    expect(result).toBe('2001:0db8:85a3:0000::');
  });

  it('handles short IPv6', () => {
    const result = truncateIp('fe80:0000:0000:0001:dead:beef:1234:5678');
    expect(result).toBe('fe80:0000:0000:0001::');
  });

  it('passes through unrecognised formats unchanged', () => {
    expect(truncateIp('unknown')).toBe('unknown');
  });
});
