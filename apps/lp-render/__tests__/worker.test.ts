import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index.js';
import type { Env } from '../src/index.js';
import type { LpConfig } from '@me/lp-config';

// ---------------------------------------------------------------------------
// Minimal KVNamespace stub
// ---------------------------------------------------------------------------
function makeKv(data: Record<string, unknown>): KVNamespace {
  return {
    get: vi.fn().mockImplementation(async (key: string, type?: string) => {
      const value = data[key];
      if (value === undefined) return null;
      if (type === 'json') return value;
      return JSON.stringify(value);
    }),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function makeEnv(kv: KVNamespace): Env {
  return {
    LP_CONFIGS: kv,
    EVENTS_ENDPOINT: 'https://events.example.com/events',
    FORM_ENDPOINT: 'https://form.example.com/submit',
    ENVIRONMENT: 'test',
  };
}

// A minimal valid active LpConfig
const ACTIVE_LP: LpConfig = {
  slug: 'test-lp',
  template: 'template_a_lead_capture',
  version: 1,
  status: 'active',
  theme: { primary: '#0F172A', background: '#FFFFFF', text: '#111827' },
  hero: { headline: 'Test LP Headline' },
  bullets: [],
  form: {
    fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
    submit_label: 'Submit',
    success_message: 'Thank you!',
  },
  pixels: {},
  tracking: { campaign_id: '550e8400-e29b-41d4-a716-446655440000' },
} as LpConfig;

const INACTIVE_LP: LpConfig = { ...ACTIVE_LP, status: 'paused' };

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('lp-render worker', () => {
  it('returns 404 for unknown slug', async () => {
    const kv = makeKv({});
    const env = makeEnv(kv);
    const req = new Request('https://lp.example.com/lp/nonexistent');
    const res = await worker.fetch(req, env, makeCtx());
    expect(res.status).toBe(404);
  });

  it('returns 404 for paths not matching /lp/<slug>', async () => {
    const kv = makeKv({});
    const env = makeEnv(kv);
    const req = new Request('https://lp.example.com/other/path');
    const res = await worker.fetch(req, env, makeCtx());
    expect(res.status).toBe(404);
  });

  it('returns 410 for inactive (paused) LP', async () => {
    const kv = makeKv({ 'lp:inactive-lp': INACTIVE_LP });
    const env = makeEnv(kv);
    const req = new Request('https://lp.example.com/lp/inactive-lp');
    const res = await worker.fetch(req, env, makeCtx());
    expect(res.status).toBe(410);
  });

  it('returns 200 with HTML for active LP', async () => {
    const kv = makeKv({ 'lp:test-lp': ACTIVE_LP });
    const env = makeEnv(kv);
    const req = new Request('https://lp.example.com/lp/test-lp');
    const res = await worker.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('<!DOCTYPE html>');
    expect(body).toContain('Test LP Headline');
  });

  it('sets a visitor cookie when none present', async () => {
    const kv = makeKv({ 'lp:test-lp': ACTIVE_LP });
    const env = makeEnv(kv);
    const req = new Request('https://lp.example.com/lp/test-lp');
    const res = await worker.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('_me_vid=');
  });

  it('does not set a new visitor cookie when one already exists', async () => {
    const kv = makeKv({ 'lp:test-lp': ACTIVE_LP });
    const env = makeEnv(kv);
    const req = new Request('https://lp.example.com/lp/test-lp', {
      headers: { cookie: '_me_vid=existing_visitor_id' },
    });
    const res = await worker.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    // Should not set a new cookie since we have an existing visitor
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeNull();
  });

  it('includes CSP header in response', async () => {
    const kv = makeKv({ 'lp:test-lp': ACTIVE_LP });
    const env = makeEnv(kv);
    const req = new Request('https://lp.example.com/lp/test-lp');
    const res = await worker.fetch(req, env, makeCtx());
    expect(res.headers.get('content-security-policy')).toBeTruthy();
  });
});
