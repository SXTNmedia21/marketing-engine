# Marketing Engine — Arkitektur

**Versjon:** 0.1 · **Dato:** 6. mai 2026 · **Eier:** Pontus

---

## 1. Systemoversikt

To plan, klart adskilte:

- **Control plane** — Hetzner-boks (CCX13/CCX23) med Docker. Eier data, produserer config, mottar leads.
- **Render plane** — Cloudflare (Pages + Workers + KV). Server LP-er på edge til ubegrenset trafikk.

All offentlig trafikk treffer Cloudflare. Hetzner ser kun config-skriv, lead-skriv og admin.

## 2. Komponenter

### Control plane
| Tjeneste | Rolle | Port |
|---|---|---|
| Twenty CRM | Kampanjer, kontakter, attribution | 3001 |
| n8n | Orkestrering, AI-kall, push til KV | 5678 |
| Postiz | Sosial publisering | 3002 |
| Postgres 16 | `lp_pages`, `lp_events`, `leads`, Twenty-data | 5432 |
| Caddy | Reverse proxy + TLS | 80/443 |
| MinIO | Kreativer, eksporter | 9000 |
| Loki + Grafana | Logging og dashboards | 3000/3100 |

### Render plane
| Tjeneste | Rolle |
|---|---|
| Cloudflare Pages | Statisk asset-hosting + worker-binding |
| Worker `lp-render` | `/lp/<slug>` — leser KV, velger template, rendrer HTML |
| Worker `lp-events` | `/events` — tar imot tracking-events, batcher til control plane |
| Worker `lp-form` | `/submit` — proxy form-submit til control plane |
| KV `LP_CONFIGS` | `slug → config JSON` |
| Cache | HTML cachet 1t, invalideres ved KV-push |

## 3. Datamodell

### `lp_pages` (Postgres)
```sql
id uuid PK, slug text UNIQUE, template text, version int,
config jsonb, status text (draft/active/paused/deleted),
campaign_id uuid FK, ad_id text,
created_at, activated_at, deactivated_at, expires_at
```

### `lp_events` (Postgres, partisjonert per dag)
```sql
id bigint PK, ts timestamptz, slug text, visitor_id text,
session_id text, event_type text, payload jsonb,
ip_truncated inet, country text, ua_hash text
```

### `leads` (Postgres) — speilet til Twenty `Contact`
```sql
id uuid PK, email text, visitor_id text, contact_id uuid,
attribution_path jsonb, first_touch jsonb, last_touch jsonb,
created_at, identified_at
```

### KV `LP_CONFIGS`
Nøkkel: `lp:<slug>`. Verdi: full config-JSON. TTL: ingen — fjernes ved deaktivering.

## 4. Forespørsel-livssyklus

1. Bruker → `lp.dittdomene.no/<slug>`
2. Cloudflare cache-lookup → hit returnerer i ~10ms globalt
3. Cache miss → Worker leser `LP_CONFIGS:<slug>` fra KV (~5ms)
4. Worker velger template (kompilert inn i bundle), rendrer HTML
5. HTML returneres med `Cache-Control: s-maxage=3600`
6. Inline tracking-script sender events til `/events`
7. `lp-events` Worker batcher (50 events / 2s) → POST til control plane `/api/events`
8. Form-submit → `lp-form` Worker → POST til control plane `/api/leads` → opprettes som Twenty Contact

## 5. Limits og kapasitet

### Hard tekniske grenser
| Komponent | Limit | Effekt ved brudd |
|---|---|---|
| Worker CPU | 50ms/request | Auto-fail, Cloudflare retry |
| Worker memory | 128 MB | OOM, request feiler |
| KV read | 1000/s per namespace | Throttle → fallback til control plane origin |
| KV value | 25 MB max | Vi holder configs < 50 KB |
| Postgres pool | 20 connections | Wait queue, 5s timeout |
| n8n samtidige workflows | 50 | Køes opp |

### Rate limits (per IP, av Cloudflare WAF)
| Endepunkt | Limit | Action |
|---|---|---|
| `/lp/<slug>` GET | 60/min | Challenge |
| `/events` POST | 120/min | 429 |
| `/submit` POST | 5/min | 429 + Turnstile |
| `/api/lp` (intern, n8n) | 100/min | 429 |

### Forretningsgrenser
- Max aktive LPer samtidig: 500 (alarm ved 400)
- Max config-versjoner per slug: 20 (eldre auto-arkivert)
- Max LP-events per visitor per session: 200 (deretter samples)
- Max form-felt per template: 8

## 6. Telemetri — alt vi vet om besøkende

Hvert pageview oppretter eller oppdaterer en visitor-rad og logger events. Følgende felter samles:

### Identitet og sesjon
- `visitor_id` — første-parts cookie, 365 dager TTL, signert
- `session_id` — sliding 30-min-vindu
- `returning_visitor` (bool)
- `first_seen_at`, `last_seen_at`
- `total_sessions`, `total_pageviews`

### Geo og nettverk (Cloudflare-headere `cf-ipcountry` osv.)
- `country`, `region`, `city`, `postal_code`, `timezone`
- `latitude`, `longitude` (by-presisjon)
- `ip_truncated` — siste oktett nullstilt (GDPR)
- `isp`, `asn`, `connection_type`
- `colo` — hvilken Cloudflare-PoP traff

### Enhet og browser (UA + Client Hints)
- `device_type` (mobile/tablet/desktop)
- `device_vendor`, `device_model` (når Client Hints tilgjengelig)
- `os_name`, `os_version`
- `browser_name`, `browser_version`, `browser_engine`
- `viewport_w`, `viewport_h`
- `screen_w`, `screen_h`, `pixel_ratio`
- `language`, `languages[]`
- `prefers_dark`, `prefers_reduced_motion`, `prefers_contrast`
- `cookies_enabled`, `do_not_track`
- `effective_connection` (3g/4g/wifi)

### Trafikkilde
- `referer`, `referer_domain`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- `click_id` — `fbclid`, `gclid`, `ttclid`, `msclkid`, `li_fat_id`
- `landing_slug`, `ad_id`, `campaign_id` (joinet via config-tracking)
- `entry_url`, `exit_url`

### Atferd på siden
- `pageview` (ts, slug, viewport)
- `scroll_depth` — milepæler 25/50/75/100%
- `time_on_page` — heartbeat hvert 15s
- `engagement_seconds` — kun når `document.hasFocus()`
- `click_events` — alle elementer med `data-track`
- `cta_click` (hvilken knapp, posisjon)
- `form_field_focus`, `form_field_blur` (felt, om utfylt)
- `form_validation_error` (felt + feilmelding)
- `form_submit_attempt`, `form_submit_success`, `form_submit_failed`
- `video_play`, `video_25/50/75/complete`, `video_pause`
- `exit_intent` — cursor mot toppen av viewport
- `rage_click` — 3+ klikk samme sted på < 2s
- `dead_click` — klikk på ikke-interaktivt element
- `copy_event`, `paste_event`
- `tab_visibility_change`, `tab_hidden_seconds`

### Risiko og kvalitet
- `cf_bot_score` (0–99, lav = bot-sannsynlig)
- `is_bot` (bool)
- `turnstile_passed` (når utløst)
- `js_errors[]` — uventede feil på siden

### Aggregater (beregnet i Worker, lagret per session)
- `engagement_score` (0–100, vektet kombinasjon av tid, scroll, interaksjoner)
- `intent_score` (heuristikk: form-fokus + dyp scroll + retur = høy)
- `quality_flag` — bot/lav-kvalitet/ekte/høy-intent

## 7. Logging

- **Format:** strukturert JSON (NDJSON)
- **Påkrevde felter:** `ts`, `level`, `service`, `request_id`, `event`, `payload`
- **Valgfrie:** `visitor_id`, `slug`, `campaign_id`, `latency_ms`
- **Levels:** DEBUG (dev), INFO (events), WARN (recoverable), ERROR (failure), FATAL (panic)
- **Korrelasjon:** `request_id` propageres Worker → control plane → Twenty
- **PII-håndtering:** aldri rå e-post eller IP i logger. E-post som `sha256(lower(trim))`. IP truncated.
- **Retensjon:** 30 dager hot i Loki, 1 år cold i Backblaze B2 (parquet-eksport)
- **Kostnad-tak:** 5 GB/dag → varsling før dyrere tier
- **Sampling:** DEBUG-logger samples til 1% i prod

## 8. Tester

### Unit (Vitest, kjøres på hver commit)
- Template-rendering med variasjoner av config (snapshot-tester)
- Config-validering mot TypeScript-skjema (Zod)
- Pixel-event-bygging (Meta CAPI, GA4 Measurement Protocol, TikTok Events API)
- UTM- og click_id-parsing
- Engagement-score-beregning

### Integration (Playwright, før merge til main)
- Full LP-render i ekte Chromium
- Form-submit ende-til-ende: Worker → control plane → Twenty Contact opprettet
- Pixel-firing-verifikasjon mot lokalt mock-endepunkt
- KV-push fra n8n → URL aktiv innen 5 sekunder
- Cookie-persistens på tvers av sider

### Load (k6, kjøres ukentlig + før prodrelease)
- **Spike:** 0 → 10k rps på 30s, hold i 2 min. Mål: p95 < 150ms, 0% errors.
- **Sustained:** 1k rps i 1 time. Mål: p99 < 200ms, ingen feilrate-økning.
- **Worst case:** 50k samtidige connections. Mål: ingen kollaps, eventer kø.

### Smoke (etter hver deploy)
- Health-check per service (`/health`)
- Test-LP rendrer korrekt
- Test-pixel mottar event
- Test-form oppretter lead-rad i Postgres

### Synthetic (kontinuerlig)
- Cloudflare Health Checks fra 5 lokasjoner
- Uptime-mål: 99.9% (~43 min/mnd nedetid tillatt)
- TTFB-måling fra Oslo, London, Frankfurt, NYC, Tokyo

### Chaos (månedlig)
- Drep KV-binding → fallback til origin skal fungere
- Drep Postgres-primary → events skal bufres i Worker queue
- Drep n8n-container → konfig-skriv skal feile pent (ingen halvskrevne configs)

## 9. Sikkerhet og personvern

- **GDPR:** `visitor_id` er pseudonym fram til form-submit. Da knyttes det til e-post i `leads`. Bruker kan slette alt via `/privacy/delete?id=<visitor_id>`.
- **Cookie-strategi:** kun `visitor_id` lagres uten samtykke (legitim interesse). Pixler venter på samtykke i jurisdiksjoner som krever det.
- **TLS:** kun TLS 1.3, HSTS preload
- **CSP:** strikt — kun selv + cdn.cloudflare + pixel-domener (whitelistet per LP)
- **Rate-limiting:** alle endepunkter, både per-IP og global
- **Bot-detection:** Cloudflare bot management + Turnstile på form
- **Secrets:** Cloudflare Secrets + 1Password Connect; aldri i git
- **Backup:** Postgres → Backblaze B2 hvert 6. time, 30 dagers retensjon

## 10. Observabilitet

### Dashboards (Grafana)
- **System:** rps, p50/p95/p99 TTFB, error rate, cache hit ratio per Worker
- **Funnel:** pageview → engagement → form-attempt → form-submit → identified
- **Per-LP:** live tall per slug, sammenliknbart side-ved-side
- **Attribution:** kontakter per kanal/kampanje siste 30 dager
- **Visitor:** geo-heatmap, enhetsfordeling, returning-rate

### Alerts (Slack `#marketing-eng`)
- Error rate > 1% i 5 min → kritisk
- p95 TTFB > 200ms i 5 min → varsel
- Form-submit-rate dropper > 50% mot 7-dagers baseline → undersøkes
- n8n-workflow feilet → varsel
- Cloudflare-spike > 10× baseline → info
- Postgres connections > 80% pool → varsel
- Bot-rate > 30% på en LP → varsel (mulig angrep)

## 11. Deploy og rollback

- **Worker:** blue/green via `wrangler deploy --env=staging` → smoke-tester → promote til prod. Rollback: `wrangler rollback`.
- **Control plane:** Coolify med automatisk rollback ved health-fail.
- **Config:** versjonert i Postgres (`version`-felt). Tidligere versjoner kan re-pushes til KV på 1 kommando.
- **Database-migrations:** alle reversible. Testet i staging mot prod-snapshot.

## 12. Failure modes

| Failure | Brukereffekt | Mitigering |
|---|---|---|
| KV nede | LP returnerer cached HTML | Stale-while-revalidate 1t |
| Cloudflare totalt nede | LP utilgjengelig | DNS-failover til Hetzner origin (degraded) |
| Hetzner nede | n8n + admin nede; LPer fungerer | Daglig snapshot, recovery < 30 min |
| Postgres primary nede | Leads bufres i Worker Durable Object | Replay etter recovery |
| Twenty-API nede | Leads lagres i Postgres, sync ved retur | Cron-job sjekker hver 5. min |
| Pixel-endepunkt nede | Events bufres lokalt | Replay |
| n8n-feil under config-produksjon | Kampanje markeres `failed`, varsel | Manuell retry eller fix-og-retry |

## 13. Åpne tekniske spørsmål

- Cloudflare Logs Push direkte til Backblaze, eller via Vector for transformasjon?
- Egen lett session-replay (event-stream) vs Sentry/PostHog full replay?
- `engagement_score` i Worker (live) vs batch-jobb mot Postgres?
- Skal vi bruke Cloudflare R2 for kreativer eller beholde MinIO på Hetzner?
- Tier på Twenty for prod — selvhostet eller cloud når den blir GA?
