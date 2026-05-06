---
title: ADR-0004 — Multi-account at team level (not multi-tenant)
status: accepted
updated: 2026-05-06
created: 2026-05-06
module: identity
tags: [adr, auth, multi-user, sso]
---

# ADR-0004 — Multi-account at team level

## Status

Accepted — 2026-05-06.

## Context

Pontus will not be sole operator. Multiple operators (sales, marketing, future hires) need access. Two interpretations:

- **a. Team:** several operators share one workspace, each with own login + role.
- **b. Multi-tenant:** the engine serves multiple customer companies, each isolated.

`b` requires Postgres RLS, namespaced KV (`lp:<tenant>:<slug>`), workspace-isolated Twenty/n8n/Postiz, separate billing. Big architectural delta.

## Decision

v1 = **a (team)**. Multi-tenant deferred until concrete second customer.

### Implementation per service

| Service | Mechanism |
|---|---|
| Twenty CRM | Built-in workspace + roles. One workspace, multiple users. |
| n8n | n8n team feature (queue mode supports multiple users on same instance). |
| Postiz | Postiz organization. Multiple users per org. |
| Grafana | Grafana orgs + teams. Provisioned via env. |
| control-api | Bearer token (machine-to-machine from Workers). User-facing endpoints added later via Twenty SSO. |
| MinIO | Single bucket, IAM policies if user-facing later. |

SSO unified via Google Workspace (planned, not v1). v1: per-service local accounts.

## Consequences

- Faster v1. No RLS plumbing.
- If multi-tenant becomes real, refactor scope is well-known: KV namespacing, RLS, workspace-aware control-api, separate Twenty workspaces.
- Onboarding new operator = add user in each of {Twenty, n8n, Postiz, Grafana}. Friction acceptable at small team.
- Future "ADR-0XXX — Multi-tenant" will supersede this if/when needed.
