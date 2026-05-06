\connect marketing_engine

-- Email events from Resend webhooks
CREATE TABLE IF NOT EXISTS email_events (
  id            bigserial PRIMARY KEY,
  ts            timestamptz NOT NULL DEFAULT now(),
  message_id    text NOT NULL,
  email_id_resend text,
  type          text NOT NULL,
  to_hash       text NOT NULL,
  contact_id    uuid,
  campaign_id   uuid,
  visitor_id    text,
  stream        text NOT NULL CHECK (stream IN ('marketing','transactional')),
  meta          jsonb NOT NULL DEFAULT '{}',
  request_id    text
);
CREATE INDEX IF NOT EXISTS idx_email_events_message ON email_events(message_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_contact ON email_events(contact_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON email_events(campaign_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_to_hash ON email_events(to_hash);

-- Suppression list (synced bidirectionally with Resend)
CREATE TABLE IF NOT EXISTS email_suppression (
  email_hash    text PRIMARY KEY,
  reason        text NOT NULL CHECK (reason IN (
    'hard_bounce','spam_complaint','manual_unsubscribe','invalid_address','consent_withdrawn'
  )),
  ts            timestamptz NOT NULL DEFAULT now(),
  source        text,
  meta          jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_email_suppression_ts ON email_suppression(ts DESC);

-- Outbound email queue / sends
CREATE TABLE IF NOT EXISTS email_sends (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    text UNIQUE NOT NULL,
  resend_id     text,
  to_hash       text NOT NULL,
  contact_id    uuid,
  campaign_id   uuid,
  visitor_id    text,
  template_id   text NOT NULL,
  template_props jsonb NOT NULL,
  stream        text NOT NULL CHECK (stream IN ('marketing','transactional')),
  status        text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','sent','delivered','bounced','complained','failed','suppressed')),
  scheduled_for timestamptz,
  sent_at       timestamptz,
  failed_reason text,
  ai_cost_nok   numeric(10,4),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_contact ON email_sends(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_scheduled ON email_sends(scheduled_for) WHERE status = 'queued';

-- Voice sessions (LiveKit dispatch + outcomes)
CREATE TABLE IF NOT EXISTS voice_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text UNIQUE NOT NULL,
  room_name     text NOT NULL,
  agent         text NOT NULL DEFAULT 'marketing_bdr',
  visitor_id    text NOT NULL,
  contact_id    uuid,
  campaign_id   uuid,
  purpose       text NOT NULL CHECK (purpose IN (
    'qualify_hot_lead','voicemail_drop','voice_lp_inbound','follow_up'
  )),
  phone_hash    text,
  consent_recorded boolean NOT NULL DEFAULT false,
  outcome       text CHECK (outcome IN (
    'connected','no_answer','voicemail_left','declined','meeting_booked',
    'qualified','disqualified','escalated_to_human','failed'
  )),
  duration_sec  int,
  recording_url text,
  transcript_url text,
  cost_nok      numeric(10,4),
  metadata      jsonb NOT NULL DEFAULT '{}',
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_voice_visitor ON voice_sessions(visitor_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_contact ON voice_sessions(contact_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_outcome ON voice_sessions(outcome);

-- Voice session events (one row per LiveKit event)
CREATE TABLE IF NOT EXISTS voice_session_events (
  id            bigserial PRIMARY KEY,
  ts            timestamptz NOT NULL DEFAULT now(),
  session_id    text NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_voice_events_session ON voice_session_events(session_id, ts);
