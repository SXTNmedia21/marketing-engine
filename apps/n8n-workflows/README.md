---
title: n8n Workflows — Marketing Engine
status: in_progress
updated: 2026-05-06
created: 2026-05-06
module: orchestration
tags: [n8n, workflow, campaign, orchestration]
---

# n8n Workflows — Marketing Engine

Workflow export files for the `me.*` n8n workflow namespace (ADR-0005).

---

## Workflows

| File | Name | Trigger | Domain |
|---|---|---|---|
| `me.campaign.launch.json` | me.campaign.launch | Twenty webhook: Campaign.status → `pending_review` | campaign |

---

## me.campaign.launch

### What it does

End-to-end campaign launch pipeline:

1. Receives Twenty webhook when Campaign status changes to `pending_review`
2. Fetches full campaign record from Twenty GraphQL API
3. Runs brand voice check via Anthropic Haiku (score 0–100, pass threshold 70)
4. Generates 9 ad variants (3 per platform: meta, tiktok, google) via Anthropic Sonnet
5. Generates one LP config per variant via Anthropic Sonnet
6. Validates each LP config inline (mirrors `@me/lp-config` Zod schema)
7. POSTs each LP config to `control-api /api/lp`
8. Triggers KV sync per slug via `control-api /api/lp/kv-sync`
9. Schedules each ad in Postiz pointing to its dedicated LP URL
10. PATCHes Twenty Campaign to `approved` (all OK) or `failed` (any step fails)

### Node count

22 nodes total:
- 1 Webhook trigger
- 1 Error Trigger (global catch)
- 3 Set nodes (context extraction, record flattening, LP ID attachment)
- 3 IF/gate nodes (campaign_id present, brand score gate)
- 3 Code nodes (brand result parse, ad variant parse, LP validation, result aggregation = 4 Code nodes)
- 3 Anthropic HTTP calls (Haiku × 1, Sonnet × 2)
- 8 HTTP Request nodes (Twenty GET, control-api LP POST, KV sync, Postiz, Twenty PATCH × 4 error variants)

---

## How to import

1. In n8n UI: **Workflows → Import from file**
2. Select `me.campaign.launch.json`
3. After import, configure credentials (see below)
4. Set the workflow Error Workflow to itself (so the `Error Trigger` node is active)
5. Activate the workflow

---

## Required credentials

Create these named credentials in n8n **before** activating the workflow.

| Credential name | n8n type | What it is |
|---|---|---|
| `twenty_api` | HTTP Bearer Auth | Twenty API token — `TWENTY_API_TOKEN` from docker-compose env |
| `anthropic_api` | HTTP Custom Auth | Anthropic API key — Header: `x-api-key: <your-key>` |
| `control_plane_token` | HTTP Bearer Auth | Control API token — `CONTROL_PLANE_TOKEN` from docker-compose env |
| `postiz_api` | HTTP Bearer Auth | Postiz API JWT — from Postiz admin settings |

### anthropic_api custom auth setup

Anthropic does not use standard Bearer auth. Configure as **HTTP Custom Auth**:

- **Header name:** `x-api-key`
- **Header value:** `<your Anthropic API key>`

Do NOT store the key value in n8n directly — use `op://` references if your n8n instance has 1Password Connect configured, or set via n8n environment variable `N8N_EXTERNAL_SECRETS_*`.

---

## Expected webhook payload

Twenty sends this shape when Campaign status changes to `pending_review`:

```json
{
  "campaign_id": "<uuid>",
  "request_id": "<uuid or webhook-event-id>",
  "event": "CAMPAIGN.STATUS_CHANGED",
  "object_metadata": {
    "nameSingular": "campaign",
    "id": "<uuid>",
    "previousStatus": "draft",
    "newStatus": "pending_review"
  }
}
```

The workflow is tolerant: it also accepts `body.record.id` or `body.recordId` as fallback for `campaign_id`.

### Configure the Twenty webhook

In Twenty workspace settings → Webhooks:

- **URL:** `http://n8n:5678/webhook/me.campaign.launch` (internal docker network)
- **Events:** `CAMPAIGN.STATUS_CHANGED` (or `CAMPAIGN.UPDATED` filtered to status field)

---

## Environment variables (set in n8n container)

No additional n8n env vars are required beyond what is already in `infra/docker-compose.yml`.

Service hostnames resolve via Docker internal network:

| Variable | Value (docker internal) |
|---|---|
| Twenty GraphQL | `http://twenty-server:3000/api` |
| Control API | `http://control-api:8080` |
| Postiz API | `http://postiz:3000/api` |

---

## Cost estimate per run

| Step | Model | Est. tokens in | Est. tokens out | Cost (NOK) |
|---|---|---|---|---|
| Brand Voice Check | claude-haiku-4-5 | ~500 | ~256 | ~0.19 |
| Ad Variant Gen | claude-sonnet-4-5 | ~1 500 | ~1 800 | ~9.9 |
| LP Config Gen × 9 variants | claude-sonnet-4-5 | ~1 200 × 9 | ~800 × 9 | ~54 |
| **Total** | | | | **~64 NOK** |

Well within the 200 NOK per-run budget (ADR Operations §3). Worst case with retries: ~130 NOK.

---

## Error handling

All errors route to `HTTP — PATCH Twenty Campaign → failed` nodes which set:

- `Campaign.status = 'failed'`
- `Campaign.failureReason = <reason string>`

Specific error paths:

| Failure point | Error node |
|---|---|
| Missing `campaign_id` in webhook | "PATCH failed (no id)" |
| Brand score < 70 | "PATCH failed (brand)" |
| Any unhandled exception | Error Trigger → "PATCH failed (exception)" |

Errors are never silently swallowed. The campaign always ends in `approved` or `failed`.

---

## Idempotency

All POST requests carry an `Idempotency-Key` header built as:

```
<campaign_id>_<variant_tag>_<step-name>
```

Re-running the workflow for the same campaign + variant produces the same key, preventing duplicate LP records and Postiz posts.
