/**
 * Unit tests for pure helpers in kv-push.ts.
 * We do not import kv-push.ts directly (it calls main() and would try to
 * connect to Postgres). Instead we re-implement/inline the helpers here
 * and verify their logic, cross-referencing the source.
 *
 * Source: scripts/kv-push.ts
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// parseArgs — inlined from kv-push.ts for unit testing
// ---------------------------------------------------------------------------
interface CliFlags {
  dryRun: boolean;
  slug: string | null;
  all: boolean;
  concurrency: number;
}

function parseArgs(argv: string[]): CliFlags {
  const args = argv.slice(2);
  const flags: CliFlags = { dryRun: false, slug: null, all: false, concurrency: 5 };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--all') flags.all = true;
    else if (arg === '--slug' && args[i + 1]) {
      flags.slug = args[++i] ?? null;
    } else if (arg === '--concurrency' && args[i + 1]) {
      const n = parseInt(args[++i] ?? '5', 10);
      if (!Number.isNaN(n) && n > 0) flags.concurrency = n;
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// backoff timing — inlined from kv-push.ts
// ---------------------------------------------------------------------------
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function calcBackoff(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
}

// ---------------------------------------------------------------------------
// KV size check — inlined from kv-push.ts
// ---------------------------------------------------------------------------
const MAX_KV_BYTES = 25 * 1024 * 1024;
const WARN_KV_BYTES = 1 * 1024 * 1024;

function checkKvPayloadSize(value: string): 'ok' | 'warn' | 'error' {
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes > MAX_KV_BYTES) return 'error';
  if (bytes > WARN_KV_BYTES) return 'warn';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Tests: parseArgs
// ---------------------------------------------------------------------------
describe('parseArgs', () => {
  it('defaults are dry:false, slug:null, all:false, concurrency:5', () => {
    const flags = parseArgs(['node', 'kv-push.ts']);
    expect(flags).toEqual({ dryRun: false, slug: null, all: false, concurrency: 5 });
  });

  it('parses --dry-run', () => {
    const flags = parseArgs(['node', 'kv-push.ts', '--dry-run']);
    expect(flags.dryRun).toBe(true);
  });

  it('parses --all', () => {
    const flags = parseArgs(['node', 'kv-push.ts', '--all']);
    expect(flags.all).toBe(true);
  });

  it('parses --slug <value>', () => {
    const flags = parseArgs(['node', 'kv-push.ts', '--slug', 'my-lp']);
    expect(flags.slug).toBe('my-lp');
  });

  it('parses --concurrency <n>', () => {
    const flags = parseArgs(['node', 'kv-push.ts', '--concurrency', '10']);
    expect(flags.concurrency).toBe(10);
  });

  it('ignores invalid concurrency (NaN)', () => {
    const flags = parseArgs(['node', 'kv-push.ts', '--concurrency', 'abc']);
    expect(flags.concurrency).toBe(5); // unchanged default
  });

  it('parses combined flags', () => {
    const flags = parseArgs(['node', 'kv-push.ts', '--dry-run', '--slug', 'abc', '--concurrency', '3']);
    expect(flags.dryRun).toBe(true);
    expect(flags.slug).toBe('abc');
    expect(flags.concurrency).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: backoff timing
// ---------------------------------------------------------------------------
describe('backoff timing', () => {
  it('attempt 0 = 1000ms', () => {
    expect(calcBackoff(0)).toBe(1000);
  });

  it('attempt 1 = 2000ms', () => {
    expect(calcBackoff(1)).toBe(2000);
  });

  it('attempt 4 = 16000ms', () => {
    expect(calcBackoff(4)).toBe(16000);
  });

  it('caps at MAX_BACKOFF_MS (30000ms)', () => {
    expect(calcBackoff(10)).toBe(30000);
    expect(calcBackoff(100)).toBe(30000);
  });
});

// ---------------------------------------------------------------------------
// Tests: KV payload size check
// ---------------------------------------------------------------------------
describe('checkKvPayloadSize', () => {
  it('returns ok for small payload', () => {
    expect(checkKvPayloadSize('{"slug":"abc"}')).toBe('ok');
  });

  it('returns warn for payload > 1MB but <= 25MB', () => {
    const large = 'x'.repeat(1_100_000); // ~1.1 MB
    expect(checkKvPayloadSize(large)).toBe('warn');
  });

  it('returns error for payload > 25MB', () => {
    const huge = 'x'.repeat(26 * 1024 * 1024); // ~26 MB
    expect(checkKvPayloadSize(huge)).toBe('error');
  });
});
