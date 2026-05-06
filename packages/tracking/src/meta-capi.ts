import type { ServerEvent, PixelDispatchResult } from './types.js';

export interface MetaCapiConfig {
  pixel_id: string;
  access_token: string;
  test_event_code?: string;
}

export function buildMetaCapiPayload(events: ServerEvent[], cfg: MetaCapiConfig) {
  return {
    data: events.map((e) => ({
      event_name: e.event_name,
      event_id: e.event_id,
      event_time: Math.floor(e.event_time / 1000),
      action_source: 'website',
      event_source_url: e.url,
      user_data: {
        em: e.email_hash ? [e.email_hash] : undefined,
        ph: e.phone_hash ? [e.phone_hash] : undefined,
        client_ip_address: e.ip_truncated,
        client_user_agent: e.user_agent,
        external_id: [e.visitor_id],
      },
      custom_data: {
        campaign_id: e.campaign_id,
        ad_id: e.ad_id,
        variant: e.variant,
        ...e.custom,
      },
      data_processing_options: e.consent_state === 'granted' ? [] : ['LDU'],
    })),
    test_event_code: cfg.test_event_code,
  };
}

export async function sendMetaCapi(
  events: ServerEvent[],
  cfg: MetaCapiConfig,
): Promise<PixelDispatchResult> {
  const url = `https://graph.facebook.com/v20.0/${cfg.pixel_id}/events?access_token=${cfg.access_token}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildMetaCapiPayload(events, cfg)),
    });
    return { platform: 'meta', ok: res.ok, status: res.status };
  } catch (err) {
    return { platform: 'meta', ok: false, error: String(err) };
  }
}
