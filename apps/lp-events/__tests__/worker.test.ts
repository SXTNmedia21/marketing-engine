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

const VALID_EVENT = {
  type: 'pageview',
  slug: 'test-lp',
  visitor_id: 'vis_001',
  campaign_id: 'camp_001',
  ts: Date.now(),
};

describe('lp-events worker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns 405 for non-POST methods', async () => {
    const req = new Request('https://events.example.com/events', { method: 'GET' });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(405);
  });

  it('returns 404 for wrong path', async () => {
    const req = new Request('https://events.example.com/other', { method: 'POST' });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('https://events.example.com/events', {
      method: 'POST',
      body: 'not valid json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it('returns 204 for valid batch POST', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const req = new Request('https://events.example.com/events', {
      method: 'POST',
      body: JSON.stringify([VALID_EVENT]),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(204);
  });

  it('returns 204 for single event (non-array)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const req = new Request('https://events.example.com/events', {
      method: 'POST',
      body: JSON.stringify(VALID_EVENT),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(204);
  });

  it('returns 400 for batch exceeding 100 events', async () => {
    const events = Array.from({ length: 101 }, () => VALID_EVENT);
    const req = new Request('https://events.example.com/events', {
      method: 'POST',
      body: JSON.stringify(events),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.status).toBe(400);
  });

  it('includes x-request-id header in 204 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const req = new Request('https://events.example.com/events', {
      method: 'POST',
      body: JSON.stringify([VALID_EVENT]),
      headers: { 'content-type': 'application/json' },
    });
    const res = await worker.fetch(req, makeEnv(), makeCtx());
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
});
