# ScaleX Thinker: source-access table (Step 0, item 1)

**Status:** Draft · **Checked:** 2026-10-28 · **Owner:** Joshua

Goal of the Thinker's first loop: **find what people in Nigeria want, then find who sells it**,
so sellers arrive at MarketX with demand already in hand. MarketX's own data is not a source yet
(no organic sales); it becomes one later.

Every source here was checked against its current terms on the date above. Terms change:
re-check before building a connector, and record the date in the connector.

## Verdicts

- **Ready**: lawful for commercial use, automatable, we can start now.
- **Needs approval**: lawful, but needs an application, a contract or a paid account first.
- **Risky**: possible, but a clause needs a closer read (or legal advice) before we rely on it.
- **No**: forbidden, academic-only, or blocked. Do not build.

## Demand: what people want

| Source | What it gives | Access and cost | Terms (key clause) | Verdict |
|---|---|---|---|---|
| **Google Search Console API** | Real queries people typed that showed or clicked a MarketX page, per page, country and device. | Free. Needs the domain verified in Search Console. Not wired in MarketX yet. | Our own site's data. | **Ready.** Demand that is already reachable (see ENGINE.md §1). |
| **Google Ads Keyword Planner** (via Google Ads API) | Monthly search volume per keyword, per country and state, plus related keywords. What Nigerians actually type into Google. | Google Ads account with billing on; developer token at **Basic** access (Explorer cannot call keyword ideas). Up to 15,000 operations a day. No per-call fee. | Allowed use is tied to the Google Ads API policy. Check the policy for internal-only tools before applying. | **Needs approval.** The strongest demand source. Apply first. |
| **Google Trends API** (alpha) | Relative interest over time, by region and sub-region, for about 5 years. | Allowlisted alpha, by application. No public pricing. Interface may change. | Alpha terms. Unofficial scrapers (pytrends etc.) are out. | **Needs approval.** Apply now; don't depend on it. |
| **X (Twitter) API**, pay-per-use | Real-time posts: "where can I buy...", complaints, price talk. Nigerian X is very active. | About $0.005 per post read; search covers the last 7 days only. 20,000 posts a month is roughly $100. | Paid developer terms. Commercial use allowed. | **Ready (paid).** The best real-time source. Start with a small budget. |
| **YouTube Data API** | Comments on Nigerian product, review and unboxing videos. | Free, 10,000 quota units a day (a search costs 100). | Developer Policies III.E.2.a: *"Do not aggregate API Data"* except across channels with the same content owner. III.E.2: no using API data to gain insights into YouTube's business. III.E.4: delete or refresh stored data within 30 days. | **Risky.** Pooling comments across many channels into demand counts looks like the aggregation that III.E.2.a forbids. Get a reading before building. |
| **Nairaland** | Nigeria's largest forum. Years of "where can I buy X in Lagos" threads. | No API. robots.txt allows most paths (blocks /login, /newpost and a few others). | The terms page returns 403 to automated fetches, so it hasn't been read yet. **Read it in a browser before anything else.** | **Risky** until the terms are read. If they allow it: polite crawl, delay between requests, public boards only. |
| **Reddit** | r/Nigeria, r/lagos. Small but candid. | Approval needed for **any** API access since Nov 2025. Commercial use needs a separate agreement; pricing isn't published. | Data API Terms: no deriving revenue without Reddit's written approval. | **Needs approval.** Low priority: small Nigerian audience. |
| **Telegram public channels** | Buy/sell and deals channels. | MTProto API. | Bot developer terms forbid *"data collection aimed at creating large datasets, machine learning models and AI products, such as scraping public group or channel contents."* | **No.** |
| **TikTok Research API, Meta Content Library** | | Academic and non-profit research only. | Not usable for a commercial pilot. | **No.** |
| **Private WhatsApp and Facebook groups** | | | Covert collection. The brief forbids it, and so do we. | **No.** |

## Supply: who sells it

| Source | What it gives | Access and cost | Terms (key clause) | Verdict |
|---|---|---|---|---|
| **Google Places API** | Shops by category and area: name, phone, website, rating, open or closed. | Pay per call, with a monthly free allowance. | Maps Platform Terms 3.2.3(a) **No Scraping**; 3.2.3(b) **No Caching** beyond the exceptions. Places policies: `place_id` may be stored **indefinitely**; other content may not be pre-fetched, cached or stored beyond the allowed exceptions. Google has suspended projects for "building databases". | **Risky** as a source of stored leads. Safe pattern: store only `place_id` plus our own notes, and fetch details live when a person is about to contact the shop. |
| **Instagram hashtag search** (Graph API, our Business account) | Recent public posts for a hashtag (for example #abujavendor), mostly sellers advertising. | 30 unique hashtags per rolling 7 days, per account. 50 results per page. Promoted posts excluded. | Meta Platform Terms apply. App Review is needed for the hashtag-search permission. Caption fields not yet confirmed. | **Needs approval.** Useful supply signal; tight quota. |
| **Jiji, Jumia** | Listings and prices. | No public API. Both return 403 to automated fetches. | Scraping marketplaces is exactly what we said we won't do. | **No.** Jumia affiliate feeds would need a partnership. |

## Context: prices and events

| Source | What it gives | Access and cost | Terms | Verdict |
|---|---|---|---|---|
| **GDELT** | Global news events and themes, filterable to Nigeria, every 15 minutes. | Free (bulk files, BigQuery). | *"available for unlimited and unrestricted use for any academic, commercial, or governmental use,"* with a citation and link back. | **Ready.** Context (fuel, floods, policy), not demand. |
| **NBS Selected Food Price Watch** | Monthly average prices per state for staple items. | Free. PDFs only, so we parse them. Latest confirmed: Dec 2024; newer editions not yet checked. | Public statistics. | **Ready.** Price baseline. |
| **Nigerian news RSS** (Punch, Vanguard, Premium Times, etc.) | Headlines in real time. | Free RSS feeds. | Store headline, link and date only, not full articles. | **Ready.** |

## Data people give us (consent-based, and the most trustworthy)

| Source | What it gives | Notes | Verdict |
|---|---|---|---|
| **"Tell us what you're looking for" line** (WhatsApp click-to-chat, web form) | Direct requests: item, budget, city. | Inbound only: the person messages us first, so WhatsApp's rules are respected. The cleanest demand signal there is. | **Ready.** |
| **Seller and chairman reports** (Square officers, market walks) | What's selling, what's short, prices. | Opt-in, attributed to whoever reported it. | **Ready.** |
| **MarketX** (searches, requests, orders) | | Not useful until there's traffic. Log searches now so history builds up. | **Later.** |

## What counts as "real" (draft rule)

One source alone is a **lead to investigate**, never a finding. A demand signal becomes an
**assessment** only when at least two *independent* kinds of evidence agree. For example:

1. **Search** (Keyword Planner or Trends) shows volume or growth, **and**
2. **Talk** (X, Nairaland or inbound requests) shows people asking where to buy it, **and/or**
3. **Supply** (Places or Instagram) shows few sellers, or sellers far from the demand.

Reposts, quotes and copied posts count once. The final test is commercial: a seller we bring in
lists the item and **sells it**. That outcome is what the Thinker is eventually scored against.

## Next actions

| # | Action | Who | Cost |
|---|---|---|---|
| 1 | Apply for Google Ads API Basic access (needs a Google Ads account with billing on). | Joshua | Free to apply |
| 2 | Apply for the Google Trends API alpha. | Joshua | Free |
| 3 | Read Nairaland's terms in a browser and record the verdict here. | Joshua | 10 min |
| 4 | Create an X developer account on pay-per-use, with a spending cap. | Joshua | ~$50–100 to start |
| 5 | Decide on YouTube III.E.2.a: drop it, or get a reading. | Joshua | |
| 6 | Build the first collectors: X search, GDELT and the inbound request line, all feeding one evidence store (Step 0, item 2). | Claude | |
