# Marketing Engine — Operations

**Versjon:** 0.1 · **Dato:** 6. mai 2026 · **Eier:** Pontus

Hvordan systemet faktisk drives — prosesser, godkjenninger, budsjetter, eskalering. Dekker hullene tech-arkitekturen ikke svarer på.

---

## 1. Roller

| Rolle | Ansvar | Person (v1) |
|---|---|---|
| **Admin / System Owner** | Infrastruktur, hendelser, tilgang | Pontus |
| **Marketing Operator** | Oppretter kampanjer, godkjenner AI, monitorerer | Pontus (delegeres senere) |
| **Sales / Lead Owner** | Mottar kvalifiserte leads, oppfølging | Pontus eller selger |
| **Reviewer (compliance)** | Godkjenner kampanjer over budsjett-terskel | Pontus |

I praksis er Pontus alle rollene i v1. Flytene er likevel tydelig adskilt slik at delegering blir enkelt.

## 2. Godkjenningsflyt — fra AI-output til live

1. n8n produserer kampanjepakke (annonser + LP-configs) → status `pending_review` på Twenty `Campaign`
2. Slack-melding i `#marketing-review` med preview-lenker:
   - Hver annonsevariant (copy + visuell)
   - Hver LP rendret til staging-URL (KV-staging, ikke prod)
   - Brand-voice-sjekk-rapport (kjørt automatisk via `brand-voice:enforce-voice`)
3. Operatør gjør én av tre handlinger:
   - **Approve** → status `approved` → n8n pusher til prod-KV + Postiz publiserer
   - **Reject** → kommentar i Twenty → n8n regenererer (max 2 forsøk) eller markerer `failed`
   - **Edit** → manuell justering i Twenty admin-UI → re-submit
4. **SLA:** review innen 4 arbeidstimer. Etter 8 timer: auto-eskalering til Pontus.

**Hard regel:** ingen kampanje kan publiseres uten `approved`-status. n8n-publish-noden sjekker dette og feiler hvis omgått.

## 3. AI-kostnadskontroll

| Kontroll | Verdi (default) |
|---|---|
| Per-kampanje AI-budsjett | 200 NOK |
| Månedlig AI-tak | 5000 NOK |
| Varsling | 70 % av månedstak |
| Hard stop | 100 % av månedstak |

**Modell-tiering:**
- **Haiku** — first-pass copy, klassifisering, brand-check (billigst)
- **Sonnet** — endelig copy, LP-config-generering
- **Opus** — kun for premium-kampanjer eller når Sonnet ikke holder
- **Flux Schnell** — raske bilde-utkast for review
- **Flux Pro** — endelig kreativ etter approval
- **Wan 2.2 / Runway** — kun video, kun etter eksplisitt budsjettgodkjenning

Hver n8n-AI-node logger `cost_nok`, `model`, `campaign_id` til `ai_spend_log`-tabellen. Daglig kost summert i Grafana.

## 4. Annonse-budsjettstyring

| Nivå | Default tak | Kan overskrides av |
|---|---|---|
| Per kampanje | 5 000 NOK | Operator |
| Per dag på ad-account | 2 000 NOK | Admin |
| Per måned globalt | 50 000 NOK | Admin med skriftlig godkjenning |
| Manuell godkjenning kreves | > 10 000 NOK kampanje | Admin |

**Pacing:** n8n setter dagscap = (månedstak − brukt så langt) / (dager igjen i måneden). Cap revurderes daglig.

**Audit:** alle `ad_create`-handlinger logges til `ad_spend_log` med plattform, kreativ-ID, budsjett, kampanje. Daglig dump til Postgres for sporbarhet.

**Kill-switch:** én Slack-kommando `/pause-all` stopper aktive annonser på alle plattformer via Postiz/n8n. Brukes ved feilkonfig eller AI-glipp.

## 5. Lead-håndtering og sales handoff

### Scoring-terskler

| Score | Kategori | Aksjon |
|---|---|---|
| 0–30 | Cold | E-post nurture-sekvens, ingen varsling |
| 31–60 | Warm | E-post-prioritet, retargeting-pool, daglig digest til sales |
| 61–80 | Hot | Slack `#sales-hot` umiddelbart, retargeting prioritert |
| 81–100 | On fire | Direkte varsling + telefon-trigger hvis tilgjengelig |

### SLA-respons (arbeidsdager 08–17)

| Kategori | Første respons |
|---|---|
| On fire | 30 min |
| Hot | 1 time |
| Warm | 24 timer (automatisk e-post er nok) |
| Cold | Kun e-post-sekvens |

### Tildeling
Round-robin på `lead.assigned_to` når flere selgere finnes. Re-tildeles hvis ikke kontaktet innen SLA.

### Statusløp
`New → Contacted → Qualified → Negotiating → Won / Lost`

### Re-engagement
- Ikke-kontaktet etter 7 dager → varsel
- Ikke-kontaktet etter 14 dager → automatisk drip starter
- Lost → 90-dagers cool-down, deretter ny kampanje-eligibility

## 6. Samtykke (consent management)

- **Cookie-banner** ved første LP-besøk: `Accept all` / `Essential only` / `Customize`
- Pre-checked tillates ikke. Decline og Accept har lik visuell prominens (Datatilsynet-krav).
- Samtykke lagres i `consent` first-party cookie med felter: `version`, `timestamp`, `categories[]`, `ip_truncated`
- Pixler **venter** på samtykke. Google Consent Mode v2 og Meta CAPI sender events med `consent_state`-felt selv før samtykke (cookieless ping).
- Tilbakekalling: footer-lenke `/privacy/manage` → vis nåværende samtykke + endre/tilbakekall
- Datasletting: `/privacy/delete?id=<visitor_id>` → manuell godkjenning av Pontus → sletting fra Postgres + Twenty + Cloudflare KV + e-post-suppression

## 7. E-post-operasjoner

### Setup (engangsoppgave før første kampanje)
- Sender-domene `mail.dittdomene.no` (separat fra LP-domene)
- DNS: SPF (`v=spf1 include:resend.com -all`), DKIM (Resend), DMARC starter på `p=quarantine`
- Etter 30 dager med god leveranse → DMARC `p=reject`

### Warm-up-plan (4 uker)
| Uke | Daglig volum | Mottakere |
|---|---|---|
| 1 | 50 | Mest engasjerte fra eksisterende liste |
| 2 | 500 | Engasjert + warm |
| 3 | 2 000 | Bredere liste |
| 4+ | 5 000+ | Full liste |

### Hygiene-KPIer (rød/gul/grønn)
| KPI | Grønn | Gul | Rød (handling) |
|---|---|---|---|
| Bounce-rate | < 2 % | 2–5 % | > 5 % — pause + utvask |
| Complaint-rate | < 0.1 % | 0.1–0.3 % | > 0.3 % — pause + review |
| Open-rate | > 25 % | 15–25 % | < 15 % — vurder lista |
| Click-rate | > 2 % | 1–2 % | < 1 % — innholds-review |

### Suppression
- Auto-suppression på: hard bounce, spam complaint, manual unsub
- Suppression-liste delt mellom transactional og marketing — ingen unntak
- Reaktivering kun ved eksplisitt re-opt-in

### Liste-hygiene
- Månedlig: fjern adresser med 0 åpninger på 6+ mnd
- Kvartalsvis: domain-validering, fjern catch-all og engangsdomener

## 8. Plattform-compliance

### Meta
- Domeneverifisering på `dittdomene.no` (Business Manager)
- Aggregated Event Measurement: 8 events prioritert, øverste = `Purchase` eller `Lead`
- CAPI med `event_id`-deduplisering mot pixel
- Advanced Matching aktivert (hashed e-post + telefon)

### TikTok
- Pixel + Events API kombinert
- Advanced Matching (hashed e-post)
- Dynamic events for hvert konverterings-steg
- Domene whitelistet i Business Center

### Google
- Consent Mode v2 i Tag Manager Server-Side
- Enhanced Conversions med hashed e-post
- GA4 + Google Ads linket
- Conversion-actions definert per kampanjetype

### LinkedIn
- Insight Tag på alle LPer
- Conversion API for offline-konverteringer

**Sjekkliste:** kvartalsvis full audit av alle plattformer mot policy-endringer.

## 9. Attribusjonsmodell

- **Primær:** data-driven multi-touch (vekt etter korrelasjon med konvertering)
- **Fallback:** lineær multi-touch når < 1000 konverteringer per måned
- **Rapporteres parallelt:** first-touch og last-touch (for sammenlikning og diskusjon)
- **Vindu:** 30 dager click, 1 dag view
- **Re-evaluering:** kvartalsvis. Skift av modell krever skriftlig beslutning + kjøring på historikk for å se effekt.

## 10. Hendelseshåndtering

### Alvorlighetsgrader

| Grad | Definisjon | Recovery-mål | Varsling |
|---|---|---|---|
| **P0** | Alt nede; LPer 5xx; ingen leads inn | 1 time | Slack `@channel` + SMS |
| **P1** | Degradert; pixler tapt; én kanal nede | 4 timer | Slack-varsel |
| **P2** | Funksjonsfeil; n8n-workflow feilet; én LP nede | 24 timer | Slack-info |
| **P3** | Kosmetisk; rapportering henger; ikke-blokkerende | 1 uke | Issue-tracker |

### Post-mortem
P0 og P1 krever skriftlig post-mortem innen 48 timer. Lagres i `incidents/yyyy-mm-dd-tittel.md`. Mal: hva skjedde, tidslinje, root cause, hva fikset det, hva forhindrer at det skjer igjen.

## 11. Tilgang og audit

- **SSO** (Google Workspace) på Twenty, n8n, Grafana
- **2FA** påkrevd for alle admin-roller
- **Roller:**
  - **Admin** — full tilgang, kan endre infrastruktur (Pontus)
  - **Operator** — kan opprette kampanjer, godkjenne, se kontakter
  - **Viewer** — kan se data, ikke endre
  - **API** — service-accounts for integrasjoner, scoped per behov
- **Audit-logg:** alle config-endringer, publiseringer, lead-eksport, og PII-aksess. Lagres 1 år.
- **Access review:** kvartalsvis. Fjern inaktive brukere. Roter API-nøkler.

## 12. Runbooks

Korte oppskrifter for vanlige scenarioer. Hver er en egen `runbooks/<navn>.md` med klikk-for-klikk-steg.

1. **Aktivere ny LP manuelt** (utenom n8n)
2. **Akutt-pause alle kampanjer** (`/pause-all` Slack-kommando)
3. **Tilbakestille pixler** etter feilkonfig
4. **Filtrere ut bot-trafikk** fra attribution
5. **Slette bruker (GDPR)** — full sletting på tvers av Postgres, Twenty, KV, e-post-suppression
6. **Restarte n8n-workflow** uten tap av kø
7. **Failover fra Cloudflare til Hetzner-origin**
8. **Rulle tilbake LP-config** til tidligere versjon
9. **Re-warming av e-post-domene** etter sender-rep-fall
10. **Onboarding av ny operator**

## 13. Disaster recovery

- **RTO** (recovery time): 2 timer for control plane, 0 for render plane (Cloudflare overlever uansett)
- **RPO** (recovery point): max 6 timer datatap
- **Backup:**
  - Postgres → Backblaze B2 hver 6. time, daglig snapshot
  - n8n-workflows → git-eksport hver natt
  - Twenty-config → daglig snapshot
- **Tabletop-øvelse:** kvartalsvis simulering. Pontus øver gjenoppretting fra null.
- **Off-site:** backup-keys lagres i 1Password og fysisk safe.

## 14. Operative KPIer (ukentlig review)

| KPI | Mål |
|---|---|
| Tid kampanjeidé → live | < 30 min |
| Review-tid (innsendt → godkjent) | < 4 t |
| AI-kostnad per kampanje | < 200 NOK |
| Cost per lead (per kanal) | track + benchmark |
| Lead-respons-tid (hot) | < 1 t |
| E-post bounce-rate | < 2 % |
| E-post complaint-rate | < 0.1 % |
| Pixel-leveranse-rate | > 95 % |
| LP-uptime | > 99.9 % |
| CAC (Customer Acquisition Cost) | track månedlig |
| LTV / CAC ratio | > 3.0 |

Alle KPIer eksponeres i Grafana-dashbordet `marketing-ops`. Ukentlig 30-min review hver mandag — hva gikk bra, hva gikk galt, hva endrer vi.

## 15. Endringshåndtering

- **Små endringer** (config, kreativ, kopi): Operator kan deploye direkte
- **Mellomstore** (ny template, ny kanal): krever skriftlig plan + Admin-godkjenning
- **Store** (arkitektur, ny database, ny tredjepart): krever PRD-oppdatering + tabletop

## 16. Åpne operative spørsmål

- Hvem håndterer e-post-svar når en kunde svarer på en automatisert mail?
- Når får vi første dedikerte selger og hvordan endrer det handoff-flyten?
- Skal vi outsource compliance-review (DPO) eller holde det internt?
- Hvilken eskaleringskanal til Pontus utenfor arbeidstid?
- Hvor lagrer vi formelle godkjennings-dokumenter (kampanjer over 10k NOK)?
