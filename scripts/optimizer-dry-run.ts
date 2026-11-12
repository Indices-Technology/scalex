/**
 * Step 0.4b, slice 1: dry run of the product optimizer. WRITES NOTHING to MarketX or any DB.
 *
 *   npx tsx scripts/optimizer-dry-run.ts [storeSlug] [count]
 *
 * Reads a store's products from MarketX's public API, asks for a listing proposal per product,
 * runs the code checks, and writes a side-by-side report to reports/ for a human to judge.
 *
 * ponytail: reads MarketX's public JSON API directly. The real catalogue input is a
 * `catalogue-feed` source adapter (ARCHITECTURE §1a); build it when the Merchant feed carries the
 * seller ref and the seller's own title (today it has neither).
 */
import 'dotenv/config'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  checkProposal,
  proposeListing,
  type CatalogueProduct,
  type ListingProposal,
} from '../layers/think/server/utils/listingProposal'

const MARKETX = 'https://marketx.africa'
const storeSlug = process.argv[2] ?? 'grandeur-store'
const count = Number(process.argv[3] ?? 10)

async function get<T>(path: string): Promise<T> {
  const res = await fetch(MARKETX + path)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  const body = (await res.json()) as { data: T }
  return body.data
}

interface ApiMedia { type: 'IMAGE' | 'VIDEO'; url: string }
interface ApiProduct {
  id: number
  slug: string
  title: string
  description: string | null
  price: number
  seller: { default_currency: string | null; store_name: string }
  media: ApiMedia[]
  category?: { category: { name: string } }[]
  localPage?: { cityName: string } | null
}

// Cloudinary serves a JPEG still for both: a resized photo, or a frame 1s into a video.
function stillUrl(m: ApiMedia): string {
  if (m.type === 'IMAGE') return m.url.replace('/image/upload/', '/image/upload/f_jpg,w_768/')
  return m.url.replace('/video/upload/', '/video/upload/so_1,w_768/').replace(/\.\w+$/, '.jpg')
}

function plain(html: string | null): string {
  return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Spread the sample across stock-code prefixes (ADR, BA, MK...) so one style doesn't dominate. */
function sample(products: ApiProduct[], n: number): ApiProduct[] {
  const byPrefix = new Map<string, ApiProduct[]>()
  for (const p of products) {
    const prefix = p.title.match(/^[A-Z]+/)?.[0] ?? '?'
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), p])
  }
  const picked: ApiProduct[] = []
  for (let round = 0; picked.length < n && round < products.length; round++) {
    for (const group of byPrefix.values()) if (group[round] && picked.length < n) picked.push(group[round])
  }
  return picked
}

const cell = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ')

async function main() {
  // --render reports/x.json: rebuild the page from a saved run, no AI calls.
  if (process.argv[2] === '--render') {
    const json = process.argv[3]
    writeFileSync(json.replace(/\.json$/, '.html'), renderHtml(json.replace(/^.*optimizer-dry-run-|\.json$/g, ''), JSON.parse(readFileSync(json, 'utf8'))))
    return console.log(`→ ${json.replace(/\.json$/, '.html')}`)
  }
  const categories = (await get<{ name: string }[]>('/api/commerce/categories')).map((c) => c.name)
  const all: ApiProduct[] = []
  for (let offset = 0; ; offset += 100) {
    const page = await get<{ products: ApiProduct[] }>(`/api/commerce/products?storeSlug=${storeSlug}&limit=100&offset=${offset}`)
    all.push(...page.products)
    if (page.products.length < 100) break
  }
  const picked = sample(all, count)

  const rows: { product: CatalogueProduct; slug: string; proposal?: ListingProposal; problems: string[]; model?: string; cost: number | null }[] = []
  for (const summary of picked) {
    const p = await get<ApiProduct>(`/api/commerce/products/by-slug/${summary.slug}`)
    const media = [...p.media.filter((m) => m.type === 'IMAGE'), ...p.media.filter((m) => m.type === 'VIDEO')]
    const product: CatalogueProduct = {
      ref: String(p.id),
      title: p.title.trim(),
      description: plain(p.description),
      price: p.price,
      currency: p.seller.default_currency ?? 'NGN',
      categories: (p.category ?? []).map((c) => c.category.name),
      city: p.localPage?.cityName ?? null,
      imageUrls: media.slice(0, 2).map(stillUrl),
      storeName: p.seller.store_name,
    }
    try {
      const res = await proposeListing({ tenant: 'marketx', requestId: 'dry-run' }, product, categories)
      rows.push({ product, slug: p.slug, proposal: res.output, problems: checkProposal(product, res.output, categories), model: res.model, cost: res.costUsd })
    } catch (err) {
      // Account problems fail every call the same way: stop instead of paying for nine more.
      if (/invalid x-api-key|credit balance/.test((err as Error).message)) throw err
      rows.push({ product, slug: p.slug, problems: [`failed: ${(err as Error).message}`], cost: null })
    }
    console.log(`${rows.length}/${picked.length} ${product.title}`)
  }

  const total = rows.reduce((s, r) => s + (r.cost ?? 0), 0)
  const usable = rows.filter((r) => r.proposal && r.problems.length === 0).length
  const date = new Date().toISOString().slice(0, 10)
  const md = [
    `# Optimizer dry run: ${storeSlug}, ${date}`,
    '',
    `${rows.length} products, ${usable} pass the code checks, cost $${total.toFixed(3)}. Nothing was written to MarketX.`,
    '',
    '| # | Now | Proposed title | Category (now → proposed) | Ask the seller | Flags / check problems | Conf. |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((r, i) =>
      [
        i + 1,
        `[${cell(r.product.title)}](${MARKETX}/product/${r.slug})`,
        cell(r.proposal?.title ?? '-'),
        `${cell(r.product.categories.join(', '))} → **${cell(r.proposal?.category ?? '-')}**`,
        cell(r.proposal?.askSeller.map((q) => `${q.question} [${q.choices.join(" / ")}]`).join("; ") ?? ""),
        cell([...(r.proposal?.flags ?? []), ...r.problems.map((p) => `CHECK: ${p}`)].join('; ')),
        r.proposal?.confidence ?? '-',
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'),
    ),
    '',
    '## Details',
    ...rows.flatMap((r, i) => [
      '',
      `### ${i + 1}. ${r.product.title} → ${r.proposal?.title ?? '(failed)'}`,
      `- Seller wrote: ${r.product.description || '(nothing)'}`,
      `- Proposed description: ${r.proposal?.description ?? '-'}`,
      `- Uses: ${r.proposal?.uses?.join(", ") ?? "-"}`,
      `- Search phrases: ${r.proposal?.searchPhrases.join(', ') ?? '-'}`,
      `- Why: ${r.proposal?.reason ?? '-'}`,
      `- Model: ${r.model ?? '-'}, cost $${(r.cost ?? 0).toFixed(4)}`,
    ]),
  ].join('\n')

  mkdirSync('reports', { recursive: true })
  const file = `reports/optimizer-dry-run-${storeSlug}-${date}.md`
  writeFileSync(file, md + '\n')
  writeFileSync(file.replace(/\.md$/, '.json'), JSON.stringify(rows, null, 2))
  writeFileSync(file.replace(/\.md$/, '.html'), renderHtml(`${storeSlug}, ${date}`, rows))
  console.log(`\n${usable}/${rows.length} usable, $${total.toFixed(3)} → ${file.replace(/\.md$/, '.html')}`)
}

type Row = { product: CatalogueProduct; slug: string; proposal?: ListingProposal; problems: string[]; model?: string; cost: number | null }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** One self-contained page to judge the proposals. Verdicts stay in this browser until downloaded. */
function renderHtml(label: string, rows: Row[]): string {
  const usable = rows.filter((r) => r.proposal && r.problems.length === 0).length
  const cost = rows.reduce((s, r) => s + (r.cost ?? 0), 0)
  const list = (items: string[], cls = '') => (items.length ? `<ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '')
  const cards = rows
    .map((r) => {
      const p = r.proposal
      return `<article data-ref="${esc(r.product.ref)}">
  <div class="pics">${r.product.imageUrls.map((u) => `<img loading="lazy" src="${esc(u)}" alt="">`).join('')}</div>
  <div class="body">
    <div class="pair">
      <div><div class="k">Now</div><a class="t now" href="${MARKETX}/product/${esc(r.slug)}" target="_blank">${esc(r.product.title)}</a>
        <div class="cat">${esc(r.product.categories.join(', ') || 'no category')}</div></div>
      <div><div class="k">Proposed ${p ? `<span class="conf ${p.confidence}">${p.confidence}</span>` : ''}</div>
        <div class="t">${esc(p?.title ?? 'No proposal')}</div>
        <div class="cat">${esc(p?.category ?? '')}</div></div>
    </div>
    ${list(r.problems.map((x) => `Check: ${x}`), 'bad')}
    ${p ? `${list(p.flags, 'warn')}
    ${p.description ? `<p>${esc(p.description)}</p>` : ''}
    ${p.uses?.length ? `<div class="k">For</div><div class="chips occ">${p.uses.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}
    ${p.searchPhrases.length ? `<div class="chips">${p.searchPhrases.map((s) => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
    ${p.askSeller.length ? `<div class="k">Ask the seller (tap to answer)</div>${p.askSeller.map((q) => `<div>${esc(q.question)}${q.multiple ? " <span class=\"cat\">(tap any)</span>" : ""}<div class="chips">${q.choices.map((c) => `<span>${esc(c)}</span>`).join("")}</div></div>`).join("")}` : ''}
    <p class="why">${esc(p.reason)}</p>` : ''}
    <div class="verdict">
      <button data-v="good">Good</button><button data-v="fix">Needs a fix</button><button data-v="bad">Wrong</button>
      <input placeholder="Note (what a buyer would really type)">
    </div>
  </div>
</article>`
    })
    .join('\n')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Optimizer Review</title>
<style>
:root{--bg:#f7f6f3;--card:#fff;--ink:#1c1b19;--mute:#6b675f;--line:#e4e1da;--good:#1f7a4d;--warn:#9a6200;--bad:#b3261e;--accent:#e8604c}
@media (prefers-color-scheme:dark){:root{--bg:#161513;--card:#1f1e1b;--ink:#eeebe5;--mute:#a19c92;--line:#34322d;--good:#5cc28d;--warn:#e0a43c;--bad:#f07a70}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif}
header{padding:20px 16px;max-width:1000px;margin:auto}h1{margin:0 0 4px;font-size:22px}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.stats div{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 12px}
.stats b{display:block;font-size:20px}main{max-width:1000px;margin:auto;padding:0 16px 40px;display:grid;gap:12px}
article{background:var(--card);border:1px solid var(--line);border-radius:10px;display:grid;grid-template-columns:200px 1fr;overflow:hidden}
article.good{border-color:var(--good)}article.bad{border-color:var(--bad)}article.fix{border-color:var(--warn)}
.pics{display:grid;gap:2px;background:var(--line)}.pics img{width:100%;height:100%;max-height:260px;object-fit:cover;display:block}
.body{padding:14px 16px;min-width:0}.pair{display:grid;grid-template-columns:1fr 1.6fr;gap:16px}
.k{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute);margin:6px 0 2px}
.t{font-weight:600;font-size:17px}.now{color:var(--mute);text-decoration:none}.cat{color:var(--mute);font-size:13px}
.conf{font-size:11px;padding:1px 6px;border-radius:9px;border:1px solid}.high{color:var(--good)}.medium{color:var(--warn)}.low{color:var(--bad)}
ul{margin:6px 0;padding-left:18px}ul.warn{color:var(--warn)}ul.bad{color:var(--bad)}p{margin:8px 0}.why{color:var(--mute);font-size:13px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.occ span{border-color:var(--accent)}.chips span{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:2px 10px;font-size:13px}
.verdict{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.verdict button{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:6px;padding:6px 10px;cursor:pointer}
.verdict input{flex:1;min-width:160px;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:6px;padding:6px 8px}
article.good [data-v=good]{background:var(--good);color:#fff}article.fix [data-v=fix]{background:var(--warn);color:#fff}article.bad [data-v=bad]{background:var(--bad);color:#fff}
#dl{background:var(--accent);color:#fff;border:0;border-radius:6px;padding:8px 14px;cursor:pointer;margin-top:12px}
@media (max-width:640px){article{grid-template-columns:1fr}.pics{grid-template-columns:repeat(3,1fr)}.pics img{max-height:140px}.pair{grid-template-columns:1fr}}
</style></head><body>
<header><h1>Optimizer review</h1><div class="cat">${esc(label)}. Nothing here has been written to MarketX.</div>
<div class="stats"><div><b>${rows.length}</b>products</div><div><b>${usable}</b>pass the checks</div><div><b>$${cost.toFixed(2)}</b>AI cost</div><div><b id="judged">0</b>judged by you</div></div>
<button id="dl">Download my verdicts</button></header>
<main>${cards}</main>
<script>
const KEY='verdicts:${esc(label)}';let v={};try{v=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(v))}catch{};document.getElementById('judged').textContent=Object.values(v).filter(x=>x.verdict).length}
document.querySelectorAll('article').forEach(a=>{const r=a.dataset.ref,i=a.querySelector('input');const paint=()=>{a.className=v[r]?.verdict||''};
if(v[r]){i.value=v[r].note||'';paint()}
a.querySelectorAll('button').forEach(b=>b.onclick=()=>{v[r]={...v[r],verdict:b.dataset.v};paint();save()});
i.oninput=()=>{v[r]={...v[r],note:i.value};save()}});save();
document.getElementById('dl').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(v,null,2)],{type:'application/json'}));const l=document.createElement('a');l.href=u;l.download='verdicts.json';l.click()};
</script></body></html>`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
