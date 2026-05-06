import type { FastifyInstance } from 'fastify';
import { verifyResendWebhook } from '@me/email';
import { logger, hashEmail } from '@me/shared';
import { sql } from '../db.js';
import { config } from '../config.js';

export async function emailWebhookRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Body: string }>('/email', async (req, reply) => {
    const request_id = (req as unknown as { request_id: string }).request_id;
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (!config.resend_webhook_secret) {
      reply.code(500);
      return { error: 'webhook_not_configured' };
    }

    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }

    const verified = verifyResendWebhook(raw, headers, config.resend_webhook_secret);
    if (!verified.ok || !verified.event) {
      logger.warn({
        service: 'control-api',
        request_id,
        event: 'email_webhook_invalid',
        payload: { error: verified.error },
      });
      reply.code(401);
      return { error: 'unauthorized' };
    }

    const evt = verified.event;
    const to = evt.data.to[0];
    if (!to) {
      reply.code(400);
      return { error: 'no_recipient' };
    }
    const to_hash = await hashEmail(to);

    try {
      await sql`
        INSERT INTO email_events (message_id, email_id_resend, type, to_hash, stream, meta, request_id)
        VALUES (
          ${evt.data.email_id}, ${evt.data.email_id}, ${evt.type}, ${to_hash},
          ${'marketing'}, ${JSON.stringify(evt.data)}, ${request_id}
        )
      `;

      if (evt.type === 'email.bounced' && evt.data.bounce?.type === 'hard') {
        await sql`
          INSERT INTO email_suppression (email_hash, reason, source, meta)
          VALUES (${to_hash}, 'hard_bounce', 'resend_webhook', ${JSON.stringify(evt.data.bounce)})
          ON CONFLICT (email_hash) DO NOTHING
        `;
      } else if (evt.type === 'email.complained') {
        await sql`
          INSERT INTO email_suppression (email_hash, reason, source, meta)
          VALUES (${to_hash}, 'spam_complaint', 'resend_webhook', ${JSON.stringify(evt.data)})
          ON CONFLICT (email_hash) DO NOTHING
        `;
      }

      logger.info({
        service: 'control-api',
        request_id,
        event: 'email_webhook_processed',
        payload: { type: evt.type, message_id: evt.data.email_id },
      });
      return { ok: true };
    } catch (err) {
      logger.error({
        service: 'control-api',
        request_id,
        event: 'email_webhook_db_failed',
        payload: { error: String(err) },
      });
      reply.code(500);
      return { error: 'db_failed' };
    }
  });
}
