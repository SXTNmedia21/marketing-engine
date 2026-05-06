import { LiveKitSessionEventSchema, type LiveKitSessionEvent } from './types.js';

export interface VoiceWebhookVerifyResult {
  ok: boolean;
  event?: LiveKitSessionEvent;
  error?: string;
}

export async function verifyVoiceWebhook(
  body: string,
  headers: Record<string, string | undefined>,
  secret: string,
): Promise<VoiceWebhookVerifyResult> {
  const sig = headers['x-livekit-signature'] ?? headers['X-LiveKit-Signature'];
  if (!sig) return { ok: false, error: 'missing_signature' };

  const expected = await hmacSha256Hex(secret, body);
  if (!constantTimeEqual(sig, expected)) {
    return { ok: false, error: 'signature_invalid' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }

  const parsed = LiveKitSessionEventSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: `payload_shape_invalid: ${parsed.error.message}` };
  }

  return { ok: true, event: parsed.data };
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
