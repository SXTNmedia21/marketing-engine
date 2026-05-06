\connect marketing_engine

-- KV sync columns on lp_pages (added idempotently)
ALTER TABLE lp_pages
  ADD COLUMN IF NOT EXISTS kv_synced_at   timestamptz,
  ADD COLUMN IF NOT EXISTS kv_sync_status text
    CHECK (kv_sync_status IN ('pending', 'synced', 'failed'));

CREATE INDEX IF NOT EXISTS idx_lp_pages_kv_sync
  ON lp_pages (status, kv_synced_at)
  WHERE status = 'active';

-- Audit table: one row per push attempt
CREATE TABLE IF NOT EXISTS lp_kv_pushes (
  id              bigserial PRIMARY KEY,
  slug            text        NOT NULL,
  version         int,
  status          text        NOT NULL
                    CHECK (status IN ('queued', 'pushed', 'failed', 'validation_failed', 'dry_run')),
  pushed_at       timestamptz NOT NULL DEFAULT now(),
  error           text,
  request_id      text,
  kv_namespace_id text,
  account_id_hash text        -- sha256 first 16 chars of CLOUDFLARE_ACCOUNT_ID; never raw
);

CREATE INDEX IF NOT EXISTS idx_lp_kv_pushes_slug_ts
  ON lp_kv_pushes (slug, pushed_at DESC);

CREATE INDEX IF NOT EXISTS idx_lp_kv_pushes_status_ts
  ON lp_kv_pushes (status, pushed_at DESC);
