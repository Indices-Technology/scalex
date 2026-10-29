# ScaleX: working instructions

Read this first, every session. It is the single source of truth for what ScaleX is, the rules,
and **which step we are on**. Details live in `docs/`; this file says how to use them.

## What ScaleX is

ScaleX scales businesses. A seller lists a product and ScaleX gets it in front of people who
already want it, so it sells without broad ads. Indices Technology builds it; **MarketX is the
first tenant**, and MarketX is nearly empty (no organic sale yet, ~zero real GMV, almost all
link clicks are bots), which is exactly why ScaleX exists.

Two halves, one loop:

- **Thinker**: understands products, finds and weighs demand, separates signal from noise,
  keeps the evidence behind every conclusion.
- **Doer**: acts on an approved match through a permitted channel, records what happened.

```
DEMAND ─┐
        ├─▶ MATCH ─▶ DECIDE ─▶ ACT ─▶ OUTCOME ─▶ LEARN ─┐
SUPPLY ─┘                                               │
   ▲────────────────────────────────────────────────────┘
```

Success is **completed sales traced to an experiment and compared with a baseline**. Not
records collected, reports written or clicks.

## Documents (read the one the current step needs)

| Doc | What it holds |
|---|---|
| `docs/PLAN.md` | Phases 0–4, tasks, exit tests, stop rules, unit economics, costs, Joshua's actions, risks |
| `docs/ARCHITECTURE.md` | Layers, the chain of records, source adapter contract, KPIs, guardrails, what Joshua can see |
| `docs/ENGINE.md` | The match loop, reach rule, data shapes, match score |
| `docs/SOURCES.md` | Every data source with terms checked 2026-10-28 and a verdict (Ready / Needs approval / Risky / No) |
| `README.md` | Layer table, how to run the app, and the parked v0 leads loop (in `layers/act`) |
| `../marketX/docs/SCALEX.md` | The older plan to move MarketX's growth code into ScaleX by strangler. Still valid for that move; not the current priority |

If a doc and this file disagree, this file's **Current step** wins; fix the doc.

## Current step

Work strictly step by step. Finish a step, verify it, report it, update this table, then stop
and wait for Joshua before starting the next.

| Step | What | State |
|---|---|---|
| 0.1 | Real purchase test on production (Joshua pays; Claude checks DB and logs) | Waiting on Joshua |
| 0.2 | Check paid / failed / abandoned payments are told apart; team test orders excludable (read-only) | **Next** |
| 0.3 | Read-only audit of all published MarketX products (indexing, Merchant Center, price/unit/location/delivery, contradictory flags, filler descriptions, stock date) | Next |
| 0.4 | MarketX platform-side fixes (search title/snippet, product data for Google, flag rules). Seller content untouched | After 0.3, Joshua approves |
| 0.5 | Automatic "confirm your listing" prompt to sellers (in-app + email) | After 0.4 |
| 0.6 | Baseline from Search Console and Merchant Center, reported separately (read-only script, no DB) | Needs Search Console service account |
| 1.x | First matched-demand test; see `PLAN.md` Phase 1. Category/city **not chosen yet** (Lagos appliances via HadronPower is a hypothesis) | After Phase 0 exit test |

Known facts so far:
- Search Console: `sc-domain:marketx.africa` is verified (added 2026-09-07) and linked to
  Merchant Center 5842698553. Queries are almost all brand; the only product query is
  "antimony" (47 impressions, 0 clicks), which lands on MarketX product #366 "Antimony ore"
  (OkoroSamuel store, ₦2,000,000, no unit, collector-style description, wrongly flagged
  thrift/accessory/deal).
- MarketX keeps a **2%** fee; the buyer pays the Paystack fee (Paystack dashboard setting).

## Non-negotiable rules

1. **No black hole.** Every action must be traceable: Evidence → DemandSignal → Match →
   Decision → Action → Outcome, all linked by foreign keys, append-only. Acceptance test for
   any build: trace any outcome or any denied decision back to its evidence in under a minute.
2. **LLM proposes, code decides.** Model calls go through one gateway in `core` (logs model,
   prompt version, cost; zod-validates output; invalid output fails closed). Only an allowed,
   unexpired `Decision` can reach `act`.
3. **Reachable demand first.** Collect a demand signal only with a permitted way to act on it,
   and record that way.
4. **Evidence, not volume.** One source = a lead. Two independent evidence types = an
   assessment. A completed sale = proof. Copies and reposts count once.
5. **Always a baseline.** Never credit ScaleX for a sale that merely happened after launch.
   Unknown attribution stays `unknown`.
6. **Permitted sources only** (see `SOURCES.md`). No scraping Instagram, Jiji, Jumia, Telegram;
   no private groups; no cold messages; no automated replies to strangers; never cold-send from
   the MarketX WhatsApp Business number (it carries OTP and order messages).
7. **No person in the loop by design.** Joshua does not contact sellers. Anything needing a
   human message must go through the product (in-app, email, forms) or be dropped.
8. **Spend follows proof.** Hard caps per experiment/day/month; small first tranche; no
   automatic increase; new paid channel or bigger budget needs Joshua's approval. Write unit
   economics before spending (MarketX earns 2% × price per sale).
9. **Learning proposes, Joshua promotes.** No automatic changes to production scoring.

## Architecture in one screen

Nuxt layers in `layers/`; each may import only from layers with a lower rank (evidence and
outcomes share rank 3 and may not use each other). `tests/layering.spec.ts` enforces it,
including Nitro auto-imported utils.

```
L7 ops        API, admin page (5 saved queries), weekly report, kill switches
L6 act        action adapters; only executes an allowed Decision
L5 decide     economics, policy gate, budgets, approvals, switches
L4 think      demand assessor, product tagger, matcher (score breakdown + alternatives)
L3 evidence   canonical evidence, provenance, dedupe, freshness
L3 outcomes   experiments, attribution, KPI queries
L2 sources    SourceAdapter contract, registry, runtime, adapters/<id>/
L1 core       ids, tenant, errors, schemas, db, logger, traceId, model gateway
```

- **Adding a source = one folder in `sources/adapters/` + a registry row.** No change to
  think/decide/act. Adapters fetch and map fields only; they never interpret. The runtime
  handles schedule, checkpoint, retry, rate limit, cost cap, retention and `SourceRun` rows.
  `think` asks for a capability (`keyword_volume`), not a source name. A source is enabled only
  after the shared contract test kit passes and its terms are recorded in its manifest.
- **Postgres only.** Nitro scheduled tasks + `SourceRun` table; no Redis (MarketX's Upstash
  quota already ran out).
- The parked v0 leads loop lives in `act`; Phase 3 routes it through `decide`.

KPIs come in three tiers (business, Thinker, system); see `ARCHITECTURE.md` §4. North star:
**completed sales**. Show counts next to rates; zero sales means cost per sale is undefined.

## How to work in this repo

- **Never commit or push.** Joshua does both. Leave changes uncommitted and end with the files
  changed and a suggested commit message.
- **Database writes need Joshua's OK first**: say what and where before any insert, update,
  import or migration. Reads are fine. On Neon, run migrations over the direct (non-pooler) URL.
- **MarketX data is read only through its API** once one exists. Phase 0 read-only scripts
  against MarketX's database are allowed, and they stay out of this repo (scratch only).
- Secrets go in `.env` / `.secrets/` (gitignored), never in code, docs or chat.
- Responses to Joshua: numbered, plain English, separate *done / verified / next*.
- Keep it small: build only what the current step needs. Mark deliberate shortcuts with a
  `ponytail:` comment naming the limit and the upgrade path.
- Every non-trivial piece of logic leaves one runnable test (`npm test`, vitest).
- Re-check a source's terms before building its adapter, and record the date in its manifest.
- Run: `npm run dev` (port 3200), `npm test`, `npx nuxi typecheck`.
