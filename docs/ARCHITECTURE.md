# ScaleX architecture: connections, KPIs, guardrails

**Status:** Draft · **Written:** 2026-10-29 · Companion to `PLAN.md`, `ENGINE.md`, `SOURCES.md`

The one requirement: **no black hole.** For any action ScaleX takes, Joshua can open it and see
what evidence caused it, why this product and channel, what it cost, what the alternatives
were, what happened, and whether it beat the baseline. If ScaleX can't answer that, it doesn't
act.

Governing rule: **the LLM proposes and interprets; plain code validates, authorises, records
and measures.** No agent's claim that it "did the task" is trusted; only the records are.

---

## 1. Layers

One repo, one deployable web app plus one worker process, split into Nuxt layers (the same
structure MarketX and Posta use). Each layer may import only from layers **below** it.
`tests/layering.spec.ts` fails if a layer imports upward or sideways, including through Nitro
auto-imports.

```
 L7  ops        API, admin pages, weekly report, kill switches            ← Joshua looks here
 ─────────────────────────────────────────────────────────────────────────
 L6  act        action adapters (MarketX listing fix, email, alert, ads)  ← Doer
 ─────────────────────────────────────────────────────────────────────────
 L5  decide     economics, policy gate, budgets, approvals                ← the only door to act
 ─────────────────────────────────────────────────────────────────────────
 L4  think      demand assessor, product tagger, matcher                  ← Thinker
 ─────────────────────────────────────────────────────────────────────────
 L3  evidence   canonical records, provenance, dedupe, freshness
 L3  outcomes   attribution, experiments, KPI queries
 ─────────────────────────────────────────────────────────────────────────
 L2  sources    adapter contract, registry, runtime, adapters/*           ← plug and play
 ─────────────────────────────────────────────────────────────────────────
 L1  core       ids, tenant, errors, schemas, db, logger, tracing, model gateway, run log
```

| Layer | Owns | Must not |
|---|---|---|
| `core` | Types and versioned schemas, IDs, tenant context, error envelope, Prisma client, logger, trace IDs, the **model gateway** (one place that calls any LLM, logs model + prompt version + cost, validates output with zod) | Know about any source or channel |
| `sources` | `SourceAdapter` contract, registry, runtime (schedule, checkpoint, retry, rate limit, cost cap), one folder per adapter | Interpret data. An adapter fetches and maps fields; it never decides what something means |
| `evidence` | `Evidence` rows: original payload reference, provenance, observed/retrieved time, expiry, dedupe links, restrictions | Score demand |
| `outcomes` | `Experiment`, `Outcome`, attribution, baseline, KPI SQL | Take actions |
| `think` | Demand assessment (intent, location, confidence), product tagger, `Match` with score breakdown and alternatives | Execute anything. Its output is a proposal |
| `decide` | Unit economics, policy rules, budget ledger, approvals, kill switches. Produces `Decision` (allow / deny / defer / need-evidence + reason codes) | Be overridden by model output |
| `act` | `ActionAdapter` contract and adapters. Executes only an **allowed, unexpired** `Decision`; writes an `Action` receipt | Run without a `Decision` id |
| `ops` | Read API, admin pages, weekly report, switches | Write business data except approvals and switches |

The v0 leads loop already lives in `act` (seller acquisition is an action); Phase 3 routes it
through `decide`.

**Infrastructure on purpose:** Postgres only. Scheduling with Nitro scheduled tasks plus a
`SourceRun` table, not Redis. (MarketX's Upstash quota already ran out once; ScaleX doesn't
add to it.) Split the worker out or add a queue when a measured load needs it.

---

## 2. The chain of records (how you trace anything)

Every arrow is a foreign key, so you can start at a sale and walk back to the evidence, or
start at a rejected match and see why.

```
Source ─▶ SourceRun ─▶ Evidence ─▶ DemandSignal ─┐
                                                  ├─▶ Match ─▶ Decision ─▶ Action ─▶ Outcome
                     ProductSnapshot ────────────┘      │          │                    │
                                                     (alternatives) (reason codes)    Experiment
                                                                                         │
                                                                                     EvalRun
```

| Record | Holds | Key rule |
|---|---|---|
| `Source` | Adapter id + version, enabled, health, last good run, policy (retention, permitted use, cost cap) | Credentials live in env/secrets, never in this row |
| `SourceRun` | Requested / received / accepted / rejected / deduped counts, cost, quota used, errors, checkpoint | One row per run; failures are rows too |
| `Evidence` | What the source actually said, with provenance, `observedAt`, `expiresAt`, `dedupeOf` | Facts only. Never edited; corrections are new rows |
| `DemandSignal` | Interpretation: need, category, attributes, city, budget, intent (BROWSE/COMPARE/BUY), confidence, **reach path**, unknowns, evidence ids, model + prompt version | Interpretation is separate from the fact it came from |
| `ProductSnapshot` | Product as seen at a time: price, stock confirmed at, delivery area, attributes, seller response status | Old snapshots are kept; matches point at the one they used |
| `Match` | Signal ↔ product, score **breakdown** (category, attributes, location, price, recency, intent), losing alternatives, missing facts | Score is explainable by its parts |
| `Decision` | Proposed action + expected cost/benefit, policy result, reason codes, approver if needed, expiry | **Append-only.** The only thing `act` will execute |
| `Action` | Channel, external reference, cost, status, retries, idempotency key | One `Decision` → at most one successful `Action` |
| `Experiment` | Hypothesis, treatment vs baseline, budget, tranches, stop rules, result | Every `Action` belongs to one |
| `Outcome` | IMPRESSION / CLICK / ENQUIRY / ORDER / PAID / COMPLETED / REFUNDED / CANCELLED, source of the fact | Unknown attribution stays `unknown` |
| `EvalRun` | KPI values, model-quality scores on the labelled set, proposed weight changes | Proposals only; nothing is auto-applied |

Every row carries `tenant`, `traceId`, `schemaVersion`, timestamps.

---

## 3. Plug-and-play sources

Adding a source = a new folder in `sources/adapters/` + a registry row. **No change to `think`,
`decide` or `act`.**

```ts
interface SourceAdapter<Config, Raw> {
  manifest: {
    id: string                       // 'google-search-console'
    version: string
    kind: 'demand' | 'supply' | 'outcome' | 'context'
    capabilities: string[]           // 'search_queries', 'keyword_volume', 'buyer_requests', 'catalogue'
    evidenceType: string             // how 'think' must weigh it; never merged with another type
    policy: { retentionDays: number | null; permittedUse: string; termsCheckedAt: string }
  }
  configSchema: ZodType<Config>      // validated before enable; secrets come from env
  healthCheck(ctx): Promise<{ ok: boolean; detail?: string }>
  fetch(ctx, since: Checkpoint | null): AsyncIterable<{ externalId: string; observedAt: Date; raw: Raw }>
  normalize(raw: Raw): CanonicalEvidence   // field mapping only, no interpretation
}
```

The runtime (not each adapter) does scheduling, checkpoints, retries, rate limits, the cost
cap, retention deletes and the `SourceRun` row. `think` asks for a **capability**
(`keyword_volume`), not a source name, so a provider can be swapped.

**Lifecycle:** register → configure → contract tests pass (shared test kit, run on a recorded
sample) → policy set → enabled with a cost cap → monitored → suspend/remove. Disabling stops new
collection; history and deletion follow the source's own terms.

Start with two contrasting adapters: `marketx-catalogue` (supply) and `google-search-console`
(demand already reaching us).

---

## 4. KPIs

Three tiers, so that a failure points at a cause. Counts are always shown next to rates;
zero sales means cost per sale is **undefined**, not zero.

### 4a. Business (is it working?)

| KPI | Definition | Phase used |
|---|---|---|
| **Completed sales** (north star) | Payment- and delivery-confirmed, traced to an `Experiment` | 1+ |
| Contribution after acquisition | MarketX: 2% × sales − acquisition cost. Seller: their margin − their costs | 1+ |
| Cost per completed sale | Acquisition cost ÷ completed sales | 1+ |
| Incremental lift | Treatment rate − baseline rate | 1+ |
| Funnel rates | impression→click, click→enquiry, enquiry→order, order→completed | 0+ |
| Reachable-demand share | Valid signals with a permitted reach path ÷ all valid signals | 2+ |
| Seller fulfilment rate | Fulfilled ÷ due | 1+ |
| Seller responsiveness | Sellers who answered the "confirm your listing" prompt ÷ asked | 0+ |

### 4b. Thinker (does it understand?)

| KPI | How measured |
|---|---|
| Demand precision / recall | Against the hand-labelled Nigerian set (~200 to start), per intent class |
| Match precision at top 3 | Human-judged relevant ÷ shown, sampled weekly |
| Evidence coverage | Actionable matches with evidence links ÷ actionable matches (target 100%) |
| Freshness compliance | Decisions on unexpired evidence ÷ decisions (target 100%) |
| Independence | Signals confirmed by 2+ *independent* evidence types ÷ promoted signals |

### 4c. System (is it healthy and cheap?)

| KPI | Catches |
|---|---|
| Source freshness, run success, schema errors | Broken or stale connectors |
| Action success, duplicate-action rate (target 0) | Failed or repeated sends/posts/spend |
| Attribution coverage | Outcomes we can't trace |
| Model invalid-output / fallback rate | LLM failures (fail closed) |
| Cost per processed signal, cost per qualified match | Spend growing faster than value |

**Diagnosis map** (what the learning step does instead of "spend more"):

| Symptom | Look at |
|---|---|
| Impressions, few clicks | Relevance, ranking, title/snippet |
| Clicks, few enquiries | Search-to-page match, offer, price shown |
| Enquiries, few orders | Trust, price, payment, delivery |
| Orders, few completed | Cancellations, failed payments, fulfilment |
| Sales, negative contribution | Acquisition cost vs unit economics |

---

## 5. Guardrails (enforced in code in `decide`, not in prompts)

| Area | Rule |
|---|---|
| Authority | `act` executes only an allowed, unexpired `Decision`. No LLM call can reach an action adapter. Agents can't change permissions or budgets |
| Model output | zod-validated in the gateway; invalid → fail closed (deny, reason `model_invalid`) |
| Evidence | Every actionable match links evidence; expired evidence can't support a decision; scraped text is data, never instructions |
| Supply | Unknown stock or price → no product-specific paid action |
| Channels | Only adapters in the registry with a permitted-use policy. No scraping, no cold messages, no automated replies to strangers |
| Money | Hard caps per experiment, per day, per month in a budget ledger; first tranche small; no automatic increase; new paid channel or bigger budget needs Joshua's approval |
| Tracking | If attribution coverage drops below threshold, paid actions pause automatically |
| Duplicates | Idempotency key per `Decision`; retries can't double-send or double-spend |
| Learning | Proposes weight changes in `EvalRun`; promotion only after passing the labelled set and Joshua's approval |
| Stop | Global kill switch, plus one per channel and per experiment, checked immediately before every action |
| History | Decisions, actions and evidence are append-only; corrections are new rows |
| Privacy | Store references to personal data, not copies, unless needed and permitted; source retention rules applied by the runtime |

Thresholds start as proposals and get calibrated in Phase 1; only authorisation violations and
duplicate money actions are zero-tolerance.

---

## 6. What Joshua can see

No five dashboards on day one. Five **saved queries** behind one admin page and a weekly email:

1. **Health:** sources, last run, failures, cost this week.
2. **Evidence:** a signal, its original evidence, duplicates folded in, confidence, reach, expiry.
3. **Decision trace:** a match, its score parts, the alternatives that lost, missing facts,
   allowed/denied and why.
4. **Experiment funnel:** baseline vs treatment, spend, each funnel stage, contribution.
5. **Audit:** every allowed and blocked action, budget change, switch flip.

Acceptance test for every build: pick any `Outcome` or any denied `Decision` and walk the chain
to its evidence in under a minute.

---

## 7. Build order (matches `PLAN.md`)

| Phase | Layers built |
|---|---|
| 0 | `core` additions (traceId, model gateway stub), read-only scripts for the audit and baseline. No database yet |
| 1 | `sources` (contract, registry, runtime, 2 adapters, test kit), `evidence`, `think` (tagger + matcher v0), `decide` (economics, caps, switches), `act` (1 adapter: paid search or listing fix), `outcomes`, `ops` (5 queries) |
| 2 | More source adapters, labelled set + `EvalRun`, demand assessor with intent |
| 3 | `act` adapters for seller acquisition (leads), buyer alerts, seller channels |
