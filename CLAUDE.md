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
| 0.1 | Real purchase test on production (Joshua pays; Claude checks DB and logs) | Done 2026-10-29: Joshua made a real purchase after the fee change; Paystack flow works |
| 0.2 | Check paid / failed / abandoned payments are told apart; team test orders excludable (read-only) | **Done 2026-10-29: gaps found.** 20 orders ever (6 paid+delivered, 12 FAILED, 2 UNPAID cancelled). FAILED mixes "provider declined" and "expired unpaid"; no reason recorded. OrderEvent incomplete before ~Oct (1 PAYMENT_CONFIRMED for 6 paid). No team flag. All 6 paid orders look like team (user_255745, makintechsubscriptio, opesko), awaiting Joshua's confirmation. Fix proposed: PAYMENT_FAILED OrderEvent with a reason (no migration); team list kept in ScaleX config |
| 0.3 | Read-only audit of all published MarketX products (indexing, Merchant Center, price/unit/location/delivery, contradictory flags, filler descriptions, stock date) | **Done 2026-10-29.** 183 live products; 182 in Merchant feed, 183 in sitemap, so the shop window *exists*. The problem is what's in it: 100 titles are codes ("BA 455", all grandeur-store), ~126 filler descriptions, 85 with under 2 images. Supply is concentrated: grandeur-store 106, hadronpower 36 (team), hairhaven 28; ~100 products are abaya/gowns. Google acceptance and indexing are still unknown (need Merchant Center diagnostics + Search Console Pages). Per-product CSV was in the session scratchpad; rerun the audit to regenerate it |
| 0.4 | MarketX platform-side fixes (search title/snippet built from category, store, city and price, product data for Google, flag rules, PAYMENT_FAILED reason event). Seller content untouched. This is MarketX's own code, not ScaleX | **Built 2026-10-29, not deployed.** `shared/utils/searchListing.ts`: code titles get their category in front ("BA 455" becomes "Abaya BA 455"; 102 of 183 feed titles change), the page title adds price and city, and the snippet leads with name, price, store and city plus escrow. Feed adds `g:product_type`. A PAYMENT_FAILED event with a reason is written in `failAndRestore` and the expiry task. Flag-rule fixes skipped (they don't change what Google sees; the optimizer handles seller data). grandeur-store is in **Ibadan**, not Lagos |
| 0.4b | **Product optimizer** (ScaleX's first real loop). The client's catalogue feed comes in; `think` writes the title, description, tags and category from visible facts only (text, photos via a vision model, price, sizes), with missing facts turned into questions for the seller; `decide` checks seller consent (off / suggest / auto, default suggest still to be confirmed) and the no-invented-facts rule; proposals go out through the API and webhook; the client applies them and reports back; Search Console measures the result. **Why codes happen:** sellers with many similar items (grandeur-store's abayas) can't hand-name each one. The bot writes titles in **buyer words, not catalogue words**: lead with the term buyers actually type (e.g. "Dubai abaya", "jalabiya", "Ankara gown", "owambe dress", "abaya Lagos"), then one or two visible differentiators from the photo, then the seller's code (e.g. "Dubai abaya, black with stone work, BA 455"). The vocabulary comes from **demand evidence, not the model's guess**: Keyword Planner volumes for Nigeria, Search Console queries, and the seller's answer to "what do your customers call this?". A term without evidence is a hypothesis, and the A/B test checks it. It also **suggests** merging near-identical styles into one product with colour and size variants (always a suggestion, even on Auto, because it changes the catalogue). A/B on grandeur-store's 100 code-titled products (half optimized, half held back, 2–4 weeks). The originals are always kept, with revert | Slice 1 done 2026-10-29: dry run on 10 grandeur products (scripts/optimizer-dry-run.ts, review page in reports/), 10/10 pass code checks, $0.30. Finding: all 10 are bubu/adire gowns filed under Abaya. Slice 2 built 2026-10-30: ModelCall (every AI call, cost in micro-USD, per tenant, daily cap SCALEX_DAILY_AI_USD) + Optimization (READY/NEEDS_REVIEW/APPLIED/REJECTED/SUPERSEDED, input + proposal + what the client actually published) + API `/api/v1/optimizations` (POST, GET, :id/applied, :id/rejected). Init migration 20261030120000_init written; Migration applied 2026-10-30 (prisma.config uses DIRECT_URL, port 5432). Live round trip passed: HadronPower #510 → READY proposal, ModelCall recorded $0.026, 6.6 s, no-key → 401 |
| 0.4c | **Category + city landing pages** in MarketX (e.g. "Abaya in Ibadan, from ₦30,000"), indexable, listing all matching products. Evidence (2026-10-29): searching "abaya … Ibadan" returns Jiji's category+city page ("Abaya Women's Clothing in Ibadan, 730+ from ₦1,000") and TikTok/X vendor posts, not single product pages. Google's AI Overview already quotes MarketX's Instagram auto-posts (with "escrow-protected"), while the product page itself isn't indexed yet | **Built 2026-10-29, not deployed.** `/buy/<category>/<city>`; a page exists only with ≥3 live physical products in that city (22 today, e.g. /buy/abaya/ibadan: 105 items, from ₦19,000), otherwise 404. Sitemap section `local`. City comes from the store's `city`; stores that hide their location are excluded. **Live 2026-10-29.** Follow-up built the same day, not deployed: search understands cities ("ibadan", "abaya in ibadan" show a "Shop by place" section and city-filtered products), visible breadcrumbs (product: Abaya › Ibadan; city page: Home › Abaya › Ibadan), "by city" links on category pages, "More in <city>" links on city pages. **Multi-city stores built 2026-10-29, not deployed:** `SellerProfile.cities String[]` (migration `20261029120000_seller_cities`, Joshua runs `migrate deploy` BEFORE the code deploys), city required at store creation on web and mobile, chips editor in web settings and the mobile store-location screen, mobile "Shop by place" search, a `/buy/:category/:city` app route and the product breadcrumb. Also fixed: web store creation was silently dropping city, state and ship-from fields (the zod schema stripped them) |
| 0.4d | **Optimizer in the add-product flow** (Joshua, 2026-10-29): seller uploads photos + rough title/price, MarketX calls ScaleX `POST /v1/listings/proposals`, seller sees the proposed title/category/description/occasions and answers the missing questions inline, then publishes. ScaleX down or slow = the normal form (loose coupling). Same API for web and mobile and for third-party clients. Prompt @2 adds occasions ("who and where": owambe, wedding guest, church) because the goal is the sale. Needs slice 2 (ScaleX DB, every proposal recorded) first | Planned. Prompt @3 (any product type, "uses" not "occasions", tap-to-answer questions, max 4) tested 2026-10-29 on 3 grandeur + 3 HadronPower: 6/6 pass, ~$0.03 per product. Billing later: ScaleX stays a separate service and records cost per tenant (slice 2)  Web built 2026-10-31: MarketX /api/ai/listing-proposal (+ /:id/applied) → ScaleX; create.vue auto-runs after upload, tap-chip questions, "Use my own text" undo, falls back to the normal form on 503/429. Specs added 2026-11-01 (prompt @4): label/value facts → MarketX Products.specs (migration 20261101120000_product_specs) → product page Specifications; tested on itel IESS-1K20N, 10 specs all traceable to the seller text, $0.039. Deployed 2026-11-01: https://scalex-flame.vercel.app (Vercel Hobby, dub1; move to Railway or Vercel Pro before real seller traffic, Hobby is non-commercial). Live proposal passed 8.5 s. Mobile built 2026-10-31 (marketx_mobile product_editor_screen: auto-runs after first photo, tap chips, undo, quiet fallback). **Never "done": the optimizer improves continuously** (prompt versions, newer models, learning from applied-vs-proposed); clients only render the proposal, so improvements ship from ScaleX with no client release.|
| 0.5 | Automatic "confirm your listing" prompt to sellers (in-app + email) | After 0.4 |
| 0.6 | Baseline from Search Console and Merchant Center, reported separately (read-only script, no DB) | **Manual baseline 2026-11-01 (from screenshots):** 3 months = 13 clicks, 353 impressions, avg position 25; clicks are all brand (marketx login/sign up); "market x" 106 imp is mostly a crypto exchange of the same name (do not chase); only product demand = Antimony ore (~51 imp, 0 clicks). Index: 27 indexed / 253 not (238 "Discovered, not indexed" = low site authority, pages are fine: SSR, 0.7 s, canonical ok). Joshua fixed crawling 2026-11-01. **Decision: hold the paid optimizer backfill until products get indexed; 40-product test after.** **Merchant Center 2026-11-01:** 183/183 approved, quality Great, 10 clicks in 28 days (+400%): Shopping free listings are the ONLY channel bringing product clicks (Search clicks are all brand). So listing info pays off first in the feed: MarketX feed now sends g:brand + g:mpn (+ color, material) from Products.specs when brand AND model exist (was identifier_exists=no for all). Test target: HadronPower branded appliances, measured per product in MC. Sitemaps: index read 2026-10-24 (252), local.xml read 2026-10-31 (22), both Success. **HadronPower test 2026-11-04:** price-matched random split (seed 20261104) of 38 live products, 19 test / 19 control (#382 digital excluded). Proposals via live ScaleX: 19/19, 17 with brand+model. Plan: write specs ONLY (not titles) to test group after Joshua OKs, measure MC + GSC per product for 3-4 weeks vs control. Found: checkProposal stock-code regex false positives on "LG 205L", "FHD 32" (brand+number read as a stock code), fix pending; flags caught real model-number mismatches between titles and descriptions (#453, #454, #455). **Delivery built 2026-11-04 (Joshua: observations go to the seller; good ones applied; ONE batched in-app + email per seller):** MarketX POST /api/internal/optimizations/deliver (Bearer SCALEX_INBOUND_KEY = ScaleX MARKETX_INBOUND_KEY), scalex scripts/deliver-optimizations.ts (dry run default, --apply). Run payload reports/deliver-hadronpower-2026-11-04.json: 11 improved, 8 to check. Prompt @5: flags addressed to the seller. Automated weekly tracking needs the service account key. |
| 1.x | First matched-demand test; see `PLAN.md` Phase 1. Category/city **not chosen yet** (Lagos appliances via HadronPower is a hypothesis) | After Phase 0 exit test |

Known facts so far:
- Search Console: `sc-domain:marketx.africa` is verified (added 2026-09-07) and linked to
  Merchant Center 5842698553. Queries are almost all brand; the only product query is
  "antimony" (47 impressions, 0 clicks), which lands on MarketX product #366 "Antimony ore"
  (OkoroSamuel store, ₦2,000,000, no unit, collector-style description, wrongly flagged
  thrift/accessory/deal).
- **Team accounts (exclude from every MarketX metric; confirmed by Joshua 2026-10-29):**
  user_255745, makintechsubscriptio, opesko, opeyemimakinde, akstar, grandeur1, joshbj,
  joshuaakibu, obedjoseph, user_243777. Their stores (e.g. grandeur-store) are team stores too.
- **Real orders ever: 0.** All 20 orders (#229 to #253) are team tests. No outside buyer has
  ever reached checkout, so there is no conversion data at all: the problem is entirely
  getting real buyers to the shop.
- The team's 6 paid orders went through to DELIVERED (one with escrow released), so the
  payment path has worked. The last one was on 2026-09-30, **before** the buyer-pays-Paystack-fee
  setting changed in October. Joshua re-tested with a real purchase on 2026-10-29: it works.
- **Seller consent (MarketX):** Joshua knows the current sellers personally and gives
  permission for them (2026-10-29), so MarketX's current sellers default to **Auto**. Joshua
  may send each seller a summary of what changed afterwards. The consent API stays, because
  other clients' sellers won't be known.
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
10. **Clients, not couplings.** MarketX is tenant one, not a special case. ScaleX never reads
    or writes a client's database; clients connect through the public API (catalogue feed in,
    proposals out, client applies and reports back, outcomes in) using opaque refs. Client
    names appear only in `sources/adapters/<id>/` and `act/adapters/<id>/`. See
    `ARCHITECTURE.md` §1a.

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
