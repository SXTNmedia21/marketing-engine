import type { ServerEvent, PixelDispatchResult } from './types.js';

export interface Ga4Config {
  measurement_id: string;
  api_secret: string;
}

export function buildGa4Payload(events: ServerEvent[]) {
  if (events.length === 0) return null;
  const first = events[0]!;
  return {
    client_id: first.visitor_id,
    user_id: first.email_hash,
    events: events.map((e) => ({
      name: e.event_name,
      params: {
        engagement_time_msec: 1,
        session_id: e.visitor_id,
        campaign_id: e.campaign_id,
        ad_id: e.ad_id,
        variant: e.variant,
        consent_state: e.consent_state,
        ...e.custom,
      },
    })),
    consent: {
      ad_user_data: events[0]?.consent_state === 'granted' ? 'GRANTED' : 'DENIED',
      ad_personalization: events[0]?.consent_state === 'granted' ? 'GRANTED' : 'DENIED',
    },
  };
}

export async function sendGa4(events: ServerEvent[], cfg: Ga4Config): Promise<PixelDispatchResult> {
  const payload = buildGa4Payload(events);
  if (!payload) return { platform: 'ga4', ok: true };
  // GA4 Measurement Protocol requires api_secret as a query parameter (Google's spec).
  // NEVER include the full URL in any log output — it contains the api_secret in plaintext.
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${cfg.measurement_id}&api_secret=${cfg.api_secret}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { platform: 'ga4', ok: res.ok, status: res.status };
  } catch (err) {
    // Redact api_secret from any error message that may have captured the URL
    // (e.g. from a fetch error that includes the request URL in its toString).
    const safeError = String(err).replace(/api_secret=[^&"\s]+/g, 'api_secret=REDACTED');
    return {
      platform: 'ga4',
      ok: false,
      error: `ga4_send_failed mid:${cfg.measurement_id.slice(0, 6)}… ${safeError}`,
    };
  }
}
