# Infra — Control plane

Docker Compose stack for Hetzner. Render plane (Cloudflare Workers) deploys separately via wrangler.

## Services

| Service | Image / Build | Port (internal) | Domain |
|---|---|---|---|
| `caddy` | `caddy:2.8-alpine` | 80/443 | — |
| `postgres` | `postgres:16-alpine` | 5432 | — |
| `redis` | `redis:7-alpine` | 6379 | — |
| `twenty-server` | build from `vendor/twenty` | 3000 | `crm.example.com` |
| `twenty-worker` | build from `vendor/twenty` | — | — |
| `n8n` | `docker.n8n.io/n8nio/n8n` | 5678 | `n8n.example.com` |
| `postiz` | build from `vendor/postiz-app` | 3000 | `postiz.example.com` |
| `control-api` | build from `apps/control-api` | 8080 | `api.example.com` |
| `minio` | `minio/minio:latest` | 9000/9001 | `minio.example.com` |
| `loki` | `grafana/loki:3.3.2` | 3100 | — |
| `promtail` | `grafana/promtail:3.3.2` | — | — |
| `grafana` | `grafana/grafana:11.4.0` | 3000 | `grafana.example.com` |

## Setup

```bash
cp .env.example .env
# Generate secrets, fill in domains
openssl rand -hex 32   # for *_SECRET, *_TOKEN, *_KEY values
docker compose up -d postgres redis
docker compose up -d twenty-server twenty-worker n8n postiz control-api
docker compose up -d minio loki promtail grafana caddy
```

## Logging

All services log JSON to stdout. Promtail picks up via Docker socket → Loki. Grafana queries Loki. Multi-user via Grafana orgs/teams.

Cloudflare Workers push log lines to Loki via `LOKI_PUSH_URL` env on `lp-events` worker.

## Secrets

`infra/.env` is gitignored. Reference 1Password items in real deploy:

```
op://marketing_engine_prod/postgres/password
op://marketing_engine_prod/twenty/app_secret
...
```

## Vendor (forks)

Twenty + Postiz live in `~/projects/marketing-engine-vendor/`. Compose builds from those paths via `../../marketing-engine-vendor/<repo>` context. Keep upstream synced:

```bash
cd ~/projects/marketing-engine-vendor/twenty && git fetch upstream && git merge upstream/main
cd ~/projects/marketing-engine-vendor/postiz-app && git fetch upstream && git merge upstream/main
```
