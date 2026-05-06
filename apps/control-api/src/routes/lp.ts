import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LpConfigSchema } from '@me/lp-config';
import { sql } from '../db.js';
import { requireBearer } from '../auth.js';
import { logger } from '@me/shared';

export async function lpRoute(app: FastifyInstance): Promise<void> {
  app.post('/lp', { preHandler: requireBearer }, async (req, reply) => {
    const parsed = LpConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_config', issues: parsed.error.issues };
    }
    const cfg = parsed.data;
    const request_id = (req as unknown as { request_id: string }).request_id;

    try {
      const [row] = await sql<{ id: string; version: number }[]>`
        INSERT INTO lp_pages (slug, template, version, config, status, campaign_id, ad_id)
        VALUES (
          ${cfg.slug}, ${cfg.template}, ${cfg.version}, ${JSON.stringify(cfg)},
          ${cfg.status}, ${cfg.tracking.campaign_id}, ${cfg.tracking.ad_id ?? null}
        )
        ON CONFLICT (slug) DO UPDATE SET
          template = EXCLUDED.template,
          version = lp_pages.version + 1,
          config = EXCLUDED.config,
          status = EXCLUDED.status
        RETURNING id, version
      `;
      logger.info({
        service: 'control-api',
        request_id,
        event: 'lp_upserted',
        slug: cfg.slug,
        payload: { id: row?.id, version: row?.version },
      });
      return { ok: true, id: row?.id, version: row?.version };
    } catch (err) {
      logger.error({
        service: 'control-api',
        request_id,
        event: 'lp_upsert_failed',
        slug: cfg.slug,
        payload: { error: String(err) },
      });
      reply.code(500);
      return { error: 'upsert_failed' };
    }
  });

  app.get<{ Params: { slug: string } }>('/lp/:slug', { preHandler: requireBearer }, async (req, reply) => {
    const [row] = await sql<{ config: unknown; version: number; status: string }[]>`
      SELECT config, version, status FROM lp_pages WHERE slug = ${req.params.slug}
    `;
    if (!row) {
      reply.code(404);
      return { error: 'not_found' };
    }
    return row;
  });

  // POST /api/lp/kv-sync
  // Queues a KV push for an active LP page. Actual push happens out-of-band
  // via scripts/kv-push.ts cron. Sets lp_pages.kv_sync_status = 'pending' and
  // inserts an lp_kv_pushes row with status = 'queued'.
  const KvSyncBodySchema = z.object({
    slug: z.string().min(1),
  });

  app.post('/lp/kv-sync', { preHandler: requireBearer }, async (req, reply) => {
    const request_id = (req as unknown as { request_id: string }).request_id;

    const parsed = KvSyncBodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_body', issues: parsed.error.issues };
    }
    const { slug } = parsed.data;

    // Look up the LP page
    const [page] = await sql<{ id: string; status: string; version: number }[]>`
      SELECT id, status, version FROM lp_pages WHERE slug = ${slug}
    `;

    if (!page) {
      logger.warn({
        service: 'control-api',
        request_id,
        event: 'kv_sync_not_found',
        slug,
      });
      reply.code(404);
      return { error: 'not_found' };
    }

    if (page.status !== 'active') {
      logger.warn({
        service: 'control-api',
        request_id,
        event: 'kv_sync_not_active',
        slug,
        payload: { status: page.status },
      });
      reply.code(409);
      return { error: 'not_active', status: page.status };
    }

    const queued_at = new Date();

    try {
      // Insert a queued push row
      await sql`
        INSERT INTO lp_kv_pushes (slug, version, status, request_id)
        VALUES (${slug}, ${page.version}, 'queued', ${request_id})
      `;

      // Mark the page as pending sync
      await sql`
        UPDATE lp_pages
        SET kv_sync_status = 'pending'
        WHERE id = ${page.id}
      `;
    } catch (err) {
      logger.error({
        service: 'control-api',
        request_id,
        event: 'kv_sync_queue_failed',
        slug,
        payload: { error: String(err) },
      });
      reply.code(500);
      return { error: 'queue_failed' };
    }

    logger.info({
      service: 'control-api',
      request_id,
      event: 'kv_sync_queued',
      slug,
      payload: { queued_at: queued_at.toISOString() },
    });

    return { ok: true, queued_at: queued_at.toISOString() };
  });
}
