---
title: ADR-0003 — Unified logging via self-hosted Loki + Grafana
status: accepted
updated: 2026-05-06
created: 2026-05-06
module: observability
tags: [adr, logging, loki, grafana, observability]
---

# ADR-0003 — Unified logging via self-hosted Loki + Grafana

## Status

Accepted — 2026-05-06.

## Context

Multiple services across two planes (Workers, Twenty, n8n, Postiz, control-api, Postgres, Caddy) emit logs in different formats. We need:

- One place to grep across services for a given `request_id`
- Multi-user access (Pontus + future operators)
- Cost-controlled (target < $50/mo at v1 scale)

Alternatives considered:

- **Grafana Cloud Loki (free tier)** — no ops, but multi-user + 30d retention pushes us into paid tier fast at our log volume.
- **Better Stack / Axiom** — best UX, but extra vendor + cost growth.
- **Self-host Loki + Grafana on Hetzner** — already in arch doc, free, multi-user via Grafana orgs.

## Decision

Self-host Loki + Grafana + Promtail on the Hetzner control plane.

- All services emit structured NDJSON to stdout with required fields: `ts`, `level`, `service`, `request_id`, `event`.
- Promtail scrapes Docker socket → ships to Loki.
- Cloudflare Workers push events to Loki via HTTP push from `lp-events` Worker (forward path).
- Grafana provisioned with Loki datasource. Multi-user via Grafana orgs/teams + email/password (SSO planned).
- Retention: 30d hot in Loki. Cold archive to Backblaze B2 via parquet export (deferred to ADR-0XXX).

## Consequences

- Logs survive Cloudflare outage (Hetzner-side).
- Logs DO NOT survive Hetzner outage. Critical path: log shipping is best-effort, not blocking on app code.
- Operators added via Grafana invite — no code changes needed.
- Cost predictable: ~5GB/day target, alarm at 4GB/day.
