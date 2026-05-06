---
title: ADR-0002 — Vendor fork strategy
status: accepted
updated: 2026-05-06
created: 2026-05-06
module: infra
tags: [adr, vendor, forks, twenty, postiz, n8n]
---

# ADR-0002 — Vendor fork strategy

## Status

Accepted — 2026-05-06.

## Context

We use four self-hosted services with different customisation needs:

- **Twenty CRM** — extending object schema (Campaign, LP, Pixel-Account), patching workflows
- **Postiz** — adding integrations, possibly patching providers
- **n8n** — config-driven via UI; rarely patched
- **Caddy / Postgres / Redis / MinIO / Loki / Grafana** — config-only, no source changes

## Decision

Fork only what we patch. Pull image for the rest.

| Service | Strategy | Location |
|---|---|---|
| Twenty | **Fork.** Sibling clone. | `~/projects/marketing-engine-vendor/twenty/` |
| Postiz | **Fork.** Sibling clone. | `~/projects/marketing-engine-vendor/postiz-app/` |
| n8n | **Image upstream.** `docker.n8n.io/n8nio/n8n:latest` | — |
| Postgres, Caddy, Redis, MinIO, Loki, Grafana, Promtail | **Image upstream.** | — |

### Sibling clone, not submodule

Forks live outside `marketing-engine` repo, not as git submodules. Reasons:

- Twenty is a 21k-file monorepo (Nx + Yarn). Mixing with our pnpm/Turbo causes lockfile conflicts.
- Postiz is a separate pnpm monorepo with its own version cadence.
- We want forks updatable independently of our schedule.

Compose uses relative `build.context: ../../marketing-engine-vendor/<repo>` to build images locally.

### Upstream tracking

Each fork has `upstream` remote pointing at the original repo, with push to upstream **disabled** (set-url `--push DISABLED`) to prevent accidental contributions of internal patches.

Sync routine:

```bash
cd ~/projects/marketing-engine-vendor/twenty
git fetch upstream
git merge upstream/main      # or rebase, depending on patch volume
```

## Consequences

- Smaller marketing-engine repo (only our code + infra config + docs).
- Two extra repos to keep updated. Acceptable — we already do this for Smartout.
- Building images locally takes longer than pulling — but only on first build / after upstream merge.
- If we later decide to patch n8n, we add a fork without restructuring.
