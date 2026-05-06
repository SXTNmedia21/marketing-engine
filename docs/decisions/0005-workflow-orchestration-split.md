---
title: ADR-0005 — Workflow orchestration: n8n + Twenty AI Agent
status: accepted
updated: 2026-05-06
created: 2026-05-06
module: orchestration
tags: [adr, n8n, twenty, ai-agent, workflow]
---

# ADR-0005 — Workflow orchestration split

## Status

Accepted — 2026-05-06.

## Context

Marketing engine has two distinct kinds of workflows:

- **External orchestration** — multi-system pipelines: trigger → AI-content-gen → Cloudflare KV push → Postiz publish → Resend send → tracking webhook. Long-running, stateful, retry-aware, cross-vendor.
- **CRM-internal automation** — lead status changes, score recalculation, notifications, field updates. Bounded to Twenty data, fast, reactive, often AI-augmented.

Putting both in one tool means either:

- Use n8n for everything → Twenty triggers leak through webhooks, every CRM rule becomes a fragile webhook chain
- Use Twenty AI Agent for everything → lacks queue, retry, multi-step external integrations break easily

## Decision

Split by domain.

| Domain | Tool | Why |
|---|---|---|
| External orchestration | **n8n** | Queue mode, retry, 400+ integration nodes, webhook-first |
| CRM-internal automation | **Twenty AI Agent** | Native CRM context, no webhook plumbing, cheaper |
| Bridges (Twenty → external) | **n8n** triggered via Twenty webhook | Cross-tool boundary lives in n8n |

### Concrete examples

| Workflow | Owner |
|---|---|
| New campaign created → AI produces ad variants + LP-config → push to KV → Postiz schedule → mark `live` | **n8n** |
| Form submit → identify visitor → upsert Twenty Contact → assign owner → notify Slack | **n8n** (Worker → control-api → Twenty) |
| Lead score > 80 → status `Hot` → assign to senior rep → trigger LiveKit voice agent | **Twenty AI Agent** triggers `n8n://voice-agent-dispatch` webhook |
| Email opened twice + 50% scroll → score +15 | **Twenty AI Agent** (CRM-internal) |
| Daily AI cost summary → Slack digest | **n8n** scheduled |
| Twenty record edited → log to activity-log | **Twenty AI Agent** webhook to second-brain |

### Tag conventions

n8n workflows: `project:marketing-engine` + `domain:<area>` (campaign, lead, email, voice, admin).
Twenty AI Agent automations: `project:marketing-engine` per workspace metadata.

### Naming

- n8n: `me.<domain>.<verb>` — `me.campaign.launch`, `me.lead.qualify`, `me.email.handle-open`
- Twenty AI Agent: `<object>.<event>.<action>` — `lead.score-changed.escalate`

### Boundary discipline

Twenty AI Agent NEVER directly calls Cloudflare, Resend, Postiz, OpenAI, or any external API. It only:
- Reads/writes Twenty objects
- Triggers n8n via webhook (`POST n8n.local/webhook/me.<flow>`)

This keeps n8n as the single source of truth for external side-effects. CRM stays clean.

## Consequences

- Two tools to learn for operators. Acceptable — Twenty AI Agent is UI-driven and similar to n8n flow editor.
- Inter-tool latency: ~200ms (Twenty → n8n webhook). Negligible for our flows.
- Both tools log via Loki — unified observability across orchestration layer.
- If we later want one-tool simplicity, n8n absorbs Twenty AI Agent's role (Twenty AI Agent is younger, less stable). The reverse is harder.
- AI Agent in Twenty is in active development; we depend on its API stability. Pin Twenty image tag in compose, upgrade deliberately.
