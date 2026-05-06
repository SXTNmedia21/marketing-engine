---
title: n8n Workflows — Changelog
status: in_progress
updated: 2026-05-06
created: 2026-05-06
module: orchestration
tags: [n8n, changelog]
---

# Changelog — apps/n8n-workflows

All notable changes to n8n workflow exports.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [0.1.1] — 2026-05-06

### Fixed

- `me.campaign.launch.json` — G2 integration audit fixes (3 issues)
  - **Postiz port mismatch**: `http://postiz:3000/api/posts` → `http://postiz:5000/api/posts` (container listens on 5000 per Caddyfile/docker-compose)
  - **Twenty GET endpoint**: node-04 changed from POST `/api` (GraphQL) to GET `/rest/campaigns/:id` (REST); node-05 flatten updated from `$json.data.campaign.*` to `$json.*` to match REST response shape
  - **Twenty PATCH endpoints**: all 5 nodes (node-18 approved, node-19/20/22 failed error paths) changed from POST `/api` (GraphQL mutation) to PATCH `/rest/campaigns/:id` with plain JSON body `{ status, failureReason/reviewNotes }`; node-22 `headerParameters` also fixed from bare array to canonical `{ parameters: [...] }` object

---

## [0.1.0] — 2026-05-06

### Added

- `me.campaign.launch.json` — initial campaign launch workflow (22 nodes)
  - Webhook trigger on Twenty Campaign `pending_review` status change
  - Brand voice gate via Anthropic Haiku (score ≥ 70 to proceed)
  - 9 ad variants generated across meta/tiktok/google via Anthropic Sonnet
  - 1 LP config per variant, validated inline against `@me/lp-config` Zod schema
  - LP config pushed to `control-api /api/lp` → Cloudflare KV sync
  - Ad scheduled in Postiz per variant → LP URL pairing
  - Twenty Campaign patched to `approved` on success, `failed` with `failureReason` on any error
  - Global Error Trigger catches unhandled exceptions, never silently swallows
  - Idempotency keys on all POST calls: `<campaign_id>_<variant_tag>_<step>`
  - All credentials referenced by name: `twenty_api`, `anthropic_api`, `control_plane_token`, `postiz_api`
  - Estimated cost per run: ~64 NOK (well within 200 NOK budget)

- `README.md` — import instructions, credential setup, webhook payload shape, cost breakdown
- `CHANGELOG.md` — this file
