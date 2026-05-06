---
title: ADR-0006 — Voice via shared LiveKit, marketing_bdr persona
status: accepted
updated: 2026-05-06
created: 2026-05-06
module: voice
tags: [adr, voice, livekit, smartout, ai-agent]
---

# ADR-0006 — Voice via shared LiveKit, marketing_bdr persona

## Status

Accepted — 2026-05-06.

## Context

Marketing engine needs voice for high-intent leads (Hot/On-fire scoring per OPERATIONS section 5):

- Outbound: AI BDR calls Hot leads within 30 min of form submit
- Voicemail drop: pre-rendered message when contact does not answer
- Voice LP: high-engagement visitor sees "talk to us now" widget that opens LiveKit room
- Qualification: AI BDR pre-qualifies before human rep is engaged

Smartout already runs LiveKit infrastructure with `mr_botsson` agent persona for daily-operation use cases. Building a second LiveKit deployment for marketing-engine duplicates infra cost (servers, room signaling, TURN, recording) for the same engine.

## Decision

Share Smartout's LiveKit server. Add a new agent persona `marketing_bdr` alongside `mr_botsson`.

### Architecture

```
LiveKit server (Smartout, existing)
├── mr_botsson           daily-operation persona, Smartout staff context
└── marketing_bdr        NEW, marketing-engine context
```

### marketing_bdr — properties

| Field | Value |
|---|---|
| System prompt | Sales-focused: qualify need, book meeting, collect missing info. No daily-operation language. |
| Context loader | Reads `marketing_engine.leads` + last 50 `lp_events` for visitor + Twenty Contact if linked |
| Tools | `book_meeting(twenty_calendar_id)`, `update_lead_status(status, reason)`, `send_followup_email(template_id, params)`, `escalate_to_human(rep_id)` |
| Voice (TTS) | Different from Botsson — TBD, likely warmer/sales-tone (ElevenLabs custom or OpenAI shimmer) |
| Disable in non-marketing rooms | Persona only attaches to rooms with `room_name: marketing-*` |

### Code location

`marketing_bdr` persona lives in Smartout monorepo since LiveKit lives there:

```
~/dev/smartout.ai/packages/agent-personas/marketing-bdr/
├── system-prompt.ts
├── context-loader.ts
├── tools/
│   ├── book-meeting.ts
│   ├── update-lead-status.ts
│   ├── send-followup-email.ts
│   └── escalate-to-human.ts
└── index.ts
```

Marketing-engine repo provides the **dispatcher** in `packages/voice/`:

- Helper `dispatchMarketingBdr(visitorId, phoneNumber, opts)` calls Smartout LiveKit API
- Webhook handler in control-api `/api/voice/event` receives session events from LiveKit (call started, ended, transcript, outcome)
- Session events written to `voice_sessions` table

### Cross-repo coordination

| Side | What |
|---|---|
| Smartout monorepo | Hosts persona code + LiveKit server config + TTS voices |
| Marketing-engine | Hosts dispatcher, context source (lead data), session tracking, Twenty integration |

When marketing_bdr persona changes (new prompt, new tool), it ships in Smartout campaign branch. Marketing-engine consumes the deployed LiveKit endpoint — no version coupling at runtime.

### Auth / isolation

- Marketing-engine calls LiveKit with separate API key (own LiveKit project key) so call costs and access logs separate
- Smartout LiveKit server multitenants via project keys
- Recording goes to marketing-engine's MinIO bucket, not Smartout's

## Consequences

- Voice infra shared = lower cost, faster ship.
- Marketing-engine team must coordinate persona updates with Smartout team. Acceptable — same operator (Pontus) for now.
- Outage on Smartout LiveKit affects marketing-engine voice. Mitigation: voice flow is non-blocking — n8n queues calls and retries on outage.
- TTS voice differentiation important so users do not mistake marketing BDR for Botsson and vice versa.

## Open

- Recording retention policy for marketing voice calls (likely 90 days for sales review)
- Consent capture for outbound calls (TCPA/GDPR — recording consent prompt at start)
- Per-lead frequency cap to avoid harassment (max 1 call per 24h, 3 per week)
