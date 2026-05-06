# Marketing Engine — PRD

**Versjon:** 0.1 · **Dato:** 6. mai 2026 · **Eier:** Pontus

---

## 1. Sammendrag

En selvbetjent markedsføringsmotor som kjører hele løpet fra kampanjeidé til identifisert kunde uten manuell mellomkomst. AI produserer annonser og LP-config, edge-rendrede landingssider fanger trafikk, server-side pixler matcher mot CRM, og automatiserte sekvenser pleier leads til konvertering.

## 2. Problem

Hver ny kampanje krever i dag manuelt arbeid med kreativer, landingssider, tracking og oppfølging. Sporbarheten mellom annonse, klikk og kunde brytes underveis. Resultat: lav fart på å teste vinkler, dårlig attribution, og ineffektiv re-targeting.

## 3. Mål (v1)

- Produsere komplett kampanje (kreativ + LP + sporing) på under 30 minutter
- Hver annonse har sin egen LP — ingen "alt sender til samme side"
- Server-side tracking som overlever iOS/ITP og ad-blockere
- Hele kundereisen synlig i Twenty CRM som én `attribution_path`
- LP-fabrikken tåler 50k besøk på 10 minutter uten manuell oppskalering

## 4. Ikke-mål (v1)

- Ikke erstatning for hovednettsiden (Smartout holdes utenfor)
- Ikke et fullt CMS — kun config-drevne maler
- Kun to startmaler; flere kommer ved behov
- Ingen flerspråksstøtte
- Ingen innebygd A/B-testing (kommer i v2)

## 5. Brukere

- **Markedsfører (intern):** oppretter kampanje i Twenty, godkjenner AI-output, følger leads
- **Slutt-bruker:** klikker annonse → lander på spesialisert LP → konverterer

## 6. Kjerneflyt

1. Kampanje opprettes i Twenty CRM (mål, tilbud, persona)
2. n8n + Claude genererer annonsevarianter og én LP-config per variant
3. LP-config pushes til Cloudflare KV → URL aktiveres umiddelbart
4. Postiz publiserer annonser med URL-er som peker til hver sin LP
5. Bruker klikker → Cloudflare Worker rendrer LP fra config + template
6. Server-side pixel logger event → anonymt objekt i Twenty (cookie-basert)
7. Form-submit → identifisert Contact i Twenty med full `attribution_path`
8. Nurture-loop: e-post-sekvens, retargeting, og personlige LPer fra samme fabrikk

## 7. Arkitektur

**Control plane — Hetzner + Docker:**
- Twenty CRM (kampanjer, kontakter, attribution)
- n8n (orkestrering, AI-kall, push til edge)
- Postiz (sosial publisering)
- Postgres (config-audit, leads)
- Caddy (reverse proxy)

**Render plane — Cloudflare:**
- Pages + Workers (LP-rendering på edge)
- KV (config-lookup per slug)
- HTML-cache (TTL 1t, invalideres ved push)

## 8. LP-config (datamodell)

JSON med felt: `slug`, `template`, `theme`, `hero`, `bullets`, `form`, `pixels`, `tracking`. Validert mot TypeScript-typer i Worker. Lagres i Postgres (audit) + Cloudflare KV (servering).

## 9. Templates (v1)

- **Template A — Lead Capture**: hero, 3 bullets, e-postform, sosiale bevis. For kalde annonser.
- **Template B — Long Form**: hero, problem, løsning, video, testimonial, full form. For varmere trafikk.

## 10. Skalering

- Hetzner-boksen ser kun admin- og lead-trafikk (lavt volum, ~tusentall/dag)
- All offentlig trafikk treffer Cloudflare edge (300+ POPer)
- Worker + KV skalerer til 100k+ rps uten manuell skalering
- Forventet kostnad: ~$5/mnd Cloudflare + ~50 EUR/mnd Hetzner ved 1M LP-views/mnd

## 11. Suksessmål (90 dager)

| Mål | Måltall |
|---|---|
| Tid fra kampanjeidé til live LP | < 30 min |
| Match-rate annonse → LP-config | 100% (én-til-én) |
| Attribution-dekning | > 90% av leads med full kjede |
| Trafikkapasitet | 50k besøk/dag uten degradering |
| Aktive LPer samtidig | 50–200 |

## 12. Leveranser

**Fase 1 — Foundation (uke 1–2)**
Docker-compose med Twenty, n8n, Postgres, Caddy oppe på Hetzner. Cloudflare Pages-repo med Worker, KV-binding, og de to template-komponentene. Basic `/lp/<slug>`-rendering som leser fra KV.

**Fase 2 — Pipeline (uke 3–4)**
n8n-workflow: kampanje → AI-produksjon → push til KV → Postiz publish. Server-side pixel-events fra Worker. Form-submit-proxy fra Worker til Hetzner `/api/leads`.

**Fase 3 — Loop (uke 5–6)**
Identity resolution og dedup i Twenty. Nurture-sekvenser (e-post + retargeting). Personalised LP-trigger fra kontakt-events.

**Fase 4 — Polish (uke 7–8)**
Admin-UI i Twenty for LP-stats. Auto-cleanup av døde LPer. Dokumentasjon.

## 13. Risiko

- **Twenty CRM-ustabilitet** — ung plattform, breaking changes. Ha dump/migrasjons-strategi klar.
- **Cloudflare-lock-in** — lav risiko, kan flyttes til Vercel/Fastly hvis nødvendig.
- **AI-kvalitet** — dårlig copy må kunne stoppes før publish. Manuell godkjenning i v1.

## 14. Avhengigheter

- Cloudflare-konto, Workers Paid ($5/mnd)
- Hetzner CCX-instans (~50 EUR/mnd)
- Twenty + Postiz selvhostet (gratis, OSS)
- Claude API (Anthropic) for AI-produksjon
- Meta/Google/TikTok ads-tilganger med Conversions API aktivert

## 15. Åpne spørsmål

- Hvilket persona-objekt-skjema skal Twenty ha for `Campaign`?
- Skal LP-er ha utløpsdato (auto-deaktivering) eller leve til manuell stop?
- Hvor mye AI-output skal kreve manuell godkjenning før publisering?
- Skal nurturings-LPer ha egen template C, eller gjenbruke A/B?
