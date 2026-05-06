# Infra — Control plane

Docker Compose stack for Hetzner. Render plane (Cloudflare Workers) deploys separately via wrangler.

## Services

| Service | Image | Port | Domain |
|---|---|---|---|
| `caddy` | `caddy:2.8-alpine` | 80/443 | — |
| `postgres` | `postgres:16-alpine` | 5432 (internal) | — |
| `redis` | `redis:7-alpine` | 6379 (internal) | — |
| `twenty-server` | `twentycrm/twenty:latest` | 3000 | `crm.example.com` |
| `twenty-worker` | `twentycrm/twenty:latest` | — | — |
| `n8n` | `docker.n8n.io/n8nio/n8n:latest` | 5678 | `n8n.example.com` |
| `postiz` | `ghcr.io/gitroomhq/postiz-app:latest` | 5000 | `postiz.example.com` |
| `postiz-postgres` | `postgres:17-alpine` | (internal) | — |
| `postiz-redis` | `redis:7-alpine` | (internal) | — |
| `temporal` | `temporalio/auto-setup:1.28.1` | 7233 (internal) | — |
| `temporal-postgresql` | `postgres:16` | (internal) | — |
| `temporal-elasticsearch` | `elasticsearch:7.17.27` | (internal) | — |
| `control-api` | build from `apps/control-api` | 8080 | `api.example.com` |
| `minio` | `minio/minio:latest` | 9000/9001 | `minio.example.com` |
| `loki` | `grafana/loki:3.3.2` | 3100 | — |
| `promtail` | `grafana/promtail:3.3.2` | — | — |
| `grafana` | `grafana/grafana:11.4.0` | 3000 | `grafana.example.com` |

**Total:** 17 containers. RAM budget ~3 GB (Elasticsearch ~512MB, Postiz/Twenty ~500MB each).

## Why image-only for Twenty + Postiz?

We forked these to be able to patch later. Until we patch anything, building from source costs 10–15 min per `docker compose build` and slows the dev loop. We use published images for both. When we need to patch, we switch the `image:` line to `build: { context: ../../marketing-engine-vendor/<repo> }`. Forks remain useful for reading source and testing patches locally.

## Networks

- `edge` — Caddy public-facing
- `internal` — Twenty, n8n, control-api, Postgres, Redis, MinIO, observability
- `postiz` — Postiz + own Postgres + own Redis (isolated)
- `temporal` — Temporal + own Postgres + Elasticsearch (isolated, Postiz dep)

Caddy bridges `edge ↔ internal/postiz` so it can proxy both.

## Setup (local)

```bash
./bootstrap-local.sh
```

Generates secrets, swaps `example.com` → `.local`, boots in dependency order.

`/etc/hosts` needs:
```
127.0.0.1 crm.local n8n.local postiz.local api.local grafana.local minio.local
```

## Logging

NDJSON to stdout. Promtail tails Docker socket → Loki. Grafana queries Loki. Cloudflare Workers push events to Loki via `LOKI_PUSH_URL` on `lp-events`.

## Vendor (forks)

`~/projects/marketing-engine-vendor/twenty/` and `postiz-app/` cloned with `upstream` remote (push DISABLED). Sync:

```bash
cd ~/projects/marketing-engine-vendor/twenty && git fetch upstream && git merge upstream/main
cd ~/projects/marketing-engine-vendor/postiz-app && git fetch upstream && git merge upstream/main
```

## Reset (nukes data)

```bash
docker compose down -v
rm .env
./bootstrap-local.sh
```
