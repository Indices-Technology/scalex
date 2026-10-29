# ScaleX engine: product in, sale out

**Status:** Draft · **Written:** 2026-10-29 · **Owner:** Joshua

ScaleX exists to scale businesses. A seller uploads a product; ScaleX understands it, finds the
people who want it, puts it in front of them through channels we are allowed to use, and learns
from what sold. That should beat paying for broad ads.

```
product ─▶ UNDERSTAND ─▶ MATCH to demand ─▶ ACT on a reachable channel ─▶ OUTCOME ─▶ LEARN
            (Thinker)      (Thinker)            (Doer)                   (measured)   │
                ▲                                                                       │
                └───────────────────────────────────────────────────────────────────────┘
```

## 1. The rule that picks our sources

A demand signal is only worth collecting if **we can act on it**. Knowing that "Jos wants
inverters" without a way to reach those people is research, not distribution. So every demand
source is scored on two things: how strong the evidence is, and whether it has a reach path.

| Demand source | Evidence | Reach path | Notes |
|---|---|---|---|
| **Google search** (Merchant Center free listings, indexed product pages, Search Console) | Someone typed the need | **Same channel.** The search result *is* the reach | The one place where demand and distribution are the same thing. MarketX already has Merchant Center (5842698553). Search Console is not wired yet. |
| **Inbound requests** ("tell us what you're looking for") | Stated need, budget, city | **Direct.** They messaged us first | Strongest signal per item; small volume at first. |
| **Opt-in buyer alerts** (saved searches, price drop, back in stock) | Past interest | **Direct**, with consent | MarketX already has price-drop and back-in-stock alerts. |
| **Seller's own audience** (FB, IG pages via auto-publish) | Weak | **Seller-authorised** | Already built in MarketX growth. |
| Keyword Planner, Trends | Volume, by state | None by itself | Tells us *what to stock and where*, then search reaches it. |
| X posts | Specific asks | Weak: automated replies to strangers break X's automation rules | Evidence only, plus manual replies. |
| News, prices (GDELT, NBS) | Context | None | Explains changes; never demand on its own. |

## 2. Data shapes (v0)

```
Product      id, tenant, title, category, attrs{}, price, city, deliversTo[], stockCheckedAt, sellerTrust
DemandSignal id, source, text, category, attrs{}, city, budget?, observedAt, intent (BROWSE|COMPARE|BUY),
             reach (SEARCH|DIRECT|ALERT|NONE), evidenceUrl, dedupeKey
Match        productId, signalId | segment, score, reasons[]
Action       matchId, channel, variant, startedAt, cost
Outcome      actionId, stage (IMPRESSION|CLICK|ENQUIRY|ORDER|COMPLETED), at
```

- **Understand** = turn a product into `category + attrs` (an LLM tagger, checked against a
  labelled set). The same tagger reads demand text, so both sides speak one vocabulary.
- **Match score** v0 = category fit × attribute fit × location fit × price-in-budget ×
  recency × intent. Plain weights, logged with `reasons[]` so every match is explainable.
- **Learn** v0 = re-weight from `Outcome` counts per channel and category. No model training.

## 3. Proving it beats ads

Every product gets a **baseline**: what happens with the seller's normal posting. Where we can,
hold back a share of matched products from a channel and compare. The headline number is
**completed sales per product listed**, by channel, against that baseline.

## 4. First build, in order

1. Search Console API: real queries that already show MarketX pages, per page. Free, no approval.
   This is our first demand data and it is already reachable.
2. Product tagger + `Product` sync from MarketX (catalogue via the Commerce API).
3. Request line + `DemandSignal` store; match requests to products; notify buyer and seller.
4. Merchant Center feed health: which products are disapproved or invisible, and fix them.
5. Outcome tracking from MarketX order events; the weekly "matches to sales" report.

Keyword Planner, Trends and X join once approved; they feed *what to stock and where*, which
drives seller acquisition (the parked leads loop) toward proven demand.
