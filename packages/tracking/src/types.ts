export interface ServerEvent {
  event_name: string;
  event_id: string;
  event_time: number;
  visitor_id: string;
  email_hash?: string;
  phone_hash?: string;
  ip_truncated?: string;
  user_agent?: string;
  url: string;
  referrer?: string;
  campaign_id: string;
  ad_id?: string;
  variant?: string;
  consent_state: 'granted' | 'denied' | 'unknown';
  custom?: Record<string, unknown>;
}

export interface PixelDispatchResult {
  platform: string;
  ok: boolean;
  status?: number;
  error?: string;
}
