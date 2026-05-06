\connect marketing_engine

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- LP pages: versioned config, source of truth (KV is mirror)
CREATE TABLE IF NOT EXISTS lp_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  template      text NOT NULL,
  version       int  NOT NULL DEFAULT 1,
  config        jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','paused','deleted')),
  campaign_id   uuid,
  ad_id         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  activated_at  timestamptz,
  deactivated_at timestamptz,
  expires_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_lp_pages_status ON lp_pages(status);
CREATE INDEX IF NOT EXISTS idx_lp_pages_campaign ON lp_pages(campaign_id);

-- LP events (partitioned by day)
CREATE TABLE IF NOT EXISTS lp_events (
  id            bigserial,
  ts            timestamptz NOT NULL,
  slug          text NOT NULL,
  visitor_id    text NOT NULL,
  session_id    text,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}',
  ip_truncated  inet,
  country       text,
  ua_hash       text,
  PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

CREATE INDEX IF NOT EXISTS idx_lp_events_slug_ts ON lp_events(slug, ts DESC);
CREATE INDEX IF NOT EXISTS idx_lp_events_visitor_ts ON lp_events(visitor_id, ts DESC);

-- Default partition (will be replaced by daily partitions via cron)
CREATE TABLE IF NOT EXISTS lp_events_default PARTITION OF lp_events DEFAULT;

-- Leads (mirrored to Twenty Contact)
CREATE TABLE IF NOT EXISTS leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text,
  email_hash    text,
  visitor_id    text NOT NULL,
  contact_id    uuid,
  campaign_id   uuid,
  ad_id         text,
  slug          text,
  fields        jsonb NOT NULL DEFAULT '{}',
  attribution_path jsonb,
  first_touch   jsonb,
  last_touch    jsonb,
  ip_truncated  inet,
  country       text,
  ua            text,
  referer       text,
  status        text NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','contacted','qualified','negotiating','won','lost')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  identified_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_leads_email_hash ON leads(email_hash);
CREATE INDEX IF NOT EXISTS idx_leads_visitor ON leads(visitor_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);

-- AI spend log
CREATE TABLE IF NOT EXISTS ai_spend_log (
  id            bigserial PRIMARY KEY,
  ts            timestamptz NOT NULL DEFAULT now(),
  campaign_id   uuid,
  workflow_id   text,
  model         text NOT NULL,
  prompt_tokens int,
  completion_tokens int,
  cost_nok      numeric(10,4) NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ai_spend_ts ON ai_spend_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_ai_spend_campaign ON ai_spend_log(campaign_id);

-- Ad spend log
CREATE TABLE IF NOT EXISTS ad_spend_log (
  id            bigserial PRIMARY KEY,
  ts            timestamptz NOT NULL DEFAULT now(),
  platform      text NOT NULL,
  campaign_id   uuid,
  ad_id         text,
  creative_id   text,
  budget_nok    numeric(10,2) NOT NULL,
  spend_nok     numeric(10,2),
  action        text NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ad_spend_ts ON ad_spend_log(ts DESC);

-- Consent records (GDPR)
CREATE TABLE IF NOT EXISTS consent_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id    text NOT NULL,
  ts            timestamptz NOT NULL DEFAULT now(),
  version       text NOT NULL,
  categories    text[] NOT NULL,
  ip_truncated  inet,
  ua_hash       text
);
CREATE INDEX IF NOT EXISTS idx_consent_visitor ON consent_records(visitor_id, ts DESC);
