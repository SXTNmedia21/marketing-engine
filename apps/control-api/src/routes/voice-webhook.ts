import type { FastifyInstance } from 'fastify';
import { verifyVoiceWebhook } from '@me/voice';
import { logger } from '@me/shared';
import { sql } from '../db.js';
import { config } from '../config.js';

export async function voiceWebhookRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Body: string }>('/voice', async (req, reply) => {
    const request_id = (req as unknown as { request_id: string }).request_id;
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (!config.livekit_webhook_secret) {
      reply.code(500);
      return { error: 'webhook_not_configured' };
    }

    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }

    const verified = await verifyVoiceWebhook(raw, headers, config.livekit_webhook_secret);
    if (!verified.ok || !verified.event) {
      logger.warn({
        service: 'control-api',
        request_id,
        event: 'voice_webhook_invalid',
        payload: { error: verified.error },
      });
      reply.code(401);
      return { error: 'unauthorized' };
    }

    const evt = verified.event;

    try {
      await sql`
        INSERT INTO voice_session_events (session_id, event_type, payload)
        VALUES (${evt.session_id}, ${evt.event}, ${JSON.stringify(evt.payload)})
      `;

      if (evt.event === 'session.ended') {
        const outcome = (evt.payload['outcome'] as string) ?? 'failed';
        const duration = (evt.payload['duration_sec'] as number) ?? null;
        const recording = (evt.payload['recording_url'] as string) ?? null;
        const transcript = (evt.payload['transcript_url'] as string) ?? null;
        const cost = (evt.payload['cost_nok'] as number) ?? null;
        await sql`
          UPDATE voice_sessions
          SET outcome = ${outcome},
              duration_sec = ${duration},
              recording_url = ${recording},
              transcript_url = ${transcript},
              cost_nok = ${cost},
              ended_at = now()
          WHERE session_id = ${evt.session_id}
        `;
      }

      logger.info({
        service: 'control-api',
        request_id,
        event: 'voice_webhook_processed',
        payload: { session_id: evt.session_id, type: evt.event },
      });
      return { ok: true };
    } catch (err) {
      logger.error({
        service: 'control-api',
        request_id,
        event: 'voice_webhook_db_failed',
        payload: { error: String(err) },
      });
      reply.code(500);
      return { error: 'db_failed' };
    }
  });
}
