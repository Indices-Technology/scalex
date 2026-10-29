# ScaleX plan

**Status:** Draft for Joshua's approval · **Written:** 2026-10-29

## 1. What ScaleX is for

ScaleX scales businesses. A seller lists a product and ScaleX gets it in front of people who
already want it, so it sells without the seller buying broad ads or becoming a marketer.

It has two halves that work as one loop:

- **Thinker**: understands products, finds and weighs demand, separates signal from noise,
  keeps the evidence behind every conclusion.
- **Doer**: acts on a match through a channel we are allowed to use, then records what happened.

```
DEMAND (outside MarketX) ─┐
                          ├─▶ MATCH ─▶ REACH (permitted channel) ─▶ OUTCOME ─▶ LEARN ─┐
SUPPLY (sellers)        ──┘                                                             │
        ▲                                                                               │
        └────────────────────── better matches, better sellers ◀──────────────────────┘
```

## 2. Where we stand (2026-10-29)

- MarketX has supply but no organic sales, and almost no search traffic. Search Console shows
  mostly brand queries; the one product query (antimony, 47 impressions) gets 0 clicks.
- So ScaleX cannot lean on MarketX's own traffic. It has to find demand outside and bring it in.
- Sellers won't stay without sales. **The first job is one proven sale loop**, not a big
  intelligence platform.
- Joshua does not contact sellers directly. Every step must work through the product itself
  (notifications, email, forms) or not need the seller at all.

## 3. Design rules

1. **Reachable demand first.** Collect a demand signal only if there is a permitted way to act on
   it, and record which way. Track *share of found demand we could reach*.
2. **Evidence, not volume.** One source is a lead; two independent kinds agreeing is an
   assessment; a completed sale is proof. Reposts count once.
3. **Always a baseline.** Every intervention is compared with doing nothing.
4. **Permitted sources only.** See `SOURCES.md`. No scraping of IG, Jiji, Jumia, Telegram; no
   private groups; no cold WhatsApp Business sends.
5. **No person in the loop by design.** If a step needs Joshua to message someone, it does not
   scale; automate it or drop it.
6. **Spend follows proof.** Paid sources and bigger budgets only after a phase shows sales.

## 4. Phases

Each phase has an exit test. If it fails, we stop and learn before spending more.

### Phase 0: Prove the shop can sell, then fix the shop window (weeks 1–2, free)

Paid traffic to a shop that cannot complete a sale only finds the next broken step at our
expense. So the purchase path is verified before anything else.

| # | Task | Who |
|---|---|---|
| 0.1 | **Purchase journey test** on production, with a real low-price product: browse → pay (Paystack, fee added for the buyer) → order created → seller notified → dispatch → escrow release. Note every step that needed a human. | Joshua pays, Claude checks DB and logs |
| 0.2 | Check that paid, failed and abandoned payments are told apart correctly in the data, and that team test orders can be excluded. | Claude (read-only) |
| 0.3 | Read-only audit of all published products: indexed by Google? valid in Merchant Center? price, unit, location, delivery shown? contradictory flags (antimony ore marked thrift/accessory/deal)? filler descriptions? stock last confirmed? | Claude |
| 0.4 | Platform-side fixes in MarketX code: search title and snippet from real fields (name, price, state, store), correct product data for Google, flag rules. Seller content untouched. | Claude, Joshua approves |
| 0.5 | Automatic "confirm your listing" prompt to sellers (in-app + email): confirm stock, price, delivery area, and add the facts buyers search on. Sellers who answer become test candidates; that also measures responsiveness without Joshua messaging anyone. | Claude |
| 0.6 | Baseline from Search Console (it keeps 16 months, so nothing needs collecting first) and Merchant Center, **reported separately**. | Claude (read-only script, no ScaleX database yet) |

**Exit test:** at least one product has a verified purchase journey with no manual step,
confirmed stock and a seller who responded; the baseline is written down.

### Phase 1: First matched-demand test (weeks 3–5, capped budget)

One category, one city, existing supply, paid search as the reach. **Nothing is chosen until
Phase 0 and the Keyword Planner check are done.**

| # | Task | Who |
|---|---|---|
| 1.1 | Score candidate category and city pairs on four things: **demand** (Keyword Planner volume in that state), **competitiveness** (our price against what the same search shows), **supply** (stock confirmed, seller responsive from 0.5), **conversion** (product passed 0.1). Appliances (HadronPower) in Lagos is the starting hypothesis, not the decision. | Claude scores, Joshua decides |
| 1.2 | Write the unit economics per product before spending (see §4a) and set stop rules. | Claude drafts, Joshua approves |
| 1.3 | Match each search term to the product that answers it. Each match records: the demand signal, the product and why it fits, evidence strength, the channel, the action taken, and the outcome. | Claude (ScaleX `Match`) |
| 1.4 | Landing page per matched product: price, delivery to the city, escrow protection, one clear buy or enquire action, tagged with a campaign id. | Claude (MarketX) |
| 1.5 | Paid search on matched terms only, **after** the baseline period, not overlapping it. Start with a first tranche (₦20,000) and spend the rest only if the stop rules allow. | Joshua sets budget |
| 1.6 | Count only what can be traced: campaign id → landing page → enquiry → **payment-confirmed** order → completed sale. A sale is not ScaleX's just because it happened after launch. | ScaleX `Outcome` |

**Stop rules (per tranche):** clicks but no enquiries → fix the offer or page, don't add spend.
Enquiries but no orders → check trust, price, payment, delivery. Cost per sale above the limit
in §4a → stop.

**Exit test:** at least one traced, completed sale from matched demand, at a cost per sale
inside the §4a limit. If none, name the failing stage (discovery, conversion or supply), fix
that one thing, and rerun once.

### 4a. Unit economics (must be written before any spend)

MarketX keeps **2%** of the sale. Product cost belongs to the seller. So for each test product:

- **MarketX's margin per sale** = 2% × price. A ₦300,000 fridge earns MarketX ₦6,000.
- **Seller's margin per sale** = price − their cost − delivery they absorb − other costs (ask
  in the 0.5 prompt; leave blank if they won't say).
- If MarketX pays for the ads, a cost per sale above its 2% is a **paid experiment**, not a
  repeatable loop. That is acceptable for the first test, but it must be said out loud, and
  the long-term answer is either sellers pay for matched traffic or the fee covers it.

### Phase 2: Demand intelligence beyond search (weeks 4–8)

Only once Phase 1 shows the loop can sell.

- Connect the approved sources: Keyword Planner API, Trends API, X search (spend-capped).
- Demand store with provenance, intent level (browse, compare, buy), location, recency,
  and reach path. De-duplication of copied posts.
- Product tagger: one vocabulary for products and demand (category plus attributes).
- Labelled test set (~200 Nigerian posts) to measure how well we tell real requests from noise.
- Weekly report: top unmet demand by state, with evidence and confidence.

**Exit test:** the report names demand we did not already know, and at least one item is
confirmed by a second independent source.

### Phase 3: Supply follows demand (weeks 8–12)

Use proven demand to bring in the sellers who can fill it, without Joshua messaging anyone.

- Demand-led seller acquisition: the parked leads loop, now aimed at categories with proven
  demand. Sellers arrive to "people in your city are searching for this, here are the numbers".
- Request line and buyer alerts: buyers state a need; matching sellers are notified in-app.
- Seller's own channels: auto-publish matched products to their connected pages.

**Exit test:** a seller recruited through demand data makes a sale within 30 days.

### Phase 4: Scale and productise (after week 12)

- Second category, second city; the learn step re-weights matching from outcomes.
- ScaleX as a service to other Indices apps and outside businesses (API per tenant).
- Revisit the larger Thinker programme (world model, forecasting) with real outcome data to
  score it against.

## 5. What is built, what is parked

| Item | State |
|---|---|
| `scalex` repo, API keys per tenant, `leads` layer (import, rank, invite codes, funnel) | Built, no database yet. Parked until Phase 3. |
| `docs/SOURCES.md` (terms checked 2026-10-28) | Done |
| `docs/ENGINE.md` (data shapes, match score, baseline) | Done |
| ScaleX Neon database | Not created, and not needed until Phase 1 (`Match`, `Outcome`). Phase 0 runs as read-only scripts. |

## 5a. Kept separate on purpose

**MarketX as a content source** (useful trends, news, social posts that build an audience) is a
different question: *can MarketX build attention that turns into visits and sales?* It runs
after Phase 1 is instrumented, or as a small organic-only test with its own tracking, so the
two experiments don't blur each other's results.

## 6. Costs (first 4 weeks)

| Item | Cost |
|---|---|
| Search Console, Merchant Center, GDELT, Keyword Planner UI | Free |
| Phase 1 search ads | ₦50,000–100,000 total, capped |
| X API (Phase 2, optional) | ~$50–100/month, capped |
| Neon database for ScaleX | Free tier to start |

## 7. Joshua's actions

| # | Action | Needed for |
|---|---|---|
| 1 | Create the Google Ads account (billing on); this also unlocks Keyword Planner | Phase 1, API application |
| 2 | Apply for Google Ads API Basic access and the Trends API alpha | Phase 2 |
| 3 | Search Console: add a service account as a Restricted user; save key to `scalex/.secrets/gsc.json` | 0.6 |
| 4 | Run the real purchase test (0.1) | Phase 0 |
| 5 | Create the ScaleX Neon database | Phase 1 only |
| 6 | Approve category, city, unit economics and budget tranches | Phase 1 |
| 7 | Read Nairaland's terms in a browser | Phase 2 |

## 8. Risks

| Risk | What we do |
|---|---|
| Matched traffic clicks but does not buy | Phase 1 separates discovery from conversion; fix the page or price before more spend |
| HadronPower prices are not competitive | Compare against search results during 1.2; pick products where we are in range |
| Search demand is small in the chosen city | Keyword Planner check before any spend; switch city or category |
| Paid search becomes "just ads" | Ads only on matched terms, judged on cost per completed sale against baseline |
| Scope creep into the big Thinker | Phase gates: nothing in Phase 2 starts before Phase 1's exit test |
| Competes with Axioms, Eigen and the MSc | Phases 0–1 are small; Phase 2 waits on proof |
