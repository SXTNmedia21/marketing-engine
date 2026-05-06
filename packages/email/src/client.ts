import { Resend } from 'resend';
import { logger } from '@me/shared';
import type { SendOptions, SendResult } from './types.js';

export interface EmailClientConfig {
  api_key: string;
  default_from: string;
  default_reply_to?: string;
}

export interface SuppressionChecker {
  isSuppressed(email: string): Promise<{ suppressed: boolean; reason?: string }>;
}

export class EmailClient {
  private resend: Resend;

  constructor(
    private cfg: EmailClientConfig,
    private suppression: SuppressionChecker,
  ) {
    this.resend = new Resend(cfg.api_key);
  }

  async send(opts: SendOptions): Promise<SendResult> {
    const supp = await this.suppression.isSuppressed(opts.to);
    if (supp.suppressed) {
      logger.warn({
        service: 'email',
        event: 'send_blocked_suppression',
        payload: { to_hash: hashEmailLogSafe(opts.to), reason: supp.reason },
      });
      return { ok: false, suppressed_reason: supp.reason ?? 'unknown' };
    }

    try {
      const tags = [
        { name: 'stream', value: opts.stream },
        ...(opts.campaign_id ? [{ name: 'campaign_id', value: opts.campaign_id }] : []),
        ...(opts.contact_id ? [{ name: 'contact_id', value: opts.contact_id }] : []),
        ...(opts.visitor_id ? [{ name: 'visitor_id', value: opts.visitor_id }] : []),
        ...Object.entries(opts.tags ?? {}).map(([name, value]) => ({ name, value })),
      ];

      const replyTo = opts.reply_to ?? this.cfg.default_reply_to;
      const result = await this.resend.emails.send(
        {
          from: opts.from || this.cfg.default_from,
          to: [opts.to],
          subject: opts.subject,
          html: opts.html,
          ...(opts.text ? { text: opts.text } : {}),
          ...(replyTo ? { replyTo } : {}),
          headers: {
            'X-Idempotency-Key': opts.idempotency_key,
            ...(opts.headers ?? {}),
          },
          tags,
        },
        { idempotencyKey: opts.idempotency_key },
      );

      if (result.error) {
        logger.error({
          service: 'email',
          event: 'send_failed',
          payload: { error: result.error.message, to_hash: hashEmailLogSafe(opts.to) },
        });
        return { ok: false, error: result.error.message };
      }

      logger.info({
        service: 'email',
        event: 'send_ok',
        payload: { message_id: result.data?.id, stream: opts.stream },
      });

      return { ok: true, message_id: result.data?.id };
    } catch (err) {
      logger.error({
        service: 'email',
        event: 'send_exception',
        payload: { error: String(err), to_hash: hashEmailLogSafe(opts.to) },
      });
      return { ok: false, error: String(err) };
    }
  }
}

function hashEmailLogSafe(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (h * 31 + email.charCodeAt(i)) >>> 0;
  }
  return `e_${h.toString(16)}`;
}
