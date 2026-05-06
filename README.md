# Marketing Engine

AI-driven marketing engine — campaign idea to identified customer, end-to-end. Self-hosted control plane on Hetzner, edge-rendered LPs on Cloudflare.

## Architecture

Two planes:

- **Control plane** — Hetzner + Docker. Twenty CRM, n8n, Postiz, Postgres, control-api, Loki, Grafana.
- **Render plane** — Cloudflare Workers + KV + Pages. Three Workers: `lp-render`, `lp-events`, `lp-form`.

See `docs/ARCHITECTURE.md` for full system, `docs/PRD.md` for product, `docs/OPERATIONS.md` for runbooks.

## Layout

```
apps/
  lp-render/      Cloudflare Worker — serves LPs from KV
  lp-events/      Cloudflare Worker — ingests tracking events
  lp-form/        Cloudflare Worker — proxies form submits
  control-api/    Fastify (Hetzner) — receives events/leads, manages LP configs
packages/
  lp-config/      Zod schema + TS types for LP config
  templates/      Template A (lead capture), B (long form) — server-rendered HTML
  tracking/       Pixel builders — Meta CAPI, GA4, TikTok
  shared/         Logger, request_id, hash utils
infra/
  docker-compose.yml   Full control plane
  caddy/               Reverse proxy + TLS
  postgres/init/       Schema bootstrap
  loki/, promtail/, grafana/   Logging stack
docs/                  PRD, ARCHITECTURE, OPERATIONS, decisions/, journeys/
```

## Vendor (sibling forks)

Twenty + Postiz are forked, cloned as siblings outside this repo:

```
~/projects/marketing-engine/            (this repo)
~/projects/marketing-engine-vendor/twenty/        (fork — patched)
~/projects/marketing-engine-vendor/postiz-app/    (fork — patched)
```

Compose references them via `../../marketing-engine-vendor/<repo>`.

All other services run upstream images (n8n, Postgres, Caddy, MinIO, Loki, Grafana, Promtail).

## Setup

```bash
nvm use
corepack enable
pnpm install
pnpm typecheck
```

For control plane:

```bash
cd infra
cp .env.example .env
# fill in secrets via openssl rand -hex 32
docker compose up -d
```

For Workers:

```bash
cd apps/lp-render
# set account_id + KV namespace ids in wrangler.toml
pnpm wrangler kv namespace create LP_CONFIGS
pnpm dev
```

## Conventions

- TypeScript everywhere. No JS files.
- Conventional commits, atomic.
- `development` is integration branch. Feature work on `feat/<name>`.
- Decisions written as ADRs in `docs/decisions/`. Index in `0000-decision-log.md`.

## Status

`v0.1` — scaffold. Workers + control-api skeleton ready. Twenty/Postiz forks cloned.
Next: ADR for vendor strategy, n8n workflow templates, KV deploy script.
