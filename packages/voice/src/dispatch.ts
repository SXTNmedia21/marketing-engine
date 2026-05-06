// TODO: If the dispatch endpoint ever requires a header credential (e.g. a shared
// secret for mutual auth), add it here as a separate cfg field — do NOT reuse api_key.
import { AccessToken } from 'livekit-server-sdk';
import { logger } from '@me/shared';
import type { DispatchInput, DispatchResult } from './types.js';

export interface LiveKitConfig {
  url: string;
  api_key: string;
  api_secret: string;
  agent_dispatch_endpoint: string;
}

export class VoiceDispatcher {
  constructor(private cfg: LiveKitConfig) {}

  async dispatchMarketingBdr(input: DispatchInput): Promise<DispatchResult> {
    if (!input.consent_recorded) {
      return { ok: false, error: 'consent_not_recorded' };
    }

    const session_id = `vs_${crypto.randomUUID()}`;
    const room_name = `marketing-${session_id}`;

    try {
      const at = new AccessToken(this.cfg.api_key, this.cfg.api_secret, {
        identity: `me-bdr-${session_id}`,
        ttl: 60 * 30,
      });
      at.addGrant({
        roomJoin: true,
        room: room_name,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      const token = await at.toJwt();

      const res = await fetch(this.cfg.agent_dispatch_endpoint, {
        method: 'POST',
        headers: {
          // LiveKit agent dispatch authenticates via the signed access_token in the body,
          // not via an Authorization header.  api_key must NOT be sent as a Bearer token.
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          agent: 'marketing_bdr',
          room_name,
          session_id,
          access_token: token,
          dial: { phone_number: input.phone_number },
          metadata: {
            visitor_id: input.visitor_id,
            contact_id: input.contact_id,
            campaign_id: input.campaign_id,
            purpose: input.purpose,
            context_summary: input.context_summary,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        logger.error({
          service: 'voice',
          event: 'dispatch_failed',
          payload: { status: res.status, body: body.slice(0, 200), session_id },
        });
        return { ok: false, error: `dispatch_${res.status}` };
      }

      logger.info({
        service: 'voice',
        event: 'dispatch_ok',
        payload: { session_id, purpose: input.purpose, room_name },
      });

      return { ok: true, session_id, room_name };
    } catch (err) {
      logger.error({
        service: 'voice',
        event: 'dispatch_exception',
        payload: { error: String(err), session_id },
      });
      return { ok: false, error: String(err) };
    }
  }
}
