---
title: ADR-0001 — Two-plane architecture
status: accepted
updated: 2026-05-06
created: 2026-05-06
module: architecture
tags: [adr, architecture, cloudflare, hetzner]
---

# ADR-0001 — Two-plane architecture

## Status

Accepted — 2026-05-06.

## Context

Public LP traffic is unbounded (50k/day target, spike to 100k+ rps). Admin/control traffic is low (thousands/day). Mixing them on one box means scaling cost is dominated by traffic we don't profit from per-request.

## Decision

Split into two planes:

- **Control plane** on Hetzner CCX (Docker Compose). Owns data, produces config, receives leads. Sees only admin + lead traffic.
- **Render plane** on Cloudflare (Workers + KV + Pages). Serves all public LP traffic at edge. Stateless, scales to 100k+ rps with zero ops.

LPs stored as JSON config in Postgres (truth) + Cloudflare KV (serving copy). Workers read KV, render template, fire events back to control plane.

## Consequences

- Public traffic never hits Hetzner — uptime decoupled.
- Hetzner outage = config-publish down, but LPs keep serving.
- Cloudflare outage = LPs down (mitigated by stale-while-revalidate + DNS failover to Hetzner origin).
- Two deploy paths: `wrangler` for Workers, `docker compose` for control plane.
- Bundle size budget per Worker is hard limit on template complexity (1MB).
