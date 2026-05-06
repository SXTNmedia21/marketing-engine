import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildMetaCapiPayload, sendMetaCapi } from '../src/meta-capi.js';
import { buildGa4Payload, sendGa4 } from '../src/ga4.js';
import { buildTikTokPayload, sendTikTok } from '../src/tiktok.js';
import type { ServerEvent } from '../src/types.js';

function makeEvent(overrides: Partial<ServerEvent> = {}): ServerEvent {
  return {
    event_name: 'Lead',
    event_id: 'evt_001',
    event_time: 1700000000000,
    visitor_id: 'vis_abc',
    email_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    phone_hash: 'aabbcc',
    ip_truncated: '1.2.3.0',
    user_agent: 'Mozilla/5.0',
    url: 'https://example.com/lp/test',
    campaign_id: '550e8400-e29b-41d4-a716-446655440000',
    ad_id: 'ad_001',
    variant: 'a',
    consent_state: 'granted',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Meta CAPI
// ---------------------------------------------------------------------------
describe('buildMetaCapiPayload', () => {
  it('maps event fields correctly', () => {
    const event = makeEvent();
    const result = buildMetaCapiPayload([event], {
      pixel_id: 'px123',
      access_token: 'tok',
    });
    expect(result.data).toHaveLength(1);
    const d = result.data[0]!;
    expect(d.event_name).toBe('Lead');
    expect(d.event_time).toBe(Math.floor(1700000000000 / 1000));
    expect(d.action_source).toBe('website');
    expect(d.user_data.em).toEqual([event.email_hash]);
    expect(d.user_data.client_ip_address).toBe('1.2.3.0');
    expect(d.user_data.external_id).toEqual(['vis_abc']);
  });

  it('sets data_processing_options to [] when consent granted', () => {
    const result = buildMetaCapiPayload([makeEvent({ consent_state: 'granted' })], {
      pixel_id: 'px123',
      access_token: 'tok',
    });
    expect(result.data[0]!.data_processing_options).toEqual([]);
  });

  it('sets data_processing_options to [LDU] when consent denied', () => {
    const result = buildMetaCapiPayload([makeEvent({ consent_state: 'denied' })], {
      pixel_id: 'px123',
      access_token: 'tok',
    });
    expect(result.data[0]!.data_processing_options).toEqual(['LDU']);
  });

  it('includes test_event_code when provided', () => {
    const result = buildMetaCapiPayload([makeEvent()], {
      pixel_id: 'px123',
      access_token: 'tok',
      test_event_code: 'TEST123',
    });
    expect(result.test_event_code).toBe('TEST123');
  });
});

describe('sendMetaCapi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls fetch once and returns ok on 200', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendMetaCapi([makeEvent()], { pixel_id: 'px', access_token: 'tok' });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual({ platform: 'meta', ok: true, status: 200 });
  });

  it('returns ok: false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const result = await sendMetaCapi([makeEvent()], { pixel_id: 'px', access_token: 'tok' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Network error');
  });
});

// ---------------------------------------------------------------------------
// GA4
// ---------------------------------------------------------------------------
describe('buildGa4Payload', () => {
  it('returns null for empty events array', () => {
    expect(buildGa4Payload([])).toBeNull();
  });

  it('uses first event visitor_id as client_id', () => {
    const result = buildGa4Payload([makeEvent()]);
    expect(result!.client_id).toBe('vis_abc');
  });

  it('maps consent granted to GRANTED', () => {
    const result = buildGa4Payload([makeEvent({ consent_state: 'granted' })]);
    expect(result!.consent.ad_user_data).toBe('GRANTED');
    expect(result!.consent.ad_personalization).toBe('GRANTED');
  });

  it('maps consent denied to DENIED', () => {
    const result = buildGa4Payload([makeEvent({ consent_state: 'denied' })]);
    expect(result!.consent.ad_user_data).toBe('DENIED');
  });

  it('maps event name in events array', () => {
    const result = buildGa4Payload([makeEvent({ event_name: 'page_view' })]);
    expect(result!.events[0]!.name).toBe('page_view');
  });
});

describe('sendGa4', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns ok: true immediately for empty events', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    const result = await sendGa4([], { measurement_id: 'G-X', api_secret: 'sec' });
    expect(result).toEqual({ platform: 'ga4', ok: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls fetch once and returns ok on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const result = await sendGa4([makeEvent()], { measurement_id: 'G-X', api_secret: 'sec' });
    expect(result).toEqual({ platform: 'ga4', ok: true, status: 200 });
  });

  it('returns ok: false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const result = await sendGa4([makeEvent()], { measurement_id: 'G-X', api_secret: 'sec' });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TikTok
// ---------------------------------------------------------------------------
describe('buildTikTokPayload', () => {
  it('includes pixel_code from config', () => {
    const result = buildTikTokPayload([makeEvent()], {
      pixel_code: 'TIKTOK_PX',
      access_token: 'tok',
    });
    expect(result.pixel_code).toBe('TIKTOK_PX');
  });

  it('maps event fields into batch', () => {
    const result = buildTikTokPayload([makeEvent()], {
      pixel_code: 'PX',
      access_token: 'tok',
    });
    expect(result.batch).toHaveLength(1);
    const b = result.batch[0]!;
    expect(b.event).toBe('Lead');
    expect(b.context.user.email).toBe(makeEvent().email_hash);
    expect(b.context.ip).toBe('1.2.3.0');
  });

  it('sets limited_data_use = false when consent granted', () => {
    const result = buildTikTokPayload([makeEvent({ consent_state: 'granted' })], {
      pixel_code: 'PX',
      access_token: 'tok',
    });
    expect(result.batch[0]!.limited_data_use).toBe(false);
  });

  it('sets limited_data_use = true when consent denied', () => {
    const result = buildTikTokPayload([makeEvent({ consent_state: 'denied' })], {
      pixel_code: 'PX',
      access_token: 'tok',
    });
    expect(result.batch[0]!.limited_data_use).toBe(true);
  });
});

describe('sendTikTok', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls fetch once and returns ok on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const result = await sendTikTok([makeEvent()], {
      pixel_code: 'PX',
      access_token: 'tok',
    });
    expect(result).toEqual({ platform: 'tiktok', ok: true, status: 200 });
  });

  it('returns ok: false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    const result = await sendTikTok([makeEvent()], { pixel_code: 'PX', access_token: 'tok' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('fail');
  });
});
