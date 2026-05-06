---
title: Scripts — kv-push
status: in_progress
created: 2026-05-06
updated: 2026-05-06
module: scripts
tags: [kv, cloudflare, postgres, deploy]
---

# @me/scripts

Standalone operational scripts for the marketing engine.

## kv-push

Pushes active LP configs from Postgres → Cloudflare KV (`LP_CONFIGS` namespace).

### Usage

```bash
# Push only pages that are out of sync (default, idempotent)
pnpm --filter @me/scripts kv-push

# Force re-push all active pages
pnpm --filter @me/scripts kv-push -- --all

# Push a single slug
pnpm --filter @me/scripts kv-push -- --slug my-lp-slug

# Dry run — validates + audits without writing to KV or updating kv_synced_at
pnpm --filter @me/scripts kv-push -- --dry-run

# Adjust concurrency (default 5)
pnpm --filter @me/scripts kv-push -- --concurrency 10

# Combine flags
pnpm --filter @me/scripts kv-push -- --dry-run --all --concurrency 3
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | All pages pushed successfully |
| `1` | Partial failure — at least one push failed |
| `2` | Fatal — env/config error, no pushes attempted |

### Required environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string (`postgres://user:pass@host/dbname`) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (KV owner) |
| `CLOUDFLARE_API_TOKEN` | API token with **KV Storage:Edit** permission |
| `CLOUDFLARE_KV_NAMESPACE_ID` | Namespace ID for `LP_CONFIGS` |
| `ENVIRONMENT` | `dev`, `staging`, or `prod` |

### Cloudflare token setup

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) → **My Profile** → **API Tokens**
2. Create token → **Edit Cloudflare Workers KV Storage** template
3. Scope to the correct account and namespace
4. Store token in 1Password as `op://smartout_ai_prod/cloudflare-kv-push/credential`
5. Reference in `.env` or your secrets manager — never hardcode

### Secret references (1Password)

```bash
# Example: inject via op run for local development
op run --env-file=.env -- pnpm --filter @me/scripts kv-push
```

`.env` template (never commit with real values):
```
DATABASE_URL=op://smartout_ai_prod/postgres/connection-string
CLOUDFLARE_ACCOUNT_ID=op://smartout_ai_prod/cloudflare/account-id
CLOUDFLARE_API_TOKEN=op://smartout_ai_prod/cloudflare-kv-push/credential
CLOUDFLARE_KV_NAMESPACE_ID=op://smartout_ai_prod/cloudflare-kv/lp-configs-namespace-id
ENVIRONMENT=dev
```

### Behavior notes

- **Idempotent by default**: only pages where `kv_synced_at IS NULL` or `updated_at > kv_synced_at` are pushed.
- **Batched**: 100 rows per DB fetch, `--concurrency` (default 5) concurrent KV writes.
- **Backoff**: 429 / 5xx responses trigger exponential backoff (1s → 2s → 4s → 8s, max 30s, max 5 retries).
- **Timeout**: each KV PUT times out at 30 seconds.
- **Size guard**: configs > 25 MB are hard-rejected; configs > 1 MB emit a WARN log.
- **Audit**: every push attempt writes a row to `lp_kv_pushes` regardless of outcome.
- **Privacy**: `account_id_hash` in audit rows is SHA-256 of the account ID, truncated to 16 hex chars. Raw account ID is never logged.

### Database migration

Run before first use:

```bash
psql "$DATABASE_URL" -f infra/postgres/init/04-kv-sync.sql
```

This adds `kv_synced_at` / `kv_sync_status` columns to `lp_pages` and creates the `lp_kv_pushes` audit table.
