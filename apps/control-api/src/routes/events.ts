import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../db.js';
import { requireBearer } from '../auth.js';
import { logger } from '@me/shared';

const EventSchema = z.object({
  type: z.string(),
  slug: z.string(),
  visitor_id: z.string(),
  campaign_id: z.string().optional(),
  ad_id: z.string().optional(),
  variant: z.string().optional(),
  ts: z.number(),
  ip_truncated: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  colo: z.string().optional(),
  ua: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

const BatchSchema = z.object({ events: z.array(EventSchema).min(1).max(500) });

export async function eventsRoute(app: FastifyInstance): Promise<void> {
  app.post('/events', { preHandler: requireBearer }, async (req, reply) => {
    const parsed = BatchSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_payload', issues: parsed.error.issues };
    }
    const { events } = parsed.data;
    const request_id = (req as unknown as { request_id: string }).request_id;

    try {
      const rows = events.map((e) => [
        new Date(e.ts).toISOString(),
        e.slug,
        e.visitor_id,
        e.type,
        JSON.stringify(e.payload ?? {}),
        e.ip_truncated ?? null,
        e.country ?? null,
      ]);
      await sql`
        INSERT INTO lp_events (ts, slug, visitor_id, event_type, payload, ip_truncated, country)
        SELECT * FROM ${sql(rows)}
      `;
      logger.info({
        service: 'control-api',
        request_id,
        event: 'events_ingested',
        payload: { count: events.length },
      });
      return { ok: true, count: events.length };
    } catch (err) {
      logger.error({
        service: 'control-api',
        request_id,
        event: 'events_insert_failed',
        payload: { error: String(err) },
      });
      reply.code(500);
      return { error: 'insert_failed' };
    }
  });
}
