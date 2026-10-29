# ScaleX

ScaleX scales businesses: a seller lists a product and ScaleX gets it in front of people who
already want it (Thinker finds and weighs demand, Doer acts through permitted channels, every
step traced and measured against a baseline). MarketX is the first tenant.
Start with `CLAUDE.md`, then `docs/PLAN.md` and `docs/ARCHITECTURE.md`.

**Rule:** ScaleX never reads another app's database, and no app reads ScaleX's. They talk over
this API with a per-tenant key.

## Parked v0: the seller-acquisition loop (`layers/act`, returns in Phase 3)

```
CSV of prospective sellers ─▶ import (clean, de-duplicate, rank) ─▶ list, best first
        ▲                                                              │ contact person-to-person,
        │                                                              ▼ send their invite link
   next batch ◀── report by batch & source ◀── MarketX reports steps per invite code
                                               SIGNED_UP → STORE_CREATED → FIRST_LISTING → FIRST_ORDER
```

Judge it by **leads that reach FIRST_ORDER, per batch**, not by leads collected.

| Endpoint (all need `Authorization: Bearer <key>`) | Does |
|---|---|
| `POST /api/v1/leads/import` `{ csv, batch, source? }` | Imports a batch. Columns by name: `name` (required), `phone`, `email`, `instagram`, `city`, `category`, `notes`. Needs a name and one usable contact. Known businesses are skipped, never overwritten. |
| `GET /api/v1/leads?batch=&status=&limit=` | Leads, highest score first, with each one's `inviteCode` |
| `POST /api/v1/leads/events` `{ inviteCode, type }` | Records a step. Safe to retry; never moves a lead backwards |
| `GET /api/v1/leads/report` | Funnel counts by batch and by source |
| `GET /api/health` | Public. 200 when the database answers |

Ranking (`layers/act/server/utils/leadRules.ts`) is plain points: phone 30, Instagram 20,
email 10, target category 25, target city 15. Targets come from `SCALEX_TARGET_CATEGORIES` /
`SCALEX_TARGET_CITIES`.

## Where leads may come from

1. CSV: market walks, Square chairmen, contacts. (v0)
2. The tenant's own data: users with no store, empty stores. (`source: INTERNAL`)
3. Google Places API. Its terms limit how long most fields may be kept (30 days); plan for that.

Not allowed: scraping Instagram, Jiji or similar, and cold messages from a WhatsApp Business
number (a quality ban takes the tenant's OTP and order messages down with it). Outreach is
person-to-person or email.

## Run it

```
cp .env.example .env      # set DATABASE_URL (ScaleX's own database) and SCALEX_API_KEYS
npm install
npx prisma migrate dev    # direct, non-pooler URL
npm run dev               # http://localhost:3200
npm test
```

Example import:

```
curl -X POST localhost:3200/api/v1/leads/import \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "{\"batch\":\"oct-balogun-walk\",\"csv\":$(jq -Rs . < leads.csv)}"
```

## Layout

A Nuxt app split into layers (same as MarketX and Posta). A layer may use only layers with a
lower rank; `tests/layering.spec.ts` fails otherwise. Full design: `docs/ARCHITECTURE.md`.

| Rank | Layer | Owns | State |
|---|---|---|---|
| 1 | `core` | ids, tenant, request ids, API-key auth, error envelope, db, logger, health | Built |
| 2 | `sources` | source adapter contract, registry, runtime, `adapters/<id>/` | Empty |
| 3 | `evidence` | canonical evidence, provenance, dedupe, freshness | Empty |
| 3 | `outcomes` | experiments, attribution, KPI queries | Empty |
| 4 | `think` | demand assessor, product tagger, matcher | Empty |
| 5 | `decide` | economics, policy gate, budgets, approvals, kill switches | Empty |
| 6 | `act` | action adapters; holds the parked v0 leads loop | Leads built |
| 7 | `ops` | read API, admin page, weekly report, switches | Empty |
