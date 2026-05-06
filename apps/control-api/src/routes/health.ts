import type { FastifyInstance } from 'fastify';
import { sql } from '../db.js';

export async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ ok: true, ts: Date.now() }));
  app.get('/health/db', async (_req, reply) => {
    try {
      await sql`SELECT 1`;
      return { ok: true };
    } catch (err) {
      reply.code(503);
      return { ok: false, error: String(err) };
    }
  });
}
