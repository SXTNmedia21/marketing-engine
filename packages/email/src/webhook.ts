import { Webhook } from 'svix';
import { ResendWebhookSchema, type ResendWebhookEvent } from './types.js';

export interface WebhookVerifyResult {
  ok: boolean;
  event?: ResendWebhookEvent;
  error?: string;
}

export function verifyResendWebhook(
  body: string,
  headers: Record<string, string | undefined>,
  secret: string,
): WebhookVerifyResult {
  const wh = new Webhook(secret);

  const svixId = headers['svix-id'] ?? headers['Svix-Id'];
  const svixTs = headers['svix-timestamp'] ?? headers['Svix-Timestamp'];
  const svixSig = headers['svix-signature'] ?? headers['Svix-Signature'];

  if (!svixId || !svixTs || !svixSig) {
    return { ok: false, error: 'missing_svix_headers' };
  }

  let payload: unknown;
  try {
    payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTs,
      'svix-signature': svixSig,
    });
  } catch (err) {
    return { ok: false, error: `signature_invalid: ${String(err)}` };
  }

  const parsed = ResendWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: `payload_shape_invalid: ${parsed.error.message}` };
  }

  return { ok: true, event: parsed.data };
}
