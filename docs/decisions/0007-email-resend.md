---
title: ADR-0007 — Email provider: Resend
status: accepted
updated: 2026-05-06
created: 2026-05-06
module: email
tags: [adr, email, resend, react-email, deliverability]
---

# ADR-0007 — Email: Resend with React Email + svix-signed webhooks

## Status

Accepted — 2026-05-06.

## Context

OPERATIONS section 7 specifies a sender domain (`mail.dittdomene.no`), DMARC progression, suppression rules, warmup plan, and KPIs. We need a provider that:

- Has clean webhook events for sent / delivered / opened / clicked / bounced / complained
- Supports React-based templating so AI-generated content is composable
- Has good deliverability for transactional + marketing combined (separate streams)
- Handles GDPR/EU residency reasonably
- Is cheap below 5k/day (target warmup volume)

## Decision

Use **Resend** as primary email provider.

### Why

- Native React Email rendering (`@react-email/components`) — AI-generated content uses same React JSX as LP-templates, no MJML detour
- Webhook events match what we need 1:1, signed via **svix** (industry standard)
- Free tier 100/day, paid starts $20/month for 50k → fits warmup ramp from OPERATIONS exactly
- EU residency available (Resend has Frankfurt region)
- DX is closest to Anthropic SDK style — fits our existing development habits

### Setup

| Step | Action |
|---|---|
| Domain | `mail.example.com` registered separately from LP domain |
| DNS | SPF `v=spf1 include:_spf.resend.com -all`, DKIM (Resend issues 3 selectors), DMARC `p=quarantine` for first 30 days, then `p=reject` |
| Streams | Two: `marketing` (campaigns, nurtures) and `transactional` (auth, lead confirmations). Separate IP pool for marketing once paid tier kicks in. |
| Suppression list | Resend native suppression + our own `email_suppression` table (synced bidirectionally via webhook + REST) |
| Templates | React Email components in `packages/email/templates/`, render → HTML at send time, snapshot tests |

### Webhook flow

```
Resend → POST https://api.<env>/webhooks/email
  → svix verifies signature (REQUIRED — reject unsigned)
  → INSERT email_events (id, message_id, type, ts, contact_id, meta)
  → IF type=opened/clicked → engagement bump on Twenty Contact (via control-api)
  → IF type=bounced(hard) → INSERT email_suppression (reason='hard_bounce')
  → IF type=complained → INSERT email_suppression (reason='spam_complaint')
  → Loki log entry per event
```

### Outbound flow

```
n8n triggers email send →
  control-api /api/email/send (auth bearer)
    → check email_suppression → reject if listed
    → check consent_records → enforce per-jurisdiction
    → render React Email template → HTML
    → Resend API send with idempotency_key = our message_id
    → INSERT email_events (type='queued', ...)
```

### React Email + AI

AI prompt fills props for a fixed React component, never raw HTML. Component bounds the output:

```ts
<NurtureEmail
  recipient_first_name="..."
  campaign_name="..."
  cta_url="..."
  body_paragraphs={["...", "..."]}  // AI fills, max 3
  social_proof={...}
/>
```

This means:
- AI cannot break layout or sneak in tracking pixels
- Same component drives staging preview + production send
- Brand-voice enforcement runs on the JSON props, not on raw markup

## Consequences

- Locked to Resend's webhook payload shape. svix-sdk abstracts most of it.
- React Email build pipeline adds compile step — done at send time in control-api, not at deploy.
- If Resend drops EU region or has incident, switching to Postmark or SES is non-trivial (template format compatible, webhook + suppression code rewrite ~2 days).
- Suppression lives in two places (Resend + our DB). Sync drift is the main risk — webhook is the truth.

## Open

- IP warmup plan triggered manually or scheduled in n8n? Lean toward n8n cron with operator confirm gate.
- Reply handling — Resend forwards replies via `inbound`. Where does response land? Twenty Inbox object, or simply Slack thread for v1?
