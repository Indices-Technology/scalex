/**
 * Everything the ops dashboard shows, in one read: Search Console, Merchant Center (Shopping),
 * the optimizer's own records. Read-only. Each part fails on its own, so one broken source
 * doesn't blank the page.
 */
import { prisma } from '../../../core/server/utils/db'
import { merchantReport, searchAnalytics } from '../../../sources/server/utils/google'
import { storeProductSlugs } from '../../../sources/server/utils/marketx'

const SITE = 'sc-domain:marketx.africa'
const MERCHANT = '5842698553'

/** Listing changes we're watching. ponytail: hardcoded; an Experiment table once there are more than a few. */
export const EXPERIMENTS = [
  { store: 'grandeur-store', label: 'Grandeur: 105 titles rewritten ("Abaya gown, …")', changedOn: '2026-11-12' },
]

export type Day = { date: string; clicks: number; impressions: number; position?: number }
type Part<T> = ({ ok: true } & T) | { ok: false; error: string }

const iso = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (s: string, n: number) => iso(new Date(Date.parse(s) + n * 864e5))

export function totals(rows: { clicks: number; impressions: number; position?: number }[]) {
  const clicks = rows.reduce((a, r) => a + r.clicks, 0)
  const impressions = rows.reduce((a, r) => a + r.impressions, 0)
  const weighted = rows.reduce((a, r) => a + (r.position ?? 0) * r.impressions, 0)
  return { clicks, impressions, position: impressions ? weighted / impressions : null }
}

/** One row per day from..to, zeros where the source had nothing. */
export function fillDays(from: string, to: string, rows: Day[]): Day[] {
  const by = new Map(rows.map((r) => [r.date, r]))
  const out: Day[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(by.get(d) ?? { date: d, clicks: 0, impressions: 0 })
  return out
}

const part = <T extends object>(p: Promise<T>): Promise<Part<T>> =>
  p.then((v) => ({ ok: true as const, ...v })).catch((e: Error) => ({ ok: false as const, error: e.message }))

async function search(start: string, end: string, curFrom: string) {
  const [daily, queries, pages] = await Promise.all([
    searchAnalytics(SITE, { startDate: start, endDate: end, dimensions: ['date'], rowLimit: 1000 }),
    searchAnalytics(SITE, { startDate: curFrom, endDate: end, dimensions: ['query'], rowLimit: 15 }),
    searchAnalytics(SITE, { startDate: curFrom, endDate: end, dimensions: ['page'], rowLimit: 15 }),
  ])
  const strip = (r: (typeof daily)[number]) => ({ key: r.keys[0]!, clicks: r.clicks, impressions: r.impressions, position: r.position })
  return {
    daily: fillDays(
      start,
      end,
      daily.map((r) => ({ date: r.keys[0]!, clicks: r.clicks, impressions: r.impressions, position: r.position })),
    ),
    topQueries: queries.map(strip),
    topPages: pages.map(strip),
  }
}

/** Before/after on a store's product pages: the 28 days before the change vs every day since. */
async function experiments(end: string) {
  const from = addDays(EXPERIMENTS.map((e) => e.changedOn).sort()[0]!, -28)
  const rows = await searchAnalytics(SITE, {
    startDate: from,
    endDate: end,
    dimensions: ['page', 'date'],
    dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: '/product/' }] }],
    rowLimit: 25000,
  })
  const list = await Promise.all(
    EXPERIMENTS.map(async (e) => {
      const slugs = new Set(await storeProductSlugs(e.store))
      const mine = rows.filter((r) => slugs.has(r.keys[0]!.match(/\/product\/([^/?#]+)/)?.[1] ?? ''))
      const window = (a: string, b: string) => ({
        days: Math.max(0, (Date.parse(b) - Date.parse(a)) / 864e5 + 1),
        ...totals(mine.filter((r) => r.keys[1]! >= a && r.keys[1]! <= b)),
      })
      return {
        ...e,
        products: slugs.size,
        before: window(addDays(e.changedOn, -28), addDays(e.changedOn, -1)),
        after: window(e.changedOn, end),
      }
    }),
  )
  return { list }
}

const num = (v: unknown) => Number(v ?? 0)
const mcDate = (d: { year: number; month: number; day: number }) =>
  `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`

async function shopping(start: string, end: string, curFrom: string) {
  const [daily, top] = await Promise.all([
    merchantReport(MERCHANT, `SELECT date, clicks, impressions FROM product_performance_view WHERE date BETWEEN '${start}' AND '${end}'`),
    merchantReport(
      MERCHANT,
      `SELECT offer_id, title, clicks, impressions FROM product_performance_view WHERE date BETWEEN '${curFrom}' AND '${end}' ORDER BY clicks DESC LIMIT 15`,
    ),
  ])
  const v = (r: any) => r.productPerformanceView ?? {}
  return {
    daily: fillDays(
      start,
      end,
      daily.map((r) => ({ date: mcDate(v(r).date), clicks: num(v(r).clicks), impressions: num(v(r).impressions) })),
    ),
    topProducts: top.map((r) => ({
      key: `${v(r).title ?? ''} (${v(r).offerId ?? ''})`,
      clicks: num(v(r).clicks),
      impressions: num(v(r).impressions),
    })),
  }
}

async function optimizer(now: Date) {
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  const [byStatus, month, day] = await Promise.all([
    prisma.optimization.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.modelCall.aggregate({
      where: { createdAt: { gte: new Date(now.getTime() - 30 * 864e5) } },
      _sum: { costMicros: true },
      _count: { _all: true },
    }),
    prisma.modelCall.aggregate({ where: { createdAt: { gte: today } }, _sum: { costMicros: true } }),
  ])
  return {
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<string, number>,
    calls30d: month._count._all,
    spend30dUsd: (month._sum.costMicros ?? 0) / 1e6,
    spendTodayUsd: (day._sum.costMicros ?? 0) / 1e6,
    dailyCapUsd: Number(process.env.SCALEX_DAILY_AI_USD) || 5,
  }
}

export async function buildMetrics(now = new Date()) {
  // Search Console has nothing for today and runs ~2-3 days behind; yesterday is the honest end.
  const end = addDays(iso(now), -1)
  const start = addDays(end, -89)
  const curFrom = addDays(end, -27)
  const [search_, experiments_, shopping_, optimizer_] = await Promise.all([
    part(search(start, end, curFrom)),
    part(experiments(end)),
    part(shopping(start, end, curFrom)),
    part(optimizer(now)),
  ])
  return {
    generatedAt: now.toISOString(),
    range: { start, end, curFrom, prevFrom: addDays(end, -55), prevTo: addDays(end, -28) },
    search: search_,
    experiments: experiments_,
    shopping: shopping_,
    optimizer: optimizer_,
  }
}
export type Metrics = Awaited<ReturnType<typeof buildMetrics>>
