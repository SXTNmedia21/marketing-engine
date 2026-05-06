import { z } from 'zod';

export const EmailEventTypeSchema = z.enum([
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.complained',
  'email.opened',
  'email.clicked',
]);

export type EmailEventType = z.infer<typeof EmailEventTypeSchema>;

export const ResendWebhookSchema = z.object({
  type: EmailEventTypeSchema,
  created_at: z.string(),
  data: z.object({
    email_id: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    subject: z.string(),
    created_at: z.string(),
    bounce: z
      .object({
        type: z.enum(['hard', 'soft', 'undetermined']),
        message: z.string().optional(),
      })
      .optional(),
    click: z
      .object({
        link: z.string().url(),
        timestamp: z.string(),
        ip_address: z.string().optional(),
        user_agent: z.string().optional(),
      })
      .optional(),
  }),
});

export type ResendWebhookEvent = z.infer<typeof ResendWebhookSchema>;

export const SendStreamSchema = z.enum(['marketing', 'transactional']);
export type SendStream = z.infer<typeof SendStreamSchema>;

export const ConsentStateSchema = z.enum(['granted', 'denied', 'unknown']);
export type ConsentState = z.infer<typeof ConsentStateSchema>;

export interface SendOptions {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  stream: SendStream;
  campaign_id?: string;
  contact_id?: string;
  visitor_id?: string;
  idempotency_key: string;
  tags?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface SendResult {
  ok: boolean;
  message_id?: string;
  error?: string;
  suppressed_reason?: string;
}
