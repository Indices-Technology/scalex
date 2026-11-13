<script setup lang="ts">
import type { Metrics } from '../../server/utils/metrics'

useHead({ title: 'ScaleX dashboard', meta: [{ name: 'robots', content: 'noindex' }] })

// Client-side only: the browser holds the Basic-auth sign-in, so it fetches with it.
const { data, pending, error, refresh } = useFetch<{ data: Metrics }>('/api/ops/metrics', { server: false })
const m = computed(() => data.value?.data)

const n = (v: number | null | undefined, d = 0) =>
  v === null || v === undefined ? '–' : v.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d })
const usd = (v: number) => `$${v.toFixed(2)}`
const fmtDate = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function sumRange(days: { date: string; clicks: number; impressions: number; position?: number }[], from: string, to: string) {
  const r = days.filter((d) => d.date >= from && d.date <= to)
  const clicks = r.reduce((a, d) => a + d.clicks, 0)
  const impressions = r.reduce((a, d) => a + d.impressions, 0)
  const pw = r.reduce((a, d) => a + (d.position ?? 0) * d.impressions, 0)
  return { clicks, impressions, position: impressions ? pw / impressions : null }
}
function change(cur: number, prev: number) {
  if (!prev) return cur ? 'new' : 'no change'
  const p = Math.round(((cur - prev) / prev) * 100)
  return `${p > 0 ? '+' : ''}${p}%`
}

const search = computed(() => {
  const s = m.value?.search
  if (!s?.ok || !m.value) return null
  const r = m.value.range
  return { cur: sumRange(s.daily, r.curFrom, r.end), prev: sumRange(s.daily, r.prevFrom, r.prevTo) }
})
const shopping = computed(() => {
  const s = m.value?.shopping
  if (!s?.ok || !m.value) return null
  const r = m.value.range
  return { cur: sumRange(s.daily, r.curFrom, r.end), prev: sumRange(s.daily, r.prevFrom, r.prevTo) }
})
const markers = computed(() =>
  m.value?.experiments.ok ? m.value.experiments.list.map((e) => ({ date: e.changedOn, label: e.store })) : [],
)
const perDay = (v: number, days: number) => (days ? n(v / days, 1) : '–')
</script>

<template>
  <main class="viz-root">
    <header>
      <div>
        <h1>ScaleX</h1>
        <p v-if="m" class="muted">
          MarketX, {{ fmtDate(m.range.start) }} to {{ fmtDate(m.range.end) }}. Google data runs 2 to 3 days behind.
        </p>
      </div>
      <button type="button" :disabled="pending" @click="refresh()">{{ pending ? 'Loading…' : 'Refresh' }}</button>
    </header>

    <p v-if="error" class="err">Could not load: {{ error.message }}</p>
    <p v-else-if="!m" class="muted">Loading…</p>

    <template v-else>
      <section class="tiles" aria-label="Last 28 days">
        <div class="tile">
          <span class="label">Google Search clicks, 28 days</span>
          <span class="value">{{ search ? n(search.cur.clicks) : '–' }}</span>
          <span class="muted">{{ search ? `${change(search.cur.clicks, search.prev.clicks)} vs previous 28 days` : 'Search Console unavailable' }}</span>
        </div>
        <div class="tile">
          <span class="label">Google Search impressions</span>
          <span class="value">{{ search ? n(search.cur.impressions) : '–' }}</span>
          <span class="muted">{{ search ? `${change(search.cur.impressions, search.prev.impressions)} · avg position ${n(search.cur.position, 1)}` : '' }}</span>
        </div>
        <div class="tile">
          <span class="label">Shopping clicks, 28 days</span>
          <span class="value">{{ shopping ? n(shopping.cur.clicks) : '–' }}</span>
          <span class="muted">{{ shopping ? `${change(shopping.cur.clicks, shopping.prev.clicks)} vs previous 28 days` : 'Merchant Center not connected yet' }}</span>
        </div>
        <div class="tile">
          <span class="label">AI spend, 30 days</span>
          <span class="value">{{ m.optimizer.ok ? usd(m.optimizer.spend30dUsd) : '–' }}</span>
          <span class="muted">{{ m.optimizer.ok ? `today ${usd(m.optimizer.spendTodayUsd)} of ${usd(m.optimizer.dailyCapUsd)} cap · ${m.optimizer.calls30d} calls` : '' }}</span>
        </div>
      </section>

      <section class="card">
        <h2>Google Search</h2>
        <p v-if="!m.search.ok" class="err">{{ m.search.error }}</p>
        <template v-else>
          <DailyBars title="Clicks per day" :days="m.search.daily.map((d) => ({ date: d.date, value: d.clicks }))" :markers="markers" />
          <DailyBars title="Impressions per day" :days="m.search.daily.map((d) => ({ date: d.date, value: d.impressions }))" :markers="markers" />
        </template>
      </section>

      <section class="card">
        <h2>Listing changes</h2>
        <p class="muted">Product pages from Google Search: the 28 days before the change against every day since. Read it after 2 to 4 weeks; a few days say nothing.</p>
        <p v-if="!m.experiments.ok" class="err">{{ m.experiments.error }}</p>
        <div v-else class="scroll">
          <table class="wide">
            <thead>
              <tr><th>Change</th><th>Live since</th><th class="r">Before: clicks/day</th><th class="r">impr./day</th><th class="r">After: days</th><th class="r">clicks/day</th><th class="r">impr./day</th></tr>
            </thead>
            <tbody>
              <tr v-for="e in m.experiments.list" :key="e.store">
                <td>{{ e.label }}<br /><span class="muted">{{ e.products }} products</span></td>
                <td>{{ fmtDate(e.changedOn) }}</td>
                <td class="r">{{ perDay(e.before.clicks, e.before.days) }}</td>
                <td class="r">{{ perDay(e.before.impressions, e.before.days) }}</td>
                <td class="r">{{ e.after.days }}</td>
                <td class="r">{{ perDay(e.after.clicks, e.after.days) }}</td>
                <td class="r">{{ perDay(e.after.impressions, e.after.days) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Google Shopping (Merchant Center)</h2>
        <div v-if="!m.shopping.ok" class="notice">
          <b>Not connected yet.</b> Google needs the Cloud project registered with Merchant Center once. Give the service account Admin in Merchant Center, run
          <code>npx tsx scripts/google-check.ts register</code>, then set it back to Standard.
          <details><summary>Google's message</summary><p class="muted">{{ m.shopping.error }}</p></details>
        </div>
        <template v-else>
          <DailyBars title="Shopping clicks per day" :days="m.shopping.daily.map((d) => ({ date: d.date, value: d.clicks }))" :markers="markers" />
          <h3>Top products, 28 days</h3>
          <div class="scroll">
            <table>
              <thead><tr><th>Product</th><th class="r">Clicks</th><th class="r">Impressions</th></tr></thead>
              <tbody>
                <tr v-for="p in m.shopping.topProducts" :key="p.key"><td>{{ p.key }}</td><td class="r">{{ n(p.clicks) }}</td><td class="r">{{ n(p.impressions) }}</td></tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>

      <div v-if="m.search.ok" class="two">
        <section class="card">
          <h2>Top searches, 28 days</h2>
          <div class="scroll">
            <table>
              <thead><tr><th>Search</th><th class="r">Clicks</th><th class="r">Impr.</th><th class="r">Pos.</th></tr></thead>
              <tbody>
                <tr v-for="q in m.search.topQueries" :key="q.key"><td>{{ q.key }}</td><td class="r">{{ n(q.clicks) }}</td><td class="r">{{ n(q.impressions) }}</td><td class="r">{{ n(q.position, 1) }}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="card">
          <h2>Top pages, 28 days</h2>
          <div class="scroll">
            <table>
              <thead><tr><th>Page</th><th class="r">Clicks</th><th class="r">Impr.</th></tr></thead>
              <tbody>
                <tr v-for="p in m.search.topPages" :key="p.key">
                  <td class="url"><a :href="p.key" target="_blank" rel="noopener">{{ p.key.replace(/^https:\/\/(www\.)?marketx\.africa/, '') || '/' }}</a></td>
                  <td class="r">{{ n(p.clicks) }}</td><td class="r">{{ n(p.impressions) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section class="card">
        <h2>Optimizer</h2>
        <p v-if="!m.optimizer.ok" class="err">{{ m.optimizer.error }}</p>
        <dl v-else class="stats">
          <div v-for="(count, status) in m.optimizer.byStatus" :key="status"><dt>{{ String(status).replace('_', ' ').toLowerCase() }}</dt><dd>{{ n(count) }}</dd></div>
        </dl>
        <p class="muted">Proposals recorded through the ScaleX API. Script runs (like the Grandeur batch) count in spend but not here.</p>
      </section>
    </template>
  </main>
</template>

<style>
:root {
  color-scheme: light;
  --surface: #f6f6f4; --surface-1: #fcfcfb; --surface-raised: #ffffff;
  --text-primary: #0b0b0b; --text-secondary: #52514e; --text-muted: #77766f;
  --border: #e4e3de; --border-strong: #c9c8c1;
  --series-1: #2a78d6; --critical: #b42318;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;
    --surface: #111110; --surface-1: #1a1a19; --surface-raised: #242422;
    --text-primary: #f0efec; --text-secondary: #c3c2b7; --text-muted: #9a998f;
    --border: #2e2e2b; --border-strong: #4a4945;
    --series-1: #3987e5; --critical: #f97066;
  }
}
:root[data-theme='dark'] {
  color-scheme: dark;
  --surface: #111110; --surface-1: #1a1a19; --surface-raised: #242422;
  --text-primary: #f0efec; --text-secondary: #c3c2b7; --text-muted: #9a998f;
  --border: #2e2e2b; --border-strong: #4a4945;
  --series-1: #3987e5; --critical: #f97066;
}
body { margin: 0; background: var(--surface); color: var(--text-primary); font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; }
</style>

<style scoped>
main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 64px; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
h1 { margin: 0; font-size: 24px; }
h2 { margin: 0 0 12px; font-size: 17px; }
h3 { margin: 20px 0 8px; font-size: 15px; }
.muted { color: var(--text-secondary); font-size: 13px; margin: 4px 0 0; }
.err { color: var(--critical); }
button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface-raised); color: var(--text-primary); cursor: pointer; }
button:disabled { opacity: 0.6; cursor: default; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; }
.tile { display: flex; flex-direction: column; gap: 2px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
.label { font-size: 13px; color: var(--text-secondary); }
.value { font-size: 30px; font-weight: 650; font-variant-numeric: tabular-nums; }
.card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 16px; display: grid; gap: 20px; }
.card > h2, .card > p { margin-bottom: -12px; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
.two .card { margin-bottom: 0; align-content: start; }
.two { margin-bottom: 16px; }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
th { text-align: left; font-weight: 500; color: var(--text-secondary); font-size: 13px; padding: 6px 8px; border-bottom: 1px solid var(--border-strong); white-space: nowrap; }
td { padding: 7px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
.r { text-align: right; }
table.wide { min-width: 640px; }
.url { max-width: 360px; overflow-wrap: anywhere; }
a { color: var(--text-primary); }
.notice { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; font-size: 14px; }
code { font-size: 13px; background: var(--surface-raised); padding: 1px 5px; border-radius: 4px; border: 1px solid var(--border); }
.stats { display: flex; flex-wrap: wrap; gap: 24px; margin: 0; }
.stats dt { font-size: 13px; color: var(--text-secondary); text-transform: capitalize; }
.stats dd { margin: 0; font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
@media (max-width: 600px) { .value { font-size: 26px; } }
</style>
