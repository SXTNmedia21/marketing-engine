---
title: Attribution Package
status: done
updated: 2026-05-06
created: 2026-05-06
module: attribution
tags: [attribution, scoring, multi-touch, lead-scoring]
---

# @me/attribution

Pure-function multi-touch attribution math and lead scoring. Zero IO, zero side effects.

## When to use which model

| Model | ID | Best for | Fallback |
|---|---|---|---|
| First Touch | `first_touch` | Brand awareness, discovery channel analysis | — |
| Last Touch | `last_touch` | Closing channel analysis, conversion credit | — |
| Linear | `linear` | Equal channel weighting, baseline comparison | — |
| Data-Driven | `data_driven` | Algorithmic credit by empirical correlation | Falls back to linear when `nConversions < 1000` |

OPERATIONS §9 mandates **data-driven** as primary, **linear** as fallback, and first/last reported in parallel for comparison.

## Attribution models

All models export `attribute(path, conversionValue, weights?, nConversions?) → CreditMap`.

```ts
import { models } from '@me/attribution';

const path = [
  { touchId: 't1', ts: 0, channel: 'paid', source: 'google' },
  { touchId: 't2', ts: 86400000, channel: 'organic', source: 'google' },
  { touchId: 't3', ts: 172800000, channel: 'email', source: 'resend' },
];

// Linear — equal split
const credits = models.linear.attribute(path, 1000);
// → Map { 't1' → { credit: 0.33, value_nok: 333 }, ... }

// Data-driven — with weights (n ≥ 1000)
const weights = new Map([['t1', 3], ['t2', 1], ['t3', 2]]);
const ddCredits = models.dataDriven.attribute(path, 1000, weights, 1500);

// Factory pattern
import { getModel } from '@me/attribution';
const model = getModel('first_touch');
const result = model(path, 1000);
```

### CreditMap

```ts
type CreditMap = Map<string, { credit: number; value_nok: number }>
// credit: 0–1 (all credits in a map sum to 1)
// value_nok: credit × conversionValue
```

## Scoring formulas

### Engagement Score (0–100)

```
score = 30 × time_factor + 30 × scroll_factor + 40 × interaction_factor
```

| Component | Weight | Formula |
|---|---|---|
| Time on page | 30% | `min(totalEngagementSeconds / 300, 1)` — 5 min = 100% |
| Scroll depth | 30% | `highestMilestoneHit / 100` — milestones: 25/50/75/100 |
| Interactions | 40% | `min(interactionCount / 5, 1)` — 5 interactions = 100% |

Interaction events: `click`, `cta_click`, `form_field_focus`, `form_submit_attempt`, `form_submit_success`, `exit_intent`.

### Intent Score (0–100)

Additive bonuses — max 100:

| Signal | Bonus |
|---|---|
| Any `form_field_focus` event | +30 |
| Any `scroll_depth` milestone ≥ 75 | +25 |
| Any `return_visit` with `isReturn = true` | +25 |
| Total engagement/time seconds > 60 | +20 |

### Lead Score (0–100)

```
leadScore = round((engagementScore + intentScore) / 2)
```

## leadCategory mapping

Matches Twenty `leadAttribution.leadCategory` SELECT enum exactly.

| Score range | Category | Twenty value | Action |
|---|---|---|---|
| 0–30 | Cold | `cold` | E-post nurture-sekvens |
| 31–60 | Warm | `warm` | Retargeting-pool, daglig digest |
| 61–80 | Hot | `hot` | Slack `#sales-hot` umiddelbart |
| 81–100 | On Fire | `on_fire` | Direkte varsling + telefon-trigger |

```ts
import { scoring } from '@me/attribution';

const events = [/* ScoringEvent[] */];
const s = scoring.lead.score(events);       // 0-100
const cat = scoring.lead.category(s);       // 'cold' | 'warm' | 'hot' | 'on_fire'
```

## Utilities

### buildAttributionPath

Extracts Touch[] from a ScoringEvent stream (pageview events only).

```ts
import { buildAttributionPath } from '@me/attribution';
const path = buildAttributionPath(events);
```

### dedupeConsecutive

Collapses consecutive touches from the same channel+source within a 1-minute window.

```ts
import { dedupeConsecutive } from '@me/attribution';
const clean = dedupeConsecutive(path);
```

## Edge cases

- Empty path → empty `CreditMap` (no error)
- `NaN` or `Infinity` conversionValue → throws `RangeError`
- `NaN` or negative weight → treated as weight=1 (neutral)
- All-zero weights → falls back to linear
- `data_driven` with `nConversions < 1000` → logs warning + returns linear
- `category(NaN)` → `'cold'` (safe fallback)
- Scores are always clamped and rounded to integer 0–100
