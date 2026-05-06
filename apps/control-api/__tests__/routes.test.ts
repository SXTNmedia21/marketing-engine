import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import { healthRoute } from '../src/routes/health.js';
import { lpRoute } from '../src/routes/lp.js';
import { generateRequestId, REQUEST_ID_HEADER } from '@me/shared';

// Mock the db module so postgres never connects
vi.mock('../src/db.js', () => ({
  sql: vi.fn(),
  initDb: vi.fn().mockResolvedValue(undefined),
}));

// Mock config so it doesn't need real env
vi.mock('../src/config.js', () => ({
  config: {
    env: 'development',
    port: 8080,
    database_url: 'postgres://test',
    control_plane_token: 'test_control_plane_token_32chars',
    twenty_api_url: 'http://localhost:3000',
    twenty_api_token: 'tok',
  },
}));

import { sql } from '../src/db.js';

async function buildTestApp() {
  const app = Fastify({ logger: false, trustProxy: true });
  await app.register(helmet, { contentSecurityPolicy: false });

  app.addHook('onRequest', async (req, reply) => {
    const id = (req.headers[REQUEST_ID_HEADER] as string) ?? generateRequestId();
    (req as unknown as { request_id: string }).request_id = id;
    reply.header(REQUEST_ID_HEADER, id);
  });

  await app.register(healthRoute);
  await app.register(lpRoute, { prefix: '/api' });

  return app;
}

const BEARER = 'test_control_plane_token_32chars';

describe('GET /health', () => {
  it('returns 200 with ok: true', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(typeof body.ts).toBe('number');
    await app.close();
  });
});

describe('POST /api/lp', () => {
  it('returns 401 without bearer token', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'POST', url: '/api/lp', payload: {} });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 401 with wrong bearer token', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/lp',
      headers: { authorization: 'Bearer wrong_token' },
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 400 for invalid LpConfig body', async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/lp',
      headers: { authorization: `Bearer ${BEARER}` },
      payload: { slug: 'BAD SLUG' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('invalid_config');
    await app.close();
  });
});

describe('GET /api/lp/:slug', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns 401 without bearer token', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'GET', url: '/api/lp/test-slug' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 404 for unknown slug', async () => {
    // sql returns empty array — slug not found
    vi.mocked(sql as unknown as (...args: unknown[]) => unknown).mockResolvedValue([] as never);
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/lp/unknown-slug',
      headers: { authorization: `Bearer ${BEARER}` },
    });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('not_found');
    await app.close();
  });
});

describe('POST /api/lp/kv-sync', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns 401 without bearer', async () => {
    const app = await buildTestApp();
    const res = await app.inject({ method: 'POST', url: '/api/lp/kv-sync', payload: {} });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 404 for unknown slug', async () => {
    vi.mocked(sql as unknown as (...args: unknown[]) => unknown).mockResolvedValue([] as never);
    const app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/lp/kv-sync',
      headers: { authorization: `Bearer ${BEARER}` },
      payload: { slug: 'nonexistent-slug' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
