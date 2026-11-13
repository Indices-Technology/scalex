/**
 * Why aren't MarketX pages indexed? Read-only. For every URL in the sitemap:
 *   - Google's verdict (Search Console URL Inspection: coverage state, last crawl)
 *   - how many clicks from the home page it takes to reach it through ordinary links, and how many
 *     pages link to it (Google mostly finds and values pages through links, not the sitemap)
 *
 *   npx tsx scripts/index-audit.ts            → reports/index-audit-<date>.{json,md}
 *
 * URL Inspection quota is 2000/day per property; this uses one call per sitemap URL.
 */
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { googleJson, SCOPE } from '../layers/sources/server/utils/google'

const SITE = 'https://marketx.africa'
const PROPERTY = 'sc-domain:marketx.africa'
const MAX_PAGES = 1500

const norm = (u: string) => {
  const url = new URL(u, SITE)
  if (url.hostname === 'www.marketx.africa') url.hostname = 'marketx.africa'
  url.hash = ''
  // Keep ?page=N: paginated listings are how deep products get linked. Drop every other parameter.
  const page = url.searchParams.get('page')
  url.search = page && page !== '1' ? `?page=${page}` : ''
  return url.href.replace(/\/(?=$|\?)/, '') || SITE
}

async function text(url: string) {
  const res = await fetch(url, { headers: { 'user-agent': 'ScaleX-index-audit' } })
  return res.ok ? res.text() : ''
}

async function sitemapUrls(): Promise<string[]> {
  const out: string[] = []
  const queue = [`${SITE}/sitemap.xml`]
  while (queue.length) {
    const xml = await text(queue.shift()!)
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]!)
    if (/<sitemapindex/.test(xml)) queue.push(...locs)
    else out.push(...locs)
  }
  return [...new Set(out.map(norm))]
}

/** Breadth-first crawl from the home page; depth = clicks from home. */
async function crawl() {
  const depth = new Map<string, number>([[norm(SITE), 0]])
  const inlinks = new Map<string, Set<string>>()
  let frontier = [norm(SITE)]
  while (frontier.length && depth.size < MAX_PAGES) {
    const next: string[] = []
    for (let i = 0; i < frontier.length; i += 6) {
      await Promise.all(
        frontier.slice(i, i + 6).map(async (from) => {
          const html = await text(from).catch(() => '')
          for (const m of html.matchAll(/href="([^"#]+)"/g)) {
            const raw = m[1]!
            if (/^(mailto:|tel:|javascript:)/.test(raw)) continue
            let to: string
            try {
              to = norm(raw)
            } catch {
              continue
            }
            if (!to.startsWith(SITE) || /\.(png|jpe?g|webp|svg|ico|css|js|xml|json|pdf)$/i.test(to) || /\/(api|_nuxt)\//.test(to)) continue
            if (!inlinks.has(to)) inlinks.set(to, new Set())
            inlinks.get(to)!.add(from)
            if (!depth.has(to) && depth.size < MAX_PAGES) {
              depth.set(to, depth.get(from)! + 1)
              next.push(to)
            }
          }
        }),
      )
    }
    frontier = next
  }
  return { depth, inlinks }
}

async function inspect(url: string) {
  try {
    const r = await googleJson(SCOPE.searchConsole, 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      inspectionUrl: url,
      siteUrl: PROPERTY,
    })
    const s = r.inspectionResult?.indexStatusResult ?? {}
    return { verdict: s.verdict as string, coverage: s.coverageState as string, lastCrawl: (s.lastCrawlTime as string) ?? null }
  } catch (e: any) {
    return { verdict: 'ERROR', coverage: e.message.slice(0, 120), lastCrawl: null }
  }
}

const kind = (u: string) => new URL(u).pathname.split('/')[1] || 'home'

const urls = await sitemapUrls()
console.log(`${urls.length} sitemap URLs; crawling…`)
const { depth, inlinks } = await crawl()
console.log(`crawled ${depth.size} pages; inspecting…`)
const rows: any[] = []
for (let i = 0; i < urls.length; i += 5) {
  rows.push(
    ...(await Promise.all(
      urls.slice(i, i + 5).map(async (url) => ({
        url,
        kind: kind(url),
        depth: depth.get(url) ?? null,
        inlinks: inlinks.get(url)?.size ?? 0,
        ...(await inspect(url)),
      })),
    )),
  )
  if (i % 50 === 0) console.log(`  ${rows.length}/${urls.length}`)
}

// Summary: per page kind, indexed vs not, and reachability.
const by = new Map<string, any[]>()
for (const r of rows) by.set(r.kind, [...(by.get(r.kind) ?? []), r])
const coverage = new Map<string, number>()
for (const r of rows) coverage.set(r.coverage, (coverage.get(r.coverage) ?? 0) + 1)
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-')
const date = new Date().toISOString().slice(0, 10)
const md = [
  `# MarketX index audit, ${date}`,
  '',
  `${rows.length} sitemap URLs. Crawl from the home page reached ${depth.size} pages.`,
  '',
  '## Google coverage',
  '',
  '| Coverage | Pages |',
  '|---|---:|',
  ...[...coverage].sort((a, b) => b[1] - a[1]).map(([c, n]) => `| ${c} | ${n} |`),
  '',
  '## By page type',
  '',
  '| Type | Pages | Indexed | Not linked from any crawled page | Median clicks from home | Median pages linking in |',
  '|---|---:|---:|---:|---:|---:|',
  ...[...by]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([k, rs]) => {
      const indexed = rs.filter((r) => r.verdict === 'PASS').length
      const orphan = rs.filter((r) => r.depth === null).length
      const ds = rs.filter((r) => r.depth !== null).map((r) => r.depth).sort((a, b) => a - b)
      const ls = rs.map((r) => r.inlinks).sort((a, b) => a - b)
      return `| ${k} | ${rs.length} | ${indexed} (${pct(indexed, rs.length)}) | ${orphan} | ${ds.length ? ds[ds.length >> 1] : '-'} | ${ls[ls.length >> 1]} |`
    }),
  '',
  '## Indexed vs not, by clicks from home',
  '',
  '| Clicks from home | Pages | Indexed |',
  '|---|---:|---:|',
  ...[...new Set(rows.map((r) => r.depth))]
    .sort((a, b) => (a ?? 99) - (b ?? 99))
    .map((d) => {
      const rs = rows.filter((r) => r.depth === d)
      const ok = rs.filter((r) => r.verdict === 'PASS').length
      return `| ${d ?? 'not linked'} | ${rs.length} | ${ok} (${pct(ok, rs.length)}) |`
    }),
].join('\n')
writeFileSync(`reports/index-audit-${date}.json`, JSON.stringify(rows, null, 2))
writeFileSync(`reports/index-audit-${date}.md`, md)
console.log(md)
process.exit(0)
