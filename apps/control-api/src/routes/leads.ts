import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../db.js';
import { requireBearer } from '../auth.js';
import { logger, hashEmail } from '@me/shared';

const LeadSchema = z.object({
  slug: z.string(),
  visitor_id: z.string(),
  campaign_id: z.string().optional(),
  ad_id: z.string().optional(),
  fields: z.record(z.string()),
  ts: z.number(),
  ip_truncated: z.string().optional(),
  country: z.string().optional(),
  ua: z.string().optional(),
  referer: z.string().optional(),
});

export async function leadsRoute(app: FastifyInstance): Promise<void> {
  app.post('/leads', { preHandler: requireBearer }, async (req, reply) => {
    const parsed = LeadSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_payload', issues: parsed.error.issues };
    }
    const lead = parsed.data;
    const request_id = (req as unknown as { request_id: string }).request_id;
    const email = lead.fields.email;

    try {
      const email_hash = email ? await hashEmail(email) : null;
      const [row] = await sql<{ id: string }[]>`
        INSERT INTO leads (
          email, email_hash, visitor_id, campaign_id, ad_id, slug,
          fields, ip_truncated, country, ua, referer
        )
        VALUES (
          ${email ?? null}, ${email_hash}, ${lead.visitor_id}, ${lead.campaign_id ?? null},
          ${lead.ad_id ?? null}, ${lead.slug}, ${JSON.stringify(lead.fields)},
          ${lead.ip_truncated ?? null}, ${lead.country ?? null},
          ${lead.ua ?? null}, ${lead.referer ?? null}
        )
        RETURNING id
      `;
      logger.info({
        service: 'control-api',
        request_id,
        event: 'lead_created',
        slug: lead.slug,
        visitor_id: lead.visitor_id,
        payload: { lead_id: row?.id },
      });
      return { ok: true, lead_id: row?.id };
    } catch (err) {
      logger.error({
        service: 'control-api',
        request_id,
        event: 'lead_insert_failed',
        slug: lead.slug,
        payload: { error: String(err) },
      });
      reply.code(500);
      return { error: 'insert_failed' };
    }
  });
}
