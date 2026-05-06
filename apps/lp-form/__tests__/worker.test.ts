import { describe, it, expect, vi, afterEach } from 'vitest';
import worker from '../src/index.js';
import type { Env } from '../src/index.js';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    CONTROL_PLANE_URL: 'https://control.example.com',
    CONTROL_PLANE_TOKEN: 'test_token',
    ENVIRONMENT: 'test',
    ...overrides,
  };
}

function makeCtx(): ExecutionContext {
  return { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
}

const VALID_BODY = {
  slug: 'test-lp',
  visitor_id: 'vis_001',
  fields: { email: 'test@example.com', name: 'Test User' },
  ts: Date.now(),
};

describe('lp-form worker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns 200 for OPTIONS preflight with CORS headers', async () => {
    const req = new Request('https://form.example.com/submit', { method: 'OPTIONS' });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('returns 405 for non-POST/OPTIONS methods', async () => {
    const req = new Request('https://form.example.com/submit', { method: 'GET' });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(405);
  });

  it('returns 404 for wrong path', async () => {
    const req = new Request('https://form.example.com/other', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('https://form.example.com/submit', {
      method: 'POST',
      body: 'not valid json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const req = new Request('https://form.example.com/submit', {
      method: 'POST',
      body: JSON.stringify({ ts: Date.now() }), // missing slug, visitor_id, fields
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it('returns 200 for valid submission when control plane returns 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );

    const req = new Request('https://form.example.com/submit', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.ok).toBe(true);
  });

  it('returns 502 when control plane is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const req = new Request('https://form.example.com/submit', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(502);
  });

  it('returns CORS headers on 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const req = new Request('https://form.example.com/submit', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
