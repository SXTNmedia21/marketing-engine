import type { ServerEvent, PixelDispatchResult } from './types.js';

export interface TikTokConfig {
  pixel_code: string;
  access_token: string;
  test_event_code?: string;
}

export function buildTikTokPayload(events: ServerEvent[], cfg: TikTokConfig) {
  return {
    pixel_code: cfg.pixel_code,
    test_event_code: cfg.test_event_code,
    batch: events.map((e) => ({
      event: e.event_name,
      event_id: e.event_id,
      timestamp: new Date(e.event_time).toISOString(),
      context: {
        user: {
          email: e.email_hash,
          phone_number: e.phone_hash,
          external_id: e.visitor_id,
        },
        ip: e.ip_truncated,
        user_agent: e.user_agent,
        page: { url: e.url, referrer: e.referrer },
      },
      properties: {
        campaign_id: e.campaign_id,
        ad_id: e.ad_id,
        variant: e.variant,
        ...e.custom,
      },
      limited_data_use: e.consent_state !== 'granted',
    })),
  };
}

export async function sendTikTok(
  events: ServerEvent[],
  cfg: TikTokConfig,
): Promise<PixelDispatchResult> {
  try {
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'access-token': cfg.access_token,
      },
      body: JSON.stringify(buildTikTokPayload(events, cfg)),
    });
    return { platform: 'tiktok', ok: res.ok, status: res.status };
  } catch (err) {
    return { platform: 'tiktok', ok: false, error: String(err) };
  }
}
