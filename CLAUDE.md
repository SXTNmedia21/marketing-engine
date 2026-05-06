# Marketing Engine — Project Instructions

Project-level guidance for AI agents working in this repo. Inherits from `~/.claude/CLAUDE.md`. Overrides nothing unless explicitly stated.

## What this is

Self-served marketing engine, end-to-end from campaign idea to identified customer. Two planes:

- **Control plane** — Hetzner + Docker. Twenty CRM, n8n, Postiz, Postgres, control-api, Loki, Grafana.
- **Render plane** — Cloudflare Workers + KV. Three Workers: `lp-render`, `lp-events`, `lp-form`.

See `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`.

## Repo layout

```
apps/
  lp-render/      Cloudflare Worker — serves LPs from KV
  lp-events/      Cloudflare Worker — ingests tracking events
  lp-form/        Cloudflare Worker — proxies form submits
  control-api/    Fastify (Hetzner) — receives events/leads, manages LP configs
packages/
  lp-config/      Zod schema + TS types
  templates/      Template A (lead capture), B (long form)
  tracking/       Pixel builders — Meta CAPI, GA4, TikTok
  shared/         Logger, request_id, hash utils
infra/            docker-compose, Caddy, Postgres init, Loki/Grafana provisioning
docs/             PRD, ARCHITECTURE, OPERATIONS, decisions/, journeys/
```

## Vendor (sibling forks)

`~/projects/marketing-engine-vendor/twenty/` and `postiz-app/` are forked, sibling-cloned, with `upstream` remote (push DISABLED). All other services run upstream image — never fork unless we need to patch source. See ADR-0002.

## Branching

- `development` is integration branch. Direct push allowed.
- Feature work: `feat/<name>` from `development`. Merge back via PR or fast-forward.
- `main` and `preview` are production-ladder. Never push directly.
- Conventional commits, atomic.

## Decisions

ADRs in `docs/decisions/`. Index at `0000-decision-log.md`. Always check before architectural changes:

- ADR-0001 — Two-plane architecture
- ADR-0002 — Vendor fork strategy
- ADR-0003 — Self-hosted Loki + Grafana for unified logging
- ADR-0004 — Multi-account at team level (not multi-tenant)

## n8n Integration (MCP)

### Scope

This project's MCP integration with n8n is scoped to workflows tagged `project:marketing-engine`. Do not touch workflows from other projects on the same n8n instance.

### Allowed operations

- List workflows (filtered by tag)
- Read workflow details and runs
- Validate node configurations
- Search node templates and docs

### Restricted operations

- Creating workflows requires explicit user approval — propose, then ask
- Modifying production-tagged workflows requires explicit user approval
- Deleting workflows is NEVER allowed without typed confirmation

### Tag convention

Every workflow we create gets tag `project:marketing-engine` plus stage tag (`stage:dev` / `stage:staging` / `stage:prod`). Untagged workflows are out of scope.

### Credentials

- API URL + key live in `.env.n8n.local` (gitignored)
- Template at `.env.n8n.template` (committed)
- After first n8n boot: copy template → `.env.n8n.local`, generate key in n8n UI (Settings → API), paste

### MCP server

Defined in `.mcp.json`. Runs `mcp/n8n` Docker image with host network so it can reach `localhost:5678`.

## Conventions

- TypeScript everywhere. No JS files. No `.docx`, only Markdown.
- Default response language: same as the user writes in (Norwegian/English).
- Strict TS (`tsconfig.base.json`). No `any` without comment justifying it.
- All HTTP routes log `request_id` end-to-end. Cloudflare Worker → control-api → Twenty.
- Secrets never in code. `.env` files are gitignored. Reference `op://` URIs in deploy docs.
- Postgres queries via `postgres` (porsager) — parameterised, no string concat.

## Local dev

```bash
nvm use && pnpm install
cd infra && cp .env.example .env && docker compose up -d
cd ../apps/lp-render && pnpm wrangler dev --local
```

See `infra/README.md` for full boot sequence.

## What NOT to do

- Don't modify `vendor/twenty/` or `vendor/postiz-app/` from this repo. Those are separate working trees with their own remotes.
- Don't commit secrets. Token leaks → rotate immediately, mention in commit if unavoidable.
- Don't add a JS file. Convert to TS.
- Don't push to `main` or `preview` — only Pontus does production releases.
