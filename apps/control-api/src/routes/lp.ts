import type { FastifyInstance } from 'fastify';
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
}
